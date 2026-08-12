import { supabaseAdmin } from '@/lib/supabase-admin'
import { getEffectiveStatus, getSessionDurationHours } from '@/lib/session-status'

export type PlayerEarning = {
  playerId: string
  nom: string
  count: number
  hours: number
  total: number
}

export type MonthEarning = {
  key: string
  label: string
  total: number
  count: number
  hours: number
  players: PlayerEarning[]
}

type EarnedSession = {
  date: string
  playerId: string
  amount: number
  hours: number
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function monthKey(date: string) {
  return date.slice(0, 7)
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  const label = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function dateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// Séances "faites" (statut calculé à la volée) avec le montant réellement
// associé : montant_coach de l'assignation si présent, sinon prix de la séance.
// Si le coach n'a aucune assignation enregistrée, repli sur le prix des séances.
async function computeEarnedSessions(coachId: string, now: Date) {
  const [sessionsResult, coachesResult, playersResult] = await Promise.all([
    supabaseAdmin.from('sessions').select('id, player_id, date, heure_debut, heure_fin, statut, prix'),
    supabaseAdmin.from('session_coaches').select('session_id, coach_id, montant_coach'),
    supabaseAdmin.from('players').select('id, nom'),
  ])

  const sessions = sessionsResult.data || []
  const assignments = (coachesResult.data || []).filter((row) => row.coach_id === coachId)
  const assignmentBySession = new Map(assignments.map((row) => [row.session_id, row]))
  const playerNames = new Map((playersResult.data || []).map((player) => [player.id, player.nom]))
  const priceFallback = assignments.length === 0

  const earned: EarnedSession[] = []
  for (const session of sessions) {
    if (getEffectiveStatus(session, now) !== 'faite') continue

    const assignment = assignmentBySession.get(session.id)
    if (!priceFallback && !assignment) continue

    earned.push({
      date: session.date,
      playerId: session.player_id,
      amount: assignment?.montant_coach ?? session.prix ?? 0,
      hours: getSessionDurationHours(session),
    })
  }

  return { earned, priceFallback, playerNames }
}

export async function getEarningsSummary(coachId: string, now: Date = new Date()) {
  const { earned, priceFallback } = await computeEarnedSessions(coachId, now)

  const currentMonth = monthKey(dateKey(now))
  const today = dateKey(now)

  const monthItems = earned.filter((item) => monthKey(item.date) === currentMonth)
  const toTodayItems = monthItems.filter((item) => item.date <= today)

  const aggregate = (items: EarnedSession[]) => ({
    total: round2(items.reduce((sum, item) => sum + item.amount, 0)),
    count: items.length,
    hours: round2(items.reduce((sum, item) => sum + item.hours, 0)),
  })

  return {
    currency: 'DT',
    priceFallback,
    month: aggregate(monthItems),
    toToday: aggregate(toTodayItems),
  }
}

export async function getEarningsHistory(coachId: string, now: Date = new Date()) {
  const { earned, priceFallback, playerNames } = await computeEarnedSessions(coachId, now)

  const months = new Map<string, { total: number; count: number; hours: number; players: Map<string, PlayerEarning> }>()

  for (const item of earned) {
    const key = monthKey(item.date)
    let month = months.get(key)
    if (!month) {
      month = { total: 0, count: 0, hours: 0, players: new Map() }
      months.set(key, month)
    }

    month.total = round2(month.total + item.amount)
    month.count += 1
    month.hours = round2(month.hours + item.hours)

    let player = month.players.get(item.playerId)
    if (!player) {
      player = { playerId: item.playerId, nom: playerNames.get(item.playerId) || 'Joueur inconnu', count: 0, hours: 0, total: 0 }
      month.players.set(item.playerId, player)
    }
    player.total = round2(player.total + item.amount)
    player.count += 1
    player.hours = round2(player.hours + item.hours)
  }

  const history: MonthEarning[] = [...months.entries()]
    .map(([key, month]) => ({
      key,
      label: monthLabel(key),
      total: month.total,
      count: month.count,
      hours: month.hours,
      players: [...month.players.values()].sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.key.localeCompare(a.key))

  return { currency: 'DT', priceFallback, months: history }
}
