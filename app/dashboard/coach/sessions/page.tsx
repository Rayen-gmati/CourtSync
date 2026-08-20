'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatTime } from '@/lib/format-time'
import { Badge } from '@/components/ui/Badge'
import { BouncingBall } from '@/components/ui/BouncingBall'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { EmptyState } from '@/components/ui/EmptyState'
import { fetchAllPeriods, type PeriodRow } from '@/lib/periods'
import { PeriodBands, getWeekBandSegments, bandRowCount, bandSpacerHeight } from '@/components/ui/PeriodBands'
import { BackButton } from '@/components/ui/BackButton'
import { CoachBottomNav } from '@/components/CoachBottomNav'
import { SessionStatusBadge } from '@/components/ui/SessionStatusBadge'
import { MatchDetailsModal } from '@/components/MatchDetailsModal'
import { MobileAgenda } from '@/components/ui/MobileAgenda'
import { WeatherBadge } from '@/components/ui/WeatherBadge'
import type { WeatherByDate } from '@/lib/weather'
import { EFFECTIVE_STATUS_LABELS, getEffectiveStatus } from '@/lib/session-status'
import { useNow } from '@/lib/use-now'

type PlayerOption = {
  id: string
  nom: string
}

type CoachOption = {
  id: string
  nom: string
  role: string
}

type GoalOption = {
  id: string
  nom: string
  player_id: string | null
}

type SessionRow = {
  id: string
  player_id: string
  date: string
  heure_debut: string
  heure_fin: string
  localisation: string | null
  type: string | null
  prix: number | null
  statut: string | null
  notes_coach: string | null
}

type SessionCoachRow = {
  session_id: string
  coach_id: string
  montant_coach: number | null
}

type SessionGoalRow = {
  session_id: string
  goal_id: string
}

type EnrichedSession = SessionRow & {
  playerName: string
  coachAssignments: Array<{
    id: string
    nom: string
    role: string
    montant_coach: number | null
  }>
  goalObjectives: Array<{
    id: string
    nom: string
  }>
}

type SessionFormState = {
  playerId: string
  date: string
  heureDebut: string
  heureFin: string
  localisation: string
  type: string
  prix: string
  statut: string
  notesCoach: string
  selectedCoachIds: string[]
  coachAmounts: Record<string, string>
  selectedGoalIds: string[]
}

const sessionTypeColors: Record<string, string> = {
  entrainement: 'bg-[var(--bg-green-muted)] text-[var(--accent-primary)]',
  echauffement: 'bg-[var(--bg-yellow-muted)] text-[var(--text-main)]',
  match: 'bg-[var(--bg-clay-muted)] text-[var(--accent-secondary-dark)]',
}

const statusOptions = ['prévue', 'faite', 'annulée']

const typeOptions = [
  { value: 'entrainement', label: 'Entraînement' },
  { value: 'echauffement', label: 'Échauffement' },
  { value: 'match', label: 'Match' },
]

function getSessionTypeLabel(value: string | null | undefined) {
  switch (value) {
    case 'entrainement':
      return 'Entraînement'
    case 'echauffement':
      return 'Échauffement'
    case 'match':
      return 'Match'
    default:
      return value || '—'
  }
}

