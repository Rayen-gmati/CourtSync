'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { BouncingBall } from '@/components/ui/BouncingBall'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { StarRating as RatingStars } from '@/components/ui/StarRating'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { CourtLinesBackground } from '@/components/ui/CourtLinesBackground'
import { TennisServiceSilhouette } from '@/components/ui/TennisServiceSilhouette'
import { EmptyState } from '@/components/ui/EmptyState'
import { SessionStatusBadge } from '@/components/ui/SessionStatusBadge'
import { EFFECTIVE_STATUS_LABELS, getEffectiveStatus } from '@/lib/session-status'
import { WeatherBadge } from '@/components/ui/WeatherBadge'
import { PeriodBands, getWeekBandSegments, bandRowCount, bandSpacerHeight } from '@/components/ui/PeriodBands'
import type { WeatherByDate } from '@/lib/weather'
import { useNow } from '@/lib/use-now'

type LinkedPlayer = {
  id: string
  nom: string
}

type SessionItem = {
  id: string
  player_id: string
  date: string
  heure_debut: string
  heure_fin: string
  localisation: string | null
  type: string | null
  statut: string | null
  notes_coach: string | null
  prix: number | null
  coachNames: string[]
  goals: Array<{ id: string; nom: string }>
}

type MatchItem = {
  id: string
  date: string
  adversaire: string | null
  score: string | null
  resultat: string | null
}

type PeriodItem = {
  id: string
  player_id: string
  type: string
  nom: string
  date_debut: string
  date_fin: string
  notes: string | null
  tournament_name: string | null
  color: string | null
}

type RatingValue = {
  id: string | null
  rating: number | null
}

function pad(value: number) {
  return `${value}`.padStart(2, '0')
}

function startOfWeek(date: Date) {
  const next = new Date(date)
  const day = next.getDay() || 7
  next.setDate(next.getDate() - (day - 1))
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + amount)
  return next
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getWeekDays(startDate: Date) {
  return Array.from({ length: 7 }, (_, index) => addDays(startDate, index))
}

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

// Message utilisateur en fonction de la nature réelle de l'erreur Supabase :
// on distingue réseau / droits (RLS) / serveur pour faciliter le debug.
function describeRatingError(err: { code?: string; message?: string; name?: string } | null | undefined) {
  const message = String(err?.message || '')
  // Erreur réseau : la requête n'a pas atteint le serveur (fetch échoué).
  if (err?.name === 'TypeError' || /failed to fetch|networkerror|network request failed/i.test(message)) {
    return 'Problème de connexion réseau. Vérifiez votre connexion et réessayez.'
  }
  // Violation d'une policy RLS Supabase : droits insuffisants.
  if (err?.code === '42501' || /row-level security/i.test(message)) {
    return 'Vous n’avez pas les droits pour noter ce joueur.'
  }
  // Défaut : erreur serveur / inconnue.
  return 'Impossible d’enregistrer la note hebdomadaire. Réessayez plus tard.'
}

export default function ParentDashboard() {
  const [userName, setUserName] = useState('')
  const [parentId, setParentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [linkedPlayers, setLinkedPlayers] = useState<LinkedPlayer[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [periods, setPeriods] = useState<PeriodItem[]>([])
  const [weather, setWeather] = useState<WeatherByDate>({})
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [weeklyRating, setWeeklyRating] = useState<RatingValue>({ id: null, rating: null })
  const [ratingSaving, setRatingSaving] = useState(false)
  const [ratingError, setRatingError] = useState('')
  const [error, setError] = useState('')
  const [detailSession, setDetailSession] = useState<SessionItem | null>(null)
  const router = useRouter()
  // Statuts recalculés en direct : "Prévue" → "En cours" → "Faite" sans reload.
  const now = useNow(30000)

  const selectedPlayer = useMemo(
    () => linkedPlayers.find((player) => player.id === selectedPlayerId) || null,
    [linkedPlayers, selectedPlayerId]
  )

  const weekDays = useMemo(() => getWeekDays(currentWeekStart), [currentWeekStart])

  // Bandes de périodes (vue semaine) : une bande continue par semaine.
  const weekBandSegments = useMemo(() => getWeekBandSegments(weekDays, periods), [weekDays, periods])
  const weekBandRows = bandRowCount(weekBandSegments)

  // Vue mois : 6 lignes de semaines, sans scroll.
  const monthWeeks = useMemo(() => {
    if (viewMode !== 'month') return [] as Date[][]
    const firstOfMonth = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), 1)
    const start = startOfWeek(firstOfMonth)
    const days = Array.from({ length: 42 }, (_, index) => addDays(start, index))
    const rows: Date[][] = []
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7))
    return rows
  }, [currentWeekStart, viewMode])

  const calendarTitle = useMemo(() => {
    if (viewMode === 'month') {
      const label = currentWeekStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      return label.charAt(0).toUpperCase() + label.slice(1)
    }
    const end = weekDays[6]
    return `${weekDays[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }, [viewMode, currentWeekStart, weekDays])

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionItem[]>()
    sessions.forEach((session) => {
      const list = map.get(session.date) || []
      list.push(session)
      map.set(session.date, list)
    })
    return map
  }, [sessions])

  useEffect(() => {
    let active = true

    const loadParentData = async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()

        if (authError || !authData.user) {
          router.push('/login')
          return
        }

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, nom, role')
          .eq('id', authData.user.id)
          .single()

        if (userError || !userData) {
          router.push('/login')
          return
        }

        if (userData.role !== 'parent') {
          router.push('/dashboard/coach')
          return
        }

        if (!active) return
        setUserName(userData.nom)
        setParentId(userData.id)

        const { data: linksData, error: linksError } = await supabase
          .from('player_parents')
          .select('player_id')
          .eq('user_id', userData.id)

        if (linksError) {
          throw linksError
        }

        const playerIds = (linksData || []).map((row) => row.player_id)

        if (playerIds.length === 0) {
          if (active) {
            setLinkedPlayers([])
            setSessions([])
            setMatches([])
            setPeriods([])
            setWeeklyRating({ id: null, rating: null })
            setLoading(false)
          }
          return
        }

        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('id, nom')
          .in('id', playerIds)
          .order('nom')

        if (playersError) {
          throw playersError
        }

        const playersList = (playersData || []) as LinkedPlayer[]
        if (active) {
          setLinkedPlayers(playersList)
          setSelectedPlayerId((current) => current || playersList[0]?.id || '')
        }
      } catch (loadError) {
        console.error('Error loading parent dashboard:', loadError)
        if (active) {
          setError('Impossible de charger votre tableau de bord parent.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadParentData()

    return () => {
      active = false
    }
  }, [router])

  // Météo en lecture seule : échec silencieux, rien d'affiché sans données.
  useEffect(() => {
    let active = true

    const loadWeather = async () => {
      try {
        const response = await fetch('/api/weather', { cache: 'no-store' })
        if (!response.ok) return
        const payload = await response.json()
        if (active) {
          setWeather(payload.days || {})
        }
      } catch (weatherError) {
        console.error('Error fetching weather:', weatherError)
      }
    }

    void loadWeather()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedPlayerId || !parentId) return

    let active = true

    const loadSelectedPlayerData = async () => {
      try {
        setError('')
        setRatingError('')

        const [sessionsResult, matchesResult, periodsResult, sessionGoalsResult, goalsResult, ratingResult, sessionCoachesResult] = await Promise.all([
          supabase
            .from('sessions')
            .select('id, player_id, date, heure_debut, heure_fin, localisation, type, statut, notes_coach, prix')
            .eq('player_id', selectedPlayerId)
            .order('date', { ascending: false })
            .order('heure_debut', { ascending: true }),
          supabase.from('matches').select('id, date, adversaire, score, resultat').eq('player_id', selectedPlayerId).order('date', { ascending: false }),
          supabase.from('periods').select('id, player_id, type, nom, date_debut, date_fin, notes, tournament_id, color').eq('player_id', selectedPlayerId).order('date_debut', { ascending: true }),
          supabase.from('session_goals').select('session_id, goal_id'),
          supabase.from('goals').select('id, nom, player_id').eq('player_id', selectedPlayerId).order('nom'),
          supabase
            .from('weekly_ratings')
            .select('id, rating')
            .eq('player_id', selectedPlayerId)
            .eq('week_start_date', formatDateKey(currentWeekStart))
            .eq('parent_id', parentId)
            .maybeSingle(),
          supabase.from('session_coaches').select('session_id, coach_id'),
        ])

        if (!active) return

        const sessionGoalsData = sessionGoalsResult.data || []
        const goalsData = goalsResult.data || []

        // Noms des coachs par séance (sans les montants, réservés au coach).
        const sessionCoachesData = sessionCoachesResult.data || []
        const coachIds = Array.from(new Set(sessionCoachesData.map((row) => row.coach_id)))
        let coachNameMap: Record<string, string> = {}
        if (coachIds.length > 0) {
          const { data: coachesData } = await supabase.from('users').select('id, nom').in('id', coachIds)
          coachNameMap = Object.fromEntries((coachesData || []).map((coach) => [coach.id, coach.nom]))
        }

        const enrichedSessions: SessionItem[] = (sessionsResult.data || []).map((session) => {
          const mappedGoals = sessionGoalsData
            .filter((row) => row.session_id === session.id)
            .map((row) => {
              const goal = goalsData.find((item) => item.id === row.goal_id)
              return { id: row.goal_id, nom: goal?.nom || 'Objectif inconnu' }
            })

          const coachNames = sessionCoachesData
            .filter((row) => row.session_id === session.id)
            .map((row) => coachNameMap[row.coach_id] || 'Coach inconnu')

          return {
            ...session,
            coachNames,
            goals: mappedGoals,
          }
        })

        const tournamentIds = (periodsResult.data || []).map((period) => period.tournament_id).filter(Boolean) as string[]
        let tournamentMap: Record<string, string> = {}
        if (tournamentIds.length > 0) {
          const { data: tournamentsData } = await supabase.from('tournaments').select('id, nom').in('id', tournamentIds)
          tournamentMap = Object.fromEntries((tournamentsData || []).map((tour) => [tour.id, tour.nom]))
        }

        const enrichedPeriods: PeriodItem[] = (periodsResult.data || []).map((period) => ({
          ...period,
          tournament_name: period.tournament_id ? tournamentMap[period.tournament_id] || null : null,
        }))

        if (active) {
          setSessions(enrichedSessions)
          setMatches((matchesResult.data || []) as MatchItem[])
          setPeriods(enrichedPeriods)
          setWeeklyRating({ id: ratingResult.data?.id || null, rating: ratingResult.data?.rating || null })
        }
      } catch (loadError) {
        console.error('Error loading selected player data:', loadError)
        if (active) {
          setError('Impossible de charger les données du joueur sélectionné.')
        }
      }
    }

    void loadSelectedPlayerData()

    return () => {
      active = false
    }
  }, [selectedPlayerId, currentWeekStart, parentId])

  const handleSaveRating = async (value: number) => {
    if (!selectedPlayerId || !parentId) return

    // Mise à jour optimiste : l'étoile réagit tout de suite, on restaure en cas d'échec.
    const previousRating = weeklyRating
    setWeeklyRating((current) => ({ ...current, rating: value }))
    setRatingSaving(true)
    setRatingError('')

    try {
      // UPSERT atomique sur (player_id, week_start_date, parent_id) : crée la note ou
      // met à jour celle de ce parent, sans doublon ni logique insert/update manuelle.
      const { data, error: upsertError } = await supabase
        .from('weekly_ratings')
        .upsert(
          {
            player_id: selectedPlayerId,
            parent_id: parentId,
            week_start_date: formatDateKey(currentWeekStart),
            rating: value,
          },
          { onConflict: 'player_id,week_start_date,parent_id' }
        )
        .select('id')
        .single()

      if (upsertError || !data) throw upsertError || new Error('Unable to save rating')

      setWeeklyRating({ id: data.id, rating: value })
    } catch (saveError) {
      // Log de l'erreur Supabase réelle (code/message/details/hint) pour le debug serveur.
      const err = saveError as { code?: string; message?: string; details?: string; hint?: string; name?: string }
      console.error('Error saving weekly rating:', {
        code: err?.code,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
      })
      setWeeklyRating(previousRating) // revert de l'affichage optimiste
      setRatingError(describeRatingError(err))
    } finally {
      setRatingSaving(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    await fetch('/api/auth/session', { method: 'DELETE' })
    router.push('/login')
  }

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
        <CourtLinesBackground />
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between relative z-10">
          <div>
            <h1 className="text-3xl font-sora font-bold text-[var(--accent-primary)]">Espace parent</h1>
            <p className="text-[var(--text-muted)] mt-1">Bonjour {userName}</p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="secondary" onClick={handleLogout}>Déconnexion</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8 relative z-10">
        {error && <div className="bg-[var(--bg-clay-muted)] border border-[var(--accent-secondary-dark)]/20 text-[var(--accent-secondary-dark)] px-4 py-3 rounded-lg">{error}</div>}

        <Card className="p-6 relative overflow-hidden">
          <TennisServiceSilhouette className="absolute right-0 top-1/2 -translate-y-1/2 w-64 h-64 hidden lg:block text-[var(--accent-secondary)] opacity-10 dark:opacity-[0.08]" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between relative z-10">
            <div>
              <h2 className="text-2xl font-sora font-bold text-[var(--accent-primary)]">Sélection du joueur</h2>
              <p className="text-[var(--text-muted)] mt-1">Basculez entre vos enfants pour consulter leurs séances et progrès.</p>
            </div>
            {linkedPlayers.length > 0 ? (
              <Select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="px-4 py-2 rounded-lg focus:ring-2 focus:ring-[var(--accent-secondary)]"
              >
                {linkedPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.nom}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="text-[var(--text-muted)]">Aucun joueur lié à ce compte parent.</p>
            )}
          </div>
        </Card>

        {selectedPlayer && (
          <>
            <Card className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-sora font-bold text-[var(--accent-primary)]">Calendrier des séances – {selectedPlayer.nom}</h2>
                  <p className="text-[var(--text-muted)] mt-1">
                    {viewMode === 'week'
                      ? 'Vue hebdomadaire simple avec les créneaux de votre enfant.'
                      : 'Vue mensuelle : toutes les semaines du mois, avec les périodes d’entraînement.'}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
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
                  <Button variant="secondary" onClick={() => setCurrentWeekStart(viewMode === 'week' ? addDays(currentWeekStart, -7) : addMonths(currentWeekStart, -1))}>← Précédent</Button>
                  <Button variant="secondary" onClick={() => setCurrentWeekStart(startOfWeek(new Date()))}>Aujourd’hui</Button>
                  <Button variant="secondary" onClick={() => setCurrentWeekStart(viewMode === 'week' ? addDays(currentWeekStart, 7) : addMonths(currentWeekStart, 1))}>Suivant →</Button>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4 text-[var(--text-muted)]">
                <h3 className="text-lg font-sora font-semibold">{calendarTitle}</h3>
              </div>

              {viewMode === 'week' ? (
                <div className="relative">
                  <PeriodBands
                    segments={weekBandSegments}
                    className="absolute inset-x-0 top-11 z-0 hidden md:grid grid-cols-7 gap-x-3"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                    {weekDays.map((day) => {
                      const dateKey = formatDateKey(day)
                      const daySessions = sessionsByDate.get(dateKey) || []
                      return (
                        <div key={dateKey} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 min-h-[180px]">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold text-[var(--text-main)]">{formatDateLabel(day)}</span>
                            <WeatherBadge weather={weather[dateKey]} />
                          </div>
                          <div
                            className="space-y-2 period-band-spacer"
                            style={{ '--period-band-rows': weekBandRows } as CSSProperties}
                          >
                            {daySessions.length === 0 ? (
                              <div className="text-xs text-[var(--text-muted)]/70">Aucune séance</div>
                            ) : (
                              daySessions.map((session) => (
                                <div key={session.id} className="rounded-lg px-3 py-2 text-xs shadow-sm border border-[var(--border-subtle)] bg-[var(--bg-dim)]">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-semibold">{session.heure_debut} - {session.heure_fin}</span>
                                    <SessionStatusBadge session={session} now={now} />
                                  </div>
                                  <div className="opacity-90 mt-1">{getSessionTypeLabel(session.type)}</div>
                                  <div className="opacity-80 mt-1">{session.localisation || 'Lieu à confirmer'}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-card border border-[var(--border-subtle)] bg-[var(--bg-dim)]">
                  <div className="grid grid-cols-7 bg-[var(--bg-card)] text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                      <div key={day} className="px-2 py-2 text-center border-r border-[var(--border-subtle)] last:border-r-0">
                        {day}
                      </div>
                    ))}
                  </div>

                  {monthWeeks.map((week) => {
                    const bandSegments = getWeekBandSegments(week, periods)
                    const bandRows = bandRowCount(bandSegments)
                    return (
                      <div key={formatDateKey(week[0])} className="relative grid grid-cols-7 divide-x divide-[var(--border-subtle)] border-b border-[var(--border-subtle)] last:border-b-0">
                        <PeriodBands segments={bandSegments} className="absolute inset-x-0 top-8 z-0 grid-cols-7" />
                        {week.map((day) => {
                          const dateKey = formatDateKey(day)
                          const daySessions = sessionsByDate.get(dateKey) || []
                          const isCurrentMonth = day.getMonth() === currentWeekStart.getMonth()
                          const isToday = dateKey === formatDateKey(new Date())
                          return (
                            <div key={dateKey} className={`min-h-24 p-2 ${isCurrentMonth ? 'bg-transparent' : 'bg-[var(--bg-dim)] opacity-60'} ${isToday ? 'ring-2 ring-[var(--accent-secondary)] ring-inset' : ''}`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-sm font-semibold ${isCurrentMonth ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>
                                  {day.getDate()}
                                </span>
                                <WeatherBadge weather={weather[dateKey]} />
                              </div>
                              <div className="space-y-1" style={bandRows > 0 ? { marginTop: bandSpacerHeight(bandRows) } : undefined}>
                                {daySessions.slice(0, 2).map((session) => (
                                  <div key={session.id} className="rounded px-1.5 py-1 text-[10px] font-medium border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-main)] truncate">
                                    {session.heure_debut} · {getSessionTypeLabel(session.type)}
                                  </div>
                                ))}
                                {daySessions.length > 2 && (
                                  <div className="text-[10px] text-[var(--text-muted)] px-0.5">+ {daySessions.length - 2} autre(s)</div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-sora font-bold text-[var(--accent-primary)]">Historique des séances</h2>
                  <p className="text-[var(--text-muted)] mt-1">Les séances les plus récentes en premier.</p>
                </div>
              </div>
              {sessions.length === 0 ? (
                <EmptyState message="Aucune séance enregistrée pour ce joueur." />
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div key={session.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-sora font-semibold text-lg text-[var(--text-main)]">{session.date} · {session.heure_debut} - {session.heure_fin}</div>
                          <div className="text-sm text-[var(--text-muted)]">{getSessionTypeLabel(session.type)} · {session.localisation || 'Lieu à confirmer'}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge type={(session.type || 'entrainement') as 'entrainement' | 'echauffement' | 'match'}>{getSessionTypeLabel(session.type)}</Badge>
                          <SessionStatusBadge session={session} now={now} />
                        </div>
                      </div>
                      {session.goals.length > 0 && (
                        <div className="mt-3">
                          <div className="text-sm font-semibold text-[var(--text-muted)] mb-2">Objectifs travaillés</div>
                          <div className="flex flex-wrap gap-2">
                            {session.goals.map((goal) => (
                              <span key={goal.id} className="px-3 py-1 rounded-full bg-[var(--accent-secondary)] text-[var(--accent-primary)] text-xs font-semibold">
                                {goal.nom}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {session.notes_coach && (
                        <div className="mt-3 rounded-lg bg-[var(--bg-dim)] p-3 text-sm text-[var(--text-muted)] whitespace-pre-line">
                          {session.notes_coach}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-sora font-bold text-[var(--accent-primary)]">Historique des matchs</h2>
                  <p className="text-[var(--text-muted)] mt-1">Résultats des matchs joués par votre enfant.</p>
                </div>
              </div>
              {matches.length === 0 ? (
                <EmptyState message="Aucun match enregistré pour ce joueur." />
              ) : (
                <div className="space-y-3">
                  {matches.map((match) => (
                    <div key={match.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-sora font-semibold text-lg text-[var(--text-main)]">{match.date}</div>
                        <div className="text-sm text-[var(--text-muted)]">Adversaire : {match.adversaire || '—'}</div>
                        <div className="text-sm text-[var(--text-muted)]">Score : {match.score || '—'}</div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${match.resultat === 'gagné' ? 'bg-[var(--accent-primary)] text-white' : match.resultat === 'perdu' ? 'bg-[var(--accent-secondary)] text-[var(--text-main)]' : 'bg-[var(--bg-dim)] text-[var(--text-main)]'}`}>
                        {match.resultat || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-sora font-bold text-[var(--accent-primary)]">Périodes en cours / à venir</h2>
                  <p className="text-[var(--text-muted)] mt-1">Préparation et compétition suivies pour ce joueur.</p>
                </div>
              </div>
              {periods.length === 0 ? (
                <EmptyState message="Aucune période enregistrée pour ce joueur." />
              ) : (
                <div className="space-y-3">
                  {periods.map((period) => {
                    const today = new Date().toISOString().slice(0, 10)
                    const isActive = today >= period.date_debut && today <= period.date_fin
                    const isUpcoming = today < period.date_debut
                    return (
                      <div key={period.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="font-sora font-semibold text-lg text-[var(--text-main)]">{period.nom}</div>
                            <div className="text-sm text-[var(--text-muted)]">{period.type} · {period.date_debut} → {period.date_fin}</div>
                            {period.tournament_name && <div className="text-sm text-[var(--text-muted)]">Tournoi lié : {period.tournament_name}</div>}
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isActive ? 'bg-[var(--accent-secondary)] text-[var(--accent-primary)]' : isUpcoming ? 'bg-[var(--bg-dim)] text-[var(--text-main)]' : 'bg-[var(--bg-dim)] text-[var(--text-muted)]'}`}>
                            {isActive ? 'En cours' : isUpcoming ? 'À venir' : 'Terminé'}
                          </span>
                        </div>
                        {period.notes && <p className="mt-3 text-sm text-[var(--text-muted)] whitespace-pre-line">{period.notes}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-sora font-bold text-[var(--accent-primary)]">Notation hebdomadaire</h2>
                  <p className="text-[var(--text-muted)] mt-1">Donnez votre appréciation pour la qualité globale de l’entraînement de cette semaine.</p>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-sora font-semibold text-lg text-[var(--text-main)]"><span className="tabular-nums">Semaine du {formatDateKey(currentWeekStart)}</span></div>
                    <div className="text-sm text-[var(--text-muted)]">Votre note sera sauvegardée pour ce joueur et cette semaine.</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <RatingStars rating={weeklyRating.rating || 0} interactive onChange={handleSaveRating} />
                    {ratingSaving && <span className="text-sm text-[var(--text-muted)]">Sauvegarde…</span>}
                  </div>
                </div>
                {ratingError && <p className="mt-4 text-sm text-[var(--accent-secondary-dark)]">{ratingError}</p>}
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