function pad(n: number) {
  return `${n}`.padStart(2, '0')
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfWeek(date: Date) {
  const copy = new Date(date)
  const day = copy.getDay() || 7
  if (day !== 1) {
    copy.setDate(copy.getDate() - (day - 1))
  }
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + amount)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function getCalendarTitle(view: 'week' | 'month', referenceDate: Date) {
  if (view === 'month') {
    return referenceDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }

  const weekStart = startOfWeek(referenceDate)
  const weekEnd = addDays(weekStart, 6)
  return `${weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function getMonthGrid(referenceDate: Date) {
  const firstOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  const start = startOfWeek(firstOfMonth)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

function getWeekGrid(referenceDate: Date) {
  const start = startOfWeek(referenceDate)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

function createEmptyForm(): SessionFormState {
  return {
    playerId: '',
    date: '',
    heureDebut: '',
    heureFin: '',
    localisation: '',
    type: 'entrainement',
    prix: '',
    statut: 'prévue',
    notesCoach: '',
    selectedCoachIds: [],
    coachAmounts: {},
    selectedGoalIds: [],
  }
}

export default function CoachSessionsPage() {
  const [userName, setUserName] = useState('')
  const [players, setPlayers] = useState<PlayerOption[]>([])
  const [coaches, setCoaches] = useState<CoachOption[]>([])
  const [goals, setGoals] = useState<GoalOption[]>([])
  const [sessions, setSessions] = useState<EnrichedSession[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [weather, setWeather] = useState<WeatherByDate>({})
  const [selectedPlayerFilter, setSelectedPlayerFilter] = useState('')
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [referenceDate, setReferenceDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [matchSession, setMatchSession] = useState<EnrichedSession | null>(null)
  const [newGoalName, setNewGoalName] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [form, setForm] = useState<SessionFormState>(createEmptyForm())
  const router = useRouter()
  // Horloge partagée : les badges passent de "Prévue" → "En cours" → "Faite"
  // sans rechargement (recalcul au focus/visibilité + toutes les 30 s).
  const now = useNow(30000)

  const visibleSessions = useMemo(() => {
    return selectedPlayerFilter
      ? sessions.filter((session) => session.player_id === selectedPlayerFilter)
      : sessions
  }, [sessions, selectedPlayerFilter])

  const visiblePeriods = useMemo(() => {
    return selectedPlayerFilter
      ? periods.filter((period) => period.player_id === selectedPlayerFilter)
      : periods
  }, [periods, selectedPlayerFilter])

  const selectedSession = useMemo(
    () => visibleSessions.find((session) => session.id === selectedSessionId) || null,
    [visibleSessions, selectedSessionId]
  )

  const fetchGoalsForPlayer = async (playerId: string) => {
    if (!playerId) {
      setGoals([])
      return
    }

    const { data, error: goalsError } = await supabase
      .from('goals')
      .select('id, titre, player_id')
      .eq('player_id', playerId)
      .order('titre')

    if (!goalsError && data) {
      setGoals(data.map((row) => ({ id: row.id, nom: row.titre, player_id: row.player_id })))
    } else {
      setGoals([])
    }
  }

  const refreshSessions = async () => {
    const [playersResult, coachesResult, sessionsResult, sessionCoachesResult, sessionGoalsResult, goalsResult, periodsData] = await Promise.all([
      supabase.from('players').select('id, nom').order('nom'),
      supabase.from('users').select('id, nom, role').in('role', ['coach', 'coach_admin']).order('nom'),
      supabase
        .from('sessions')
        .select('id, player_id, date, heure_debut, heure_fin, localisation, type, prix, statut, notes_coach')
        .order('date', { ascending: false }),
      supabase.from('session_coaches').select('session_id, coach_id, montant_coach'),
      supabase.from('session_goals').select('session_id, goal_id'),
      supabase.from('goals').select('id, titre, player_id').order('titre'),
      fetchAllPeriods(),
    ])

    if (playersResult.data) setPlayers(playersResult.data)
    if (coachesResult.data) setCoaches(coachesResult.data)
    setPeriods(periodsData)

    const sessionsData = sessionsResult.data || []
    const sessionCoachesData = sessionCoachesResult.data || []
    const sessionGoalsData = sessionGoalsResult.data || []
    const allGoalsData = goalsResult.data || []

    const enriched = sessionsData.map<EnrichedSession>((session) => {
      const playerName = playersResult.data?.find((player) => player.id === session.player_id)?.nom || 'Joueur inconnu'

      const coachAssignments = sessionCoachesData
        .filter((assignment) => assignment.session_id === session.id)
        .map((assignment) => {
          const coach = coachesResult.data?.find((item) => item.id === assignment.coach_id)
          return {
            id: assignment.coach_id,
            nom: coach?.nom || 'Coach inconnu',
            role: coach?.role || 'coach',
            montant_coach: assignment.montant_coach,
          }
        })

      const goalObjectives = sessionGoalsData
        .filter((goalLink) => goalLink.session_id === session.id)
        .map((goalLink) => {
          const goal = allGoalsData.find((item) => item.id === goalLink.goal_id)
          return {
            id: goalLink.goal_id,
            nom: goal?.titre || 'Objectif inconnu',
          }
        })

      return {
        ...session,
        playerName,
        coachAssignments,
        goalObjectives,
      }
    })

    setSessions(enriched)
  }

  // Météo : échec silencieux (rien d'affiché si l'API est indisponible).
  const refreshWeather = async () => {
    try {
      const response = await fetch('/api/weather', { cache: 'no-store' })
      if (!response.ok) return
      const payload = await response.json()
      setWeather(payload.days || {})
    } catch (weatherError) {
      console.error('Error fetching weather:', weatherError)
    }
  }

  useEffect(() => {
    let mounted = true

    const loadPage = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()

        if (error || !data.user) {
          router.push('/login')
          return
        }

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('nom, role')
          .eq('id', data.user.id)
          .single()

        if (userError || !userData) {
          router.push('/login')
          return
        }

        if (userData.role === 'parent') {
          router.push('/dashboard/parent')
          return
        }

        if (mounted) {
          setUserName(userData.nom)
        }

        await refreshSessions()
        await refreshWeather()
      } catch (pageError) {
        console.error('Error loading coach sessions page:', pageError)
        router.push('/login')
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadPage()

    return () => {
      mounted = false
    }
  }, [router])

  useEffect(() => {
    void fetchGoalsForPlayer(form.playerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.playerId])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    await fetch('/api/auth/session', { method: 'DELETE' })
    router.push('/login')
  }

  const openNewSessionForm = (presetDate?: string) => {
    setEditingSessionId(null)
    setForm({ ...createEmptyForm(), date: presetDate || '' })
    setGoals([])
    setError('')
    setSuccess('')
    setShowFormModal(true)
  }

  const openEditSessionForm = async (session: EnrichedSession) => {
    setEditingSessionId(session.id)
    setForm({
      playerId: session.player_id,
      date: session.date,
      heureDebut: formatTime(session.heure_debut),
      heureFin: formatTime(session.heure_fin),
      localisation: session.localisation || '',
      type: session.type || 'entrainement',
      prix: session.prix !== null ? String(session.prix) : '',
      statut: session.statut || 'prévue',
      notesCoach: session.notes_coach || '',
      selectedCoachIds: session.coachAssignments.map((coach) => coach.id),
      coachAmounts: session.coachAssignments.reduce<Record<string, string>>((accumulator, coach) => {
        accumulator[coach.id] = coach.montant_coach !== null ? String(coach.montant_coach) : ''
        return accumulator
      }, {}),
      selectedGoalIds: session.goalObjectives.map((goal) => goal.id),
    })
    setGoals([])
    setError('')
    setSuccess('')
    setShowDetailModal(false)
    setShowFormModal(true)
    await fetchGoalsForPlayer(session.player_id)
  }

  const openSessionDetails = (session: EnrichedSession) => {
    setSelectedSessionId(session.id)
    setShowDetailModal(true)
  }

  // Saisie manuelle d'un objectif : créé en base pour le joueur sélectionné
  // puis coché directement dans la séance en cours d'édition.
  const handleAddGoal = async () => {
    const nom = newGoalName.trim()
    if (!nom || !form.playerId) return

    setSavingGoal(true)
    try {
      const { data, error: goalError } = await supabase
        .from('goals')
        .insert({ titre: nom, player_id: form.playerId })
        .select('id, titre, player_id')
        .single()

      if (goalError || !data) throw goalError || new Error('Goal creation failed')

      const created: GoalOption = { id: data.id, nom: data.titre, player_id: data.player_id }
      setGoals((current) => [...current, created].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
      setForm((current) => ({ ...current, selectedGoalIds: [...current.selectedGoalIds, created.id] }))
      setNewGoalName('')
    } catch (goalError) {
      console.error('Error creating goal:', goalError)
      setError(goalError instanceof Error ? goalError.message : 'Impossible de créer l’objectif.')
    } finally {
      setSavingGoal(false)
    }
  }

  const handleStatusChange = async (sessionId: string, nextStatus: string) => {
    const { error: updateError } = await supabase.from('sessions').update({ statut: nextStatus }).eq('id', sessionId)

    if (updateError) {
      console.error('Error updating session status:', updateError)
      setError(updateError.message)
      return
    }

    setSessions((current) =>
      current.map((session) => (session.id === sessionId ? { ...session, statut: nextStatus } : session))
    )
    setSelectedSessionId(sessionId)
    setSuccess('Statut de la séance mis à jour.')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const payload = {
        player_id: form.playerId,
        date: form.date,
        heure_debut: form.heureDebut,
        heure_fin: form.heureFin,
        localisation: form.localisation,
        type: form.type,
        prix: form.prix ? Number(form.prix) : null,
        statut: form.statut,
        notes_coach: form.notesCoach,
      }

      let sessionId = editingSessionId

      if (editingSessionId) {
        const { error: updateError } = await supabase.from('sessions').update(payload).eq('id', editingSessionId)

        if (updateError) {
          throw updateError
        }
      } else {
        const { data, error: insertError } = await supabase.from('sessions').insert(payload).select('id').single()

        if (insertError || !data) {
          throw insertError || new Error('Session creation failed')
        }

        sessionId = data.id
      }

      if (!sessionId) {
        throw new Error('Missing session id')
      }

      const coachRows = form.selectedCoachIds.map((coachId) => ({
        session_id: sessionId,
        coach_id: coachId,
        montant_coach: form.coachAmounts[coachId] ? Number(form.coachAmounts[coachId]) : null,
      }))

      await supabase.from('session_coaches').delete().eq('session_id', sessionId)
      await supabase.from('session_goals').delete().eq('session_id', sessionId)

      if (coachRows.length > 0) {
        const { error: coachInsertError } = await supabase.from('session_coaches').insert(coachRows)
        if (coachInsertError) throw coachInsertError
      }

      if (form.selectedGoalIds.length > 0) {
        const goalRows = form.selectedGoalIds.map((goalId) => ({
          session_id: sessionId,
          goal_id: goalId,
        }))

        const { error: goalInsertError } = await supabase.from('session_goals').insert(goalRows)
        if (goalInsertError) throw goalInsertError
      }

      await refreshSessions()
      setShowFormModal(false)
      setEditingSessionId(null)
      setForm(createEmptyForm())
      setSuccess(editingSessionId ? 'Séance modifiée avec succès.' : 'Séance créée avec succès.')
    } catch (submitError) {
      console.error('Error saving session:', submitError)
      setError(submitError instanceof Error ? submitError.message : 'Impossible d’enregistrer la séance')
    } finally {
      setSaving(false)
    }
  }

  const filteredSessions = visibleSessions.filter((session) =>
    selectedPlayerFilter ? session.player_id === selectedPlayerFilter : true
  )

  const calendarDays = viewMode === 'month' ? getMonthGrid(referenceDate) : getWeekGrid(referenceDate)
  const weekRows: Date[][] = []
  for (let i = 0; i < calendarDays.length; i += 7) {
    weekRows.push(calendarDays.slice(i, i + 7))
  }
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, EnrichedSession[]>()

    filteredSessions.forEach((session) => {
      const list = map.get(session.date) || []
      list.push(session)
      map.set(session.date, list)
    })

    return map
  }, [filteredSessions])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BouncingBall size="md" />
      </div>
    )
  }

  return (
    <div className="min-h-screen animate-fade-in relative">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-main)]/95 relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between relative z-10">
          <div>
            <BackButton className="mb-3" />
            <h1 className="text-3xl font-sora font-bold text-[var(--accent-primary)]">Séances</h1>
            <p className="text-[var(--text-muted)] mt-1">Bonjour {userName}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <ThemeToggle />
            <Button variant="secondary" onClick={handleLogout}>Déconnexion</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-10 pb-24 md:pb-10 space-y-8 relative z-10">
        <Card className="p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between mb-6">
            <div>
              <h2 className="text-2xl font-sora font-bold text-[var(--accent-primary)]">Calendrier des séances</h2>
              <p className="text-[var(--text-muted)] mt-1">Vue mensuelle ou hebdomadaire de toutes les séances.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedPlayerFilter}
                onChange={(e) => setSelectedPlayerFilter(e.target.value)}
                className="bg-[var(--bg-card)] text-[var(--text-main)] px-4 py-2 rounded-input border border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30"
              >
                <option value="">Tous les joueurs</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.nom}
                  </option>
                ))}
              </select>

              <div className="inline-flex bg-[var(--bg-card)] rounded-input p-1 border border-[var(--border-subtle)]">
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition ${viewMode === 'week' ? 'bg-[var(--accent-cta)] text-[var(--text-main)]' : 'text-[var(--text-main)] hover:bg-[var(--bg-dim)]'}`}
                >
                  Semaine
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition ${viewMode === 'month' ? 'bg-[var(--accent-cta)] text-[var(--text-main)]' : 'text-[var(--text-main)] hover:bg-[var(--bg-dim)]'}`}
                >
                  Mois
                </button>
              </div>

              <Button variant="secondary" onClick={() => setReferenceDate(new Date())}>Aujourd’hui</Button>

              <Button variant="secondary" onClick={() => setReferenceDate(addDays(referenceDate, viewMode === 'week' ? 7 : 30))}>Suivant</Button>

              <Button variant="secondary" onClick={() => setReferenceDate(addDays(referenceDate, viewMode === 'week' ? -7 : -30))}>Précédent</Button>

              <Button variant="accent" onClick={() => openNewSessionForm()}>Ajouter une séance</Button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 text-[var(--text-muted)]">
            <h3 className="text-lg font-sora font-semibold">{getCalendarTitle(viewMode, referenceDate)}</h3>
            <span className="text-sm">{filteredSessions.length} séance(s)</span>
          </div>

          <div className="overflow-hidden rounded-card border border-[var(--border-subtle)] bg-[var(--bg-dim)] hidden md:block">
            <div className={`grid ${viewMode === 'month' ? 'grid-cols-7' : 'grid-cols-7'} bg-[var(--bg-card)] text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]`}>
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                <div key={day} className="px-3 py-3 text-center border-r border-[var(--border-subtle)] last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            <div className={viewMode === 'month' ? 'min-h-[720px]' : 'min-h-[320px]'}>
              {weekRows.map((week) => {
                const bandSegments = getWeekBandSegments(week, visiblePeriods)
                const bandRows = bandRowCount(bandSegments)

                return (
                  <div key={formatDateKey(week[0])} className="relative grid grid-cols-7 divide-x divide-[var(--border-subtle)] border-b border-[var(--border-subtle)]">
                    <PeriodBands segments={bandSegments} className="absolute inset-x-0 top-9 z-0 grid-cols-7" />
                    {week.map((day) => {
                      const key = formatDateKey(day)
                      const daySessions = sessionsByDate.get(key) || []
                      const isCurrentMonth = viewMode === 'month' ? day.getMonth() === referenceDate.getMonth() : true
                      const isToday = key === formatDateKey(new Date())

                      return (
                        <div
                          key={key}
                          onClick={() => openNewSessionForm(key)}
                          title={`Ajouter une séance le ${key}`}
                          className={`min-h-40 p-2 cursor-pointer ${isCurrentMonth ? 'bg-transparent' : 'bg-[var(--bg-dim)]'} ${isToday ? 'ring-2 ring-[var(--accent-secondary)] ring-inset' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-semibold ${isCurrentMonth ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] opacity-40'}`}>
                              {day.getDate()}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <WeatherBadge weather={weather[key]} />
                              {daySessions.length > 0 && <span className="text-[11px] text-[var(--text-muted)]">{daySessions.length}</span>}
                            </span>
                          </div>

                          <div className="space-y-2 relative" style={bandRows > 0 ? { marginTop: bandSpacerHeight(bandRows) } : undefined}>
                      {daySessions.slice(0, viewMode === 'month' ? 3 : 5).map((session) => (
                        <button
                          key={session.id}
                          onClick={(event) => {
                            event.stopPropagation()
                            openSessionDetails(session)
                          }}
                          className={`w-full text-left rounded-input px-3 py-2 text-xs shadow-sm border border-[var(--border-subtle)] hover:opacity-95 transition ${sessionTypeColors[session.type || 'entrainement'] || 'bg-[var(--bg-card)] text-[var(--accent-primary)]'}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold truncate">
                              {formatTime(session.heure_debut)} - {formatTime(session.heure_fin)}
                            </span>
                            <SessionStatusBadge session={session} now={now} />
                          </div>
                          <div className="truncate opacity-90">{session.playerName}</div>
                          <div className="truncate opacity-80">{session.localisation || 'Localisation non renseignée'}</div>
                        </button>
                      ))}

                      {daySessions.length > (viewMode === 'month' ? 3 : 5) && (
                        <div className="text-xs text-[var(--text-muted)] px-1">+ {daySessions.length - (viewMode === 'month' ? 3 : 5)} autre(s)</div>
                      )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Agenda mobile : liste par jour, lisible à 375px. */}
          <div className="md:hidden">
            <MobileAgenda
              days={calendarDays}
              sessionsFor={(key) =>
                (sessionsByDate.get(key) || []).map((session) => ({
                  id: session.id,
                  date: session.date,
                  heure_debut: session.heure_debut,
                  heure_fin: session.heure_fin,
                  type: session.type,
                  statut: session.statut,
                  label: session.playerName,
                  sublabel: session.localisation || undefined,
                }))
              }
              periodsFor={(key) =>
                visiblePeriods
                  .filter((period) => period.date_debut <= key && period.date_fin >= key)
                  .map((period) => ({ id: period.id, nom: period.nom, color: period.color }))
              }
              weather={weather}
              now={now}
              showEmptyDays={viewMode === 'week'}
              onDayClick={(key) => openNewSessionForm(key)}
              onSessionClick={(id) => {
                const session = filteredSessions.find((item) => item.id === id)
                if (session) openSessionDetails(session)
              }}
              emptyMessage="Aucune séance ce jour."
            />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-sora font-bold text-[var(--accent-primary)] mb-4">Séances existantes</h2>
          {filteredSessions.length === 0 ? (
            <EmptyState message="Aucune séance pour le moment." />
          ) : (
            <div className="space-y-3">
              {filteredSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => openSessionDetails(session)}
                  className="w-full text-left bg-[var(--bg-card)] rounded-card px-4 py-4 hover:bg-[var(--bg-dim)] transition border border-[var(--border-subtle)]"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-sora font-semibold text-lg text-[var(--text-main)]">{session.playerName}</p>
                      <p className="text-[var(--text-muted)] text-sm">
                        {session.date} · {formatTime(session.heure_debut)} - {formatTime(session.heure_fin)} · {session.localisation || 'Localisation non renseignée'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${sessionTypeColors[session.type || 'entrainement'] || 'bg-[var(--bg-card)] text-[var(--accent-primary)]'}`}>
                        {getSessionTypeLabel(session.type)}
                      </span>
                      <SessionStatusBadge session={session} now={now} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </main>
      
        <CoachBottomNav />

      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-[var(--text-main)]/60 backdrop-blur-sm flex items-start md:items-center justify-center p-0 md:p-4 overflow-y-auto">
          <div className="bg-[var(--bg-card)] text-[var(--text-main)] w-full max-w-4xl rounded-none md:rounded-card shadow-2xl p-5 md:p-8 my-0 md:my-6 min-h-full md:min-h-0 border border-[var(--border-strong)]">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-sora font-bold text-[var(--accent-primary)]">{editingSessionId ? 'Modifier la séance' : 'Ajouter une séance'}</h3>
                <p className="text-[var(--text-muted)] mt-1">Renseignez les informations de séance et les objectifs travaillés.</p>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-2xl leading-none"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            {error && <div className="bg-[var(--bg-clay-muted)] border border-[var(--accent-secondary-dark)]/20 text-[var(--accent-secondary-dark)] px-4 py-3 rounded mb-6">{error}</div>}
            {success && <div className="bg-[var(--bg-green-muted)] border border-[var(--accent-primary)]/20 text-[var(--accent-primary)] px-4 py-3 rounded mb-6">{success}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Joueur</label>
                  <select
                    value={form.playerId}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        playerId: e.target.value,
                        selectedGoalIds: [],
                      }))
                    }
                    className="w-full px-4 py-2 border border-[var(--border-strong)] rounded-input focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 text-[var(--text-main)] bg-[var(--bg-card)]"
                    required
                  >
                    <option value="">-- Sélectionner un joueur --</option>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))}
                    className="w-full px-4 py-2 border border-[var(--border-strong)] rounded-input focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 text-[var(--text-main)] bg-[var(--bg-card)]"
                    required
                  >
                    {typeOptions.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))}
                    className="w-full px-4 py-2 border border-[var(--border-strong)] rounded-input focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 text-[var(--text-main)] bg-[var(--bg-card)]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Statut</label>
                  <select
                    value={form.statut}
                    onChange={(e) => setForm((current) => ({ ...current, statut: e.target.value }))}
                    className="w-full px-4 py-2 border border-[var(--border-strong)] rounded-input focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 text-[var(--text-main)] bg-[var(--bg-card)]"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Heure début</label>
                  <input
                    type="time"
                    value={form.heureDebut}
                    onChange={(e) => setForm((current) => ({ ...current, heureDebut: e.target.value }))}
                    className="w-full px-4 py-2 border border-[var(--border-strong)] rounded-input focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 text-[var(--text-main)] bg-[var(--bg-card)]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Heure fin</label>
                  <input
                    type="time"
                    value={form.heureFin}
                    onChange={(e) => setForm((current) => ({ ...current, heureFin: e.target.value }))}
                    className="w-full px-4 py-2 border border-[var(--border-strong)] rounded-input focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 text-[var(--text-main)] bg-[var(--bg-card)]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Localisation</label>
                  <input
                    type="text"
                    value={form.localisation}
                    onChange={(e) => setForm((current) => ({ ...current, localisation: e.target.value }))}
                    className="w-full px-4 py-2 border border-[var(--border-strong)] rounded-input focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 text-[var(--text-main)] bg-[var(--bg-card)]"
                    placeholder="Ex: Court central"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Prix</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.prix}
                    onChange={(e) => setForm((current) => ({ ...current, prix: e.target.value }))}
                    className="w-full px-4 py-2 border border-[var(--border-strong)] rounded-input focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 text-[var(--text-main)] bg-[var(--bg-card)]"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Notes coach</label>
                <textarea
                  value={form.notesCoach}
                  onChange={(e) => setForm((current) => ({ ...current, notesCoach: e.target.value }))}
                  className="w-full px-4 py-3 border border-[var(--border-strong)] rounded-input focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 text-[var(--text-main)] bg-[var(--bg-card)] min-h-[120px]"
                  placeholder="Notes de séance..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-[var(--text-muted)]">Coach(s) assigné(s)</label>
                  <p className="text-xs text-[var(--text-muted)]">Montant coach requis pour chaque sélection.</p>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {coaches.map((coach) => {
                    const isSelected = form.selectedCoachIds.includes(coach.id)
                    return (
                      <div key={coach.id} className="border border-[var(--border-subtle)] rounded-input p-3">
                        <div className="flex items-center justify-between gap-4">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                setForm((current) => {
                                  const selectedCoachIds = e.target.checked
                                    ? [...current.selectedCoachIds, coach.id]
                                    : current.selectedCoachIds.filter((id) => id !== coach.id)

                                  const coachAmounts = { ...current.coachAmounts }
                                  if (!e.target.checked) {
                                    delete coachAmounts[coach.id]
                                  }

                                  return { ...current, selectedCoachIds, coachAmounts }
                                })
                              }}
                            />
                            <span className="font-medium text-[var(--text-main)]">{coach.nom}</span>
                            <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]/70">{coach.role}</span>
                          </label>

                          {isSelected && (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={form.coachAmounts[coach.id] || ''}
                              onChange={(e) =>
                                setForm((current) => ({
                                  ...current,
                                  coachAmounts: { ...current.coachAmounts, [coach.id]: e.target.value },
                                }))
                              }
                              className="w-40 px-3 py-2 border border-[var(--border-strong)] rounded-input text-[var(--text-main)] bg-[var(--bg-card)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30"
                              placeholder="Montant"
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--text-muted)] mb-3">Objectifs travaillés</label>
                {form.playerId ? (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={newGoalName}
                        onChange={(e) => setNewGoalName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void handleAddGoal()
                          }
                        }}
                        className="flex-1 px-4 py-2 border border-[var(--border-strong)] rounded-input focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 text-[var(--text-main)] bg-[var(--bg-card)]"
                        placeholder="Saisir un nouvel objectif (ex : travail du revers)..."
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddGoal()}
                        disabled={savingGoal || newGoalName.trim() === ''}
                        className="px-4 py-2 rounded-input border border-[var(--border-strong)] text-[var(--text-main)] hover:bg-[var(--bg-dim)] transition disabled:opacity-50"
                      >
                        {savingGoal ? 'Ajout...' : 'Ajouter l’objectif'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                    {goals.length === 0 ? (
                      <p className="text-[var(--text-muted)]">Aucun objectif disponible pour ce joueur.</p>
                    ) : (
                      goals.map((goal) => {
                        const checked = form.selectedGoalIds.includes(goal.id)
                        return (
                          <label key={goal.id} className={`flex items-center gap-3 rounded-input border p-3 cursor-pointer ${checked ? 'border-[var(--accent-primary)] bg-[var(--bg-green-muted)]' : 'border-[var(--border-subtle)]'}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setForm((current) => ({
                                  ...current,
                                  selectedGoalIds: e.target.checked
                                    ? [...current.selectedGoalIds, goal.id]
                                    : current.selectedGoalIds.filter((id) => id !== goal.id),
                                }))
                              }}
                            />
                            <span className="text-[var(--text-main)] font-medium">{goal.nom}</span>
                          </label>
                        )
                      })
                    )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[var(--text-muted)]">Sélectionnez un joueur pour afficher ses objectifs.</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-5 py-3 rounded-input border border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--bg-dim)] transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[var(--accent-cta)] text-[var(--text-main)] font-semibold px-6 py-3 rounded-input shadow hover:opacity-95 disabled:opacity-60 transition"
                >
                  {saving ? 'Enregistrement...' : editingSessionId ? 'Mettre à jour' : 'Créer la séance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedSession && (
        <div className="fixed inset-0 z-50 bg-[var(--text-main)]/60 backdrop-blur-sm flex items-start md:items-center justify-center p-0 md:p-4 overflow-y-auto">
          <div className="bg-[var(--bg-card)] text-[var(--text-main)] w-full max-w-2xl rounded-none md:rounded-card shadow-2xl p-5 md:p-8 my-0 md:my-6 min-h-full md:min-h-0 border border-[var(--border-strong)]">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-sora font-bold text-[var(--accent-primary)]">Détails de la séance</h3>
                <p className="text-[var(--text-muted)] mt-1">{selectedSession.playerName}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-2xl leading-none" aria-label="Fermer">
                ×
              </button>
            </div>

            <div className="space-y-4 text-sm text-[var(--text-main)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-input bg-[var(--bg-dim)] p-4"><strong>Date:</strong> {selectedSession.date}</div>
                <div className="rounded-input bg-[var(--bg-dim)] p-4"><strong>Heure:</strong> {formatTime(selectedSession.heure_debut)} - {formatTime(selectedSession.heure_fin)}</div>
                <div className="rounded-input bg-[var(--bg-dim)] p-4"><strong>Type:</strong> {selectedSession.type}</div>
                <div className="rounded-input bg-[var(--bg-dim)] p-4">
                  <strong>Statut:</strong>{' '}
                  {(() => {
                    const effective = getEffectiveStatus(selectedSession, now)
                    return (
                      <>
                        {EFFECTIVE_STATUS_LABELS[effective]}
                        {effective !== 'annulee' && selectedSession.statut && selectedSession.statut.toLowerCase() !== 'annulée' && (
                          <span className="text-[var(--text-muted)]"> (enregistré : {selectedSession.statut})</span>
                        )}
                      </>
                    )
                  })()}
                </div>
                <div className="rounded-input bg-[var(--bg-dim)] p-4"><strong>Localisation:</strong> {selectedSession.localisation || '—'}</div>
                <div className="rounded-input bg-[var(--bg-dim)] p-4"><strong>Prix:</strong> {selectedSession.prix ?? '—'}</div>
              </div>

              <div className="rounded-input bg-[var(--bg-dim)] p-4">
                <strong>Notes coach:</strong>
                <p className="mt-2 whitespace-pre-line text-[var(--text-muted)]">{selectedSession.notes_coach || '—'}</p>
              </div>

              <div className="rounded-input bg-[var(--bg-dim)] p-4">
                <strong>Coachs assignés:</strong>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedSession.coachAssignments.length === 0 ? (
                    <span className="text-[var(--text-muted)]">Aucun coach assigné.</span>
                  ) : (
                    selectedSession.coachAssignments.map((coach) => (
                      <span key={coach.id} className="px-3 py-1 rounded-full bg-[var(--accent-primary)] text-white text-xs font-semibold">
                        {coach.nom} {coach.montant_coach !== null ? `(${coach.montant_coach} DT)` : ''}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-input bg-[var(--bg-dim)] p-4">
                <strong>Objectifs travaillés:</strong>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedSession.goalObjectives.length === 0 ? (
                    <span className="text-[var(--text-muted)]">Aucun objectif lié.</span>
                  ) : (
                    selectedSession.goalObjectives.map((goal) => (
                      <span key={goal.id} className="px-3 py-1 rounded-full bg-[var(--accent-ball)] text-[var(--accent-primary)] text-xs font-semibold">
                        {goal.nom}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-[var(--text-muted)]">Changer le statut</label>
                <select
                  value={selectedSession.statut || 'prévue'}
                  onChange={(e) => void handleStatusChange(selectedSession.id, e.target.value)}
                  className="px-4 py-2 border border-[var(--border-strong)] rounded-input focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 text-[var(--text-main)] bg-[var(--bg-card)]"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                {selectedSession.type === 'match' && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false)
                      setMatchSession(selectedSession)
                    }}
                    className="px-5 py-3 rounded-input border border-[var(--border-strong)] text-[var(--text-main)] font-semibold hover:bg-[var(--bg-dim)] transition"
                  >
                    Statistiques du match
                  </button>
                )}
                <button
                  onClick={() => void openEditSessionForm(selectedSession)}
                  className="bg-[var(--accent-cta)] text-[var(--text-main)] font-semibold px-5 py-3 rounded-input shadow hover:opacity-95 transition"
                >
                  Modifier
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-5 py-3 rounded-input border border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--bg-dim)] transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {matchSession && (
        <MatchDetailsModal
          sessionId={matchSession.id}
          playerId={matchSession.player_id}
          playerName={matchSession.playerName}
          sessionDate={matchSession.date}
          onClose={() => setMatchSession(null)}
        />
      )}
    </div>
  )
}
