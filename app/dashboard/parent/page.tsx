'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatTime } from '@/lib/format-time'
import { Badge } from '@/components/ui/Badge'
import { BouncingBall } from '@/components/ui/BouncingBall'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { StarRating as RatingStars } from '@/components/ui/StarRating'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { CourtLinesBackground } from '@/components/ui/CourtLinesBackground'
import { TennisServiceSilhouette } from '@/components/ui/TennisServiceSilhouette'
import { EmptyState } from '@/components/ui/EmptyState'
import { SessionStatusBadge } from '@/components/ui/SessionStatusBadge'
import { MobileAgenda } from '@/components/ui/MobileAgenda'
import { MatchDetailsModal } from '@/components/MatchDetailsModal'
import { MatchDetailsRow, MATCH_RESULT_LABELS, computeMatchResult, formatScore } from '@/lib/match-stats'
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

type MatchHistoryItem = {
  session: SessionItem
  details: MatchDetailsRow | null
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

type ReclamationItem = {
  id: string
  player_id: string | null
  sujet: string
  message: string
  statut: string
  created_at: string
  coach_ids: string[]
}

function getReclamationLabel(statut: string) {
  switch (statut) {
    case 'en_cours':
      return 'En cours'
    case 'traitee':
      return 'Traitée'
    default:
      return 'Nouvelle'
  }
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
  const [showFullHistory, setShowFullHistory] = useState(false)

  // Nouveau joueur sélectionné : replie l'historique à 3 séances.
  useEffect(() => {
    setShowFullHistory(false)
  }, [selectedPlayerId])

  // Mobile : au chargement, centre l'écran sur la carte du jour.
  useEffect(() => {
    if (!window.matchMedia('(max-width: 767px)').matches) return
    const timer = window.setTimeout(() => {
      document.getElementById('cal-today')?.scrollIntoView({ block: 'center' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [])
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([])
  const [matchSession, setMatchSession] = useState<SessionItem | null>(null)
  const [periods, setPeriods] = useState<PeriodItem[]>([])
  const [weather, setWeather] = useState<WeatherByDate>({})
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [weeklyRating, setWeeklyRating] = useState<RatingValue>({ id: null, rating: null })
  const [ratingSaving, setRatingSaving] = useState(false)
  const [ratingError, setRatingError] = useState('')
  const [error, setError] = useState('')
  const [detailSession, setDetailSession] = useState<SessionItem | null>(null)
  const [reclamations, setReclamations] = useState<ReclamationItem[]>([])
  const [reclamationSujet, setReclamationSujet] = useState('')
  const [reclamationMessage, setReclamationMessage] = useState('')
  const [reclamationSaving, setReclamationSaving] = useState(false)
  const [reclamationError, setReclamationError] = useState('')
  const [reclamationSuccess, setReclamationSuccess] = useState('')
  const [coaches, setCoaches] = useState<Array<{ id: string; nom: string }>>([])
  const [reclamationCoachIds, setReclamationCoachIds] = useState<string[]>([])
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

        // Coachs disponibles : destinataires possibles d'une réclamation.
        const { data: coachesData } = await supabase
          .from('users')
          .select('id, nom')
          .in('role', ['coach', 'coach_admin'])
          .order('nom')

        if (active && coachesData) {
          setCoaches(coachesData)
          // Par défaut, la réclamation part à tous les coachs.
          setReclamationCoachIds((current) => (current.length > 0 ? current : coachesData.map((coach) => coach.id)))
        }

        // Réclamations du parent : échec silencieux si la table n'existe pas
        // encore (migration non exécutée).
        const { data: reclamationsData, error: reclamationsError } = await supabase
          .from('reclamations')
          .select('id, player_id, sujet, message, statut, created_at, coach_ids')
          .eq('parent_id', userData.id)
          .order('created_at', { ascending: false })

        if (active) {
          if (reclamationsError) {
            console.warn('Reclamations unavailable:', reclamationsError.message)
          } else {
            setReclamations(reclamationsData || [])
          }
        }

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
            setMatchHistory([])
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

        const [sessionsResult, periodsResult, sessionGoalsResult, goalsResult, ratingResult, sessionCoachesResult] = await Promise.all([
          supabase
            .from('sessions')
            .select('id, player_id, date, heure_debut, heure_fin, localisation, type, statut, notes_coach, prix')
            .eq('player_id', selectedPlayerId)
            .order('date', { ascending: false })
            .order('heure_debut', { ascending: true }),
          supabase.from('periods').select('id, player_id, type, nom, date_debut, date_fin, notes, tournament_id, color').eq('player_id', selectedPlayerId).order('date_debut', { ascending: true }),
          supabase.from('session_goals').select('session_id, goal_id'),
          supabase.from('goals').select('id, titre, player_id').eq('player_id', selectedPlayerId).order('titre'),
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
              return { id: row.goal_id, nom: goal?.titre || 'Objectif inconnu' }
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

          // Historique des matchs : séances de type « match » + fiche détaillée éventuelle.
          const matchSessions = enrichedSessions.filter((session) => session.type === 'match')
          let detailsBySession: Record<string, MatchDetailsRow> = {}
          if (matchSessions.length > 0) {
            const { data: detailsData } = await supabase
              .from('match_details')
              .select('*')
              .in('session_id', matchSessions.map((session) => session.id))
            for (const detail of detailsData || []) detailsBySession[detail.session_id] = detail as MatchDetailsRow
          }
          setMatchHistory(matchSessions.map((session) => ({ session, details: detailsBySession[session.id] || null })))
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

  const handleSendReclamation = async () => {
    const sujet = reclamationSujet.trim()
    const message = reclamationMessage.trim()
    if (!sujet || !message || !parentId || reclamationCoachIds.length === 0) return

    setReclamationSaving(true)
    setReclamationError('')
    setReclamationSuccess('')

    try {
      const { data, error: insertError } = await supabase
        .from('reclamations')
        .insert({ parent_id: parentId, player_id: selectedPlayerId || null, sujet, message, coach_ids: reclamationCoachIds })
        .select('id, player_id, sujet, message, statut, created_at, coach_ids')
        .single()

      if (insertError || !data) throw insertError || new Error('Reclamation send failed')

      setReclamations((current) => [data, ...current])
      setReclamationSujet('')
      setReclamationMessage('')
      setReclamationSuccess('Réclamation envoyée au coach.')
    } catch (sendError) {
      console.error('Error sending reclamation:', sendError)
      setReclamationError('Impossible d’envoyer la réclamation. Réessayez plus tard.')
    } finally {
      setReclamationSaving(false)
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
            <h1 className="text-[28px] md:text-[32px] font-sora font-bold tracking-tight text-[var(--text-main)]">Espace parent</h1>
            <p className="text-[var(--text-muted)] mt-1">Bonjour {userName}</p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="secondary" onClick={handleLogout}>Déconnexion</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-5 relative z-10">
        {error && <div className="bg-[var(--bg-clay-muted)] border border-[var(--accent-secondary-dark)]/20 text-[var(--accent-secondary-dark)] px-4 py-3 rounded-lg">{error}</div>}

        <Card className="p-6 relative overflow-hidden">
          <TennisServiceSilhouette className="absolute right-0 top-1/2 -translate-y-1/2 w-64 h-64 hidden lg:block text-[var(--accent-secondary)] opacity-10 dark:opacity-[0.08]" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between relative z-10">
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Sélection du joueur</h2>
              <p className="text-[var(--text-muted)] mt-1">Basculez entre vos enfants pour consulter leurs séances et progrès.</p>
            </div>
            {linkedPlayers.length > 0 ? (
              <Select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
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
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-4">
                <div>
                  <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Calendrier des séances – {selectedPlayer.nom}</h2>
                  <p className="text-[var(--text-muted)] mt-1">
                    {viewMode === 'week'
                      ? 'Vue hebdomadaire simple avec les créneaux de votre enfant.'
                      : 'Vue mensuelle : toutes les semaines du mois, avec les périodes d’entraînement.'}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <SegmentedControl
                    options={[
                      { value: 'week', label: 'Semaine' },
                      { value: 'month', label: 'Mois' },
                    ]}
                    value={viewMode}
                    onChange={(mode) => setViewMode(mode)}
                  />
                  <div className="inline-flex items-center rounded-full bg-[var(--bg-inset)] p-1">
                    <button
                      type="button"
                      onClick={() => setCurrentWeekStart(viewMode === 'week' ? addDays(currentWeekStart, -7) : addMonths(currentWeekStart, -1))}
                      className="px-4 min-h-[36px] rounded-full text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-neutral-muted)] active:scale-95 active:opacity-90 transition"
                    >
                      ← Précédent
                    </button>
                    <span className="w-px h-5 bg-[var(--border-subtle)]" aria-hidden />
                    <button
                      type="button"
                      onClick={() => setCurrentWeekStart(startOfWeek(new Date()))}
                      className="px-4 min-h-[36px] rounded-full text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-neutral-muted)] active:scale-95 active:opacity-90 transition"
                    >
                      Aujourd’hui
                    </button>
                    <span className="w-px h-5 bg-[var(--border-subtle)]" aria-hidden />
                    <button
                      type="button"
                      onClick={() => setCurrentWeekStart(viewMode === 'week' ? addDays(currentWeekStart, 7) : addMonths(currentWeekStart, 1))}
                      className="px-4 min-h-[36px] rounded-full text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-neutral-muted)] active:scale-95 active:opacity-90 transition"
                    >
                      Suivant →
                    </button>
                  </div>
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
                      const isToday = dateKey === formatDateKey(new Date())
                      return (
                        <div key={dateKey} id={isToday ? 'cal-today' : undefined} className={`rounded-2xl p-4 min-h-[180px] ${isToday ? 'bg-[var(--bg-clay-muted)] ring-2 ring-[var(--accent-cta)]' : 'bg-[var(--bg-card)]'}`}>
                          <div className="flex items-center justify-between mb-3">
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-main)]">
                              {formatDateLabel(day)}
                              {isToday && (
                                <span className="rounded-full bg-[var(--accent-cta)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-main)]">
                                  Aujourd’hui
                                </span>
                              )}
                            </span>
                            <WeatherBadge weather={weather[dateKey]} />
                          </div>
                          {/* Chips périodes visibles uniquement sur mobile (bandes masquées). */}
                          {periods.some((p) => p.date_debut <= dateKey && p.date_fin >= dateKey) && (
                            <div className="mb-2 flex flex-wrap gap-1.5 md:hidden">
                              {periods
                                .filter((p) => p.date_debut <= dateKey && p.date_fin >= dateKey)
                                .map((p) => (
                                  <span key={p.id} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-[var(--bg-dim)] text-[var(--text-main)]">
                                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color || 'var(--accent-secondary)' }} />
                                    {p.nom}
                                  </span>
                                ))}
                            </div>
                          )}
                          <div
                            className="space-y-2 period-band-spacer"
                            style={{ '--period-band-rows': weekBandRows } as CSSProperties}
                          >
                            {daySessions.length === 0 ? (
                              <div className="text-xs text-[var(--text-muted)]/70">Aucune séance</div>
                            ) : (
                              daySessions.map((session) => (
                                <div
                                  key={session.id}
                                  onClick={() => setDetailSession(session)}
                                  title="Voir les détails de la séance"
                                  className="rounded-xl px-3 py-2.5 text-xs bg-[var(--bg-card-nested)] cursor-pointer hover:opacity-90 active:scale-[0.98] transition"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-semibold">{formatTime(session.heure_debut)} - {formatTime(session.heure_fin)}</span>
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
                <div className="overflow-hidden rounded-2xl bg-[var(--bg-card)] hidden md:block">
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
                            <div key={dateKey} className={`min-h-24 p-2 ${isToday ? 'bg-[var(--bg-clay-muted)] ring-2 ring-[var(--accent-cta)] ring-inset' : isCurrentMonth ? 'bg-transparent' : 'bg-[var(--bg-dim)] opacity-60'}`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-sm font-semibold ${isCurrentMonth ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>
                                  {day.getDate()}
                                </span>
                                <WeatherBadge weather={weather[dateKey]} />
                              </div>
                              <div className="space-y-1" style={bandRows > 0 ? { marginTop: bandSpacerHeight(bandRows) } : undefined}>
                                {daySessions.slice(0, 2).map((session) => (
                                  <div
                                    key={session.id}
                                    onClick={() => setDetailSession(session)}
                                    title="Voir les détails de la séance"
                                    className="rounded-md px-1.5 py-1 text-[10px] font-medium bg-[var(--bg-card-nested)] text-[var(--text-main)] truncate cursor-pointer hover:opacity-90 active:scale-[0.98] transition"
                                  >
                                    {formatTime(session.heure_debut)} · {getSessionTypeLabel(session.type)}
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

              {/* Agenda mobile pour la vue mois : la grille 7 colonnes est illisible sous md. */}
              {viewMode === 'month' && (
                <div className="md:hidden">
                  <MobileAgenda
                    days={monthWeeks.flat().filter((day) => day.getMonth() === currentWeekStart.getMonth())}
                    sessionsFor={(key) =>
                      (sessionsByDate.get(key) || []).map((session) => ({
                        id: session.id,
                        date: session.date,
                        heure_debut: session.heure_debut,
                        heure_fin: session.heure_fin,
                        type: session.type,
                        statut: session.statut,
                        label: getSessionTypeLabel(session.type),
                        sublabel: session.localisation || undefined,
                      }))
                    }
                    periodsFor={(key) =>
                      periods
                        .filter((period) => period.date_debut <= key && period.date_fin >= key)
                        .map((period) => ({ id: period.id, nom: period.nom, color: period.color }))
                    }
                    weather={weather}
                    now={now}
                    showEmptyDays={false}
                    onSessionClick={(id) => {
                      const session = sessions.find((item) => item.id === id)
                      if (session) setDetailSession(session)
                    }}
                    emptyMessage="Aucune séance ce jour."
                  />
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Historique des séances</h2>
                  <p className="text-[var(--text-muted)] mt-1">Les séances les plus récentes en premier.</p>
                </div>
              </div>
              {sessions.length === 0 ? (
                <EmptyState message="Aucune séance enregistrée pour ce joueur." />
              ) : (
                <div className="space-y-4">
                  {(showFullHistory ? sessions : sessions.slice(0, 3)).map((session) => (
                    <div key={session.id} className="rounded-2xl bg-[var(--bg-card-nested)] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-sora font-semibold text-lg text-[var(--text-main)]">{session.date} · {formatTime(session.heure_debut)} - {formatTime(session.heure_fin)}</div>
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
                  {!showFullHistory && sessions.length > 3 && (
                    <Button variant="secondary" className="w-full" onClick={() => setShowFullHistory(true)}>
                      Afficher plus ({sessions.length - 3} séance{sessions.length - 3 > 1 ? 's' : ''} plus ancienne{sessions.length - 3 > 1 ? 's' : ''})
                    </Button>
                  )}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Historique des matchs</h2>
                  <p className="text-[var(--text-muted)] mt-1">Résultats des matchs joués par votre enfant.</p>
                </div>
              </div>
              {matchHistory.length === 0 ? (
                <EmptyState message="Aucun match enregistré pour ce joueur." />
              ) : (
                <div className="space-y-4">
                  {(() => {
                    const results = matchHistory.map((item) =>
                      item.details ? computeMatchResult(item.details.sets, item.details.result_override) : null
                    )
                    const wins = results.filter((result) => result === 'victoire').length
                    const losses = results.filter((result) => result === 'defaite').length
                    const decided = wins + losses
                    return (
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-input bg-[var(--bg-green-muted)] px-3 py-3">
                          <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] tabular-nums">{wins}</div>
                          <div className="text-xs font-semibold text-[var(--text-muted)]">Victoires</div>
                        </div>
                        <div className="rounded-input bg-[var(--bg-clay-muted)] px-3 py-3">
                          <div className="text-2xl font-sora font-bold text-[var(--accent-secondary-dark)] tabular-nums">{losses}</div>
                          <div className="text-xs font-semibold text-[var(--text-muted)]">Défaites</div>
                        </div>
                        <div className="rounded-input bg-[var(--bg-dim)] px-3 py-3">
                          <div className="text-2xl font-sora font-bold text-[var(--text-main)] tabular-nums">{decided > 0 ? `${Math.round((wins / decided) * 100)} %` : '—'}</div>
                          <div className="text-xs font-semibold text-[var(--text-muted)]">Réussite</div>
                        </div>
                      </div>
                    )
                  })()}
                  <p className="text-xs text-[var(--text-muted)]">Touchez un match pour saisir ou consulter la fiche complète (statistiques, export PDF).</p>
                  <div className="space-y-3">
                    {matchHistory.map((item) => {
                      const result = item.details ? computeMatchResult(item.details.sets, item.details.result_override) : null
                      return (
                        <button
                          key={item.session.id}
                          type="button"
                          onClick={() => setMatchSession(item.session)}
                          className="w-full text-left rounded-2xl bg-[var(--bg-card-nested)] p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between hover:opacity-90 transition cursor-pointer"
                        >
                          <div>
                            <div className="font-sora font-semibold text-lg text-[var(--text-main)]">{item.session.date}</div>
                            <div className="text-sm text-[var(--text-muted)]">Adversaire : {item.details?.adversaire || '—'}</div>
                            <div className="text-sm text-[var(--text-muted)]">Score : {item.details ? formatScore(item.details.sets) : '—'}</div>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold self-start md:self-center ${
                              result === 'victoire'
                                ? 'bg-[var(--bg-green-muted)] text-[var(--accent-primary)]'
                                : result === 'defaite'
                                  ? 'bg-[var(--bg-clay-muted)] text-[var(--accent-secondary-dark)]'
                                  : 'bg-[var(--bg-dim)] text-[var(--text-muted)]'
                            }`}
                          >
                            {result ? MATCH_RESULT_LABELS[result] : 'Fiche à saisir'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Périodes en cours / à venir</h2>
                  <p className="text-[var(--text-muted)] mt-1">Préparation et compétition suivies pour ce joueur.</p>
                </div>
              </div>
              {periods.length === 0 ? (
                <EmptyState message="Aucune période enregistrée pour ce joueur." />
              ) : (
                <div className="space-y-3">
                  {periods.map((period) => {
                    const today = formatDateKey(new Date())
                    const isActive = today >= period.date_debut && today <= period.date_fin
                    const isUpcoming = today < period.date_debut
                    return (
                      <div key={period.id} className="rounded-2xl bg-[var(--bg-card-nested)] p-4">
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

          </>
        )}

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Réclamations</h2>
              <p className="text-[var(--text-muted)] mt-1">Signalez un problème ou une remarque au coach.</p>
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--bg-card-nested)] p-5 space-y-4">
            {reclamationError && <p className="text-sm text-[var(--accent-secondary-dark)]">{reclamationError}</p>}
            {reclamationSuccess && <p className="text-sm text-[var(--accent-primary)]">{reclamationSuccess}</p>}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Sujet</label>
              <input
                type="text"
                value={reclamationSujet}
                onChange={(e) => setReclamationSujet(e.target.value)}
                maxLength={200}
                className="w-full px-4 py-2.5 bg-[var(--bg-inset)] border border-transparent rounded-input focus:outline-none focus:ring-2 focus:ring-[var(--accent-cta)]/25 text-[var(--text-main)] placeholder:text-[var(--text-muted)]/60"
                placeholder="Ex : créneau de mercredi à décaler"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Message</label>
              <textarea
                value={reclamationMessage}
                onChange={(e) => setReclamationMessage(e.target.value)}
                maxLength={2000}
                className="w-full px-4 py-3 bg-[var(--bg-inset)] border border-transparent rounded-input focus:outline-none focus:ring-2 focus:ring-[var(--accent-cta)]/25 text-[var(--text-main)] placeholder:text-[var(--text-muted)]/60 min-h-[100px]"
                placeholder="Décrivez votre réclamation..."
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Envoyer à</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReclamationCoachIds(coaches.map((coach) => coach.id))}
                  className={`px-4 py-2 min-h-[44px] rounded-full text-sm font-semibold transition active:scale-95 active:opacity-90 ${
                    reclamationCoachIds.length === coaches.length && coaches.length > 0
                      ? 'bg-[var(--accent-cta)] text-[var(--text-main)]'
                      : 'bg-[var(--bg-inset)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Tous les coachs
                </button>
                {coaches.map((coach) => {
                  const selected = reclamationCoachIds.includes(coach.id)
                  return (
                    <button
                      key={coach.id}
                      type="button"
                      onClick={() =>
                        setReclamationCoachIds((current) =>
                          selected ? current.filter((id) => id !== coach.id) : [...current, coach.id]
                        )
                      }
                      className={`px-4 py-2 min-h-[44px] rounded-full text-sm font-semibold transition active:scale-95 active:opacity-90 ${
                        selected
                          ? 'bg-[var(--accent-cta)] text-[var(--text-main)]'
                          : 'bg-[var(--bg-inset)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      {coach.nom}
                    </button>
                  )
                })}
              </div>
              {reclamationCoachIds.length === 0 && (
                <p className="mt-2 text-xs text-[var(--accent-secondary-dark)]">Sélectionnez au moins un coach destinataire.</p>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                variant="accent"
                onClick={() => void handleSendReclamation()}
                disabled={reclamationSaving || reclamationSujet.trim() === '' || reclamationMessage.trim() === '' || reclamationCoachIds.length === 0}
              >
                {reclamationSaving ? 'Envoi...' : 'Envoyer la réclamation'}
              </Button>
            </div>
          </div>

          {reclamations.length > 0 && (
            <div className="space-y-3 mt-6">
              {reclamations.map((item) => (
                <div key={item.id} className="rounded-2xl bg-[var(--bg-card-nested)] p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="font-sora font-semibold text-[var(--text-main)]">{item.sujet}</div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${item.statut === 'traitee' ? 'bg-[var(--bg-green-muted)] text-[var(--accent-primary)]' : item.statut === 'en_cours' ? 'bg-[var(--bg-yellow-muted)] text-[var(--text-main)]' : 'bg-[var(--bg-clay-muted)] text-[var(--accent-secondary-dark)]'}`}>
                      {getReclamationLabel(item.statut)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-muted)] whitespace-pre-line">{item.message}</p>
                  <div className="mt-2 text-xs text-[var(--text-muted)]/80">
                    {new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {item.player_id ? ` · ${linkedPlayers.find((player) => player.id === item.player_id)?.nom || 'Joueur'}` : ''}
                    {` · Envoyé à : ${
                      !item.coach_ids || item.coach_ids.length === 0 || item.coach_ids.length === coaches.length
                        ? 'Tous les coachs'
                        : item.coach_ids.map((id) => coaches.find((coach) => coach.id === id)?.nom || 'Coach').join(', ')
                    }`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {selectedPlayer && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Notation hebdomadaire</h2>
                <p className="text-[var(--text-muted)] mt-1">Donnez votre appréciation pour la qualité globale de l’entraînement de cette semaine.</p>
              </div>
            </div>

            <div className="rounded-2xl bg-[var(--bg-card-nested)] p-5">
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
        )}
      </main>

      {detailSession && (
        <div className="fixed inset-0 z-50 bg-[var(--text-main)]/60 backdrop-blur-sm flex items-start md:items-center justify-center p-0 md:p-4 overflow-y-auto">
          <div className="bg-[var(--bg-card)] text-[var(--text-main)] w-full max-w-2xl rounded-none md:rounded-card shadow-2xl p-5 md:p-8 my-0 md:my-6 min-h-full md:min-h-0 border border-[var(--border-strong)]">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-sora font-bold text-[var(--text-main)]">Détails de la séance</h3>
                <p className="text-[var(--text-muted)] mt-1">{selectedPlayer?.nom}</p>
              </div>
              <button
                onClick={() => setDetailSession(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-2xl leading-none"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 text-sm text-[var(--text-main)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-input bg-[var(--bg-dim)] p-4"><strong>Date :</strong> {detailSession.date}</div>
                <div className="rounded-input bg-[var(--bg-dim)] p-4"><strong>Heure :</strong> {formatTime(detailSession.heure_debut)} - {formatTime(detailSession.heure_fin)}</div>
                <div className="rounded-input bg-[var(--bg-dim)] p-4"><strong>Type :</strong> {getSessionTypeLabel(detailSession.type)}</div>
                <div className="rounded-input bg-[var(--bg-dim)] p-4"><strong>Statut :</strong> {EFFECTIVE_STATUS_LABELS[getEffectiveStatus(detailSession, now)]}</div>
                <div className="rounded-input bg-[var(--bg-dim)] p-4"><strong>Localisation :</strong> {detailSession.localisation || '—'}</div>
                <div className="rounded-input bg-[var(--bg-dim)] p-4"><strong>Prix :</strong> {detailSession.prix !== null ? `${detailSession.prix} DT` : '—'}</div>
              </div>

              <div className="rounded-input bg-[var(--bg-dim)] p-4">
                <strong>Notes coach :</strong>
                <p className="mt-2 whitespace-pre-line text-[var(--text-muted)]">{detailSession.notes_coach || '—'}</p>
              </div>

              <div className="rounded-input bg-[var(--bg-dim)] p-4">
                <strong>Coachs assignés :</strong>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detailSession.coachNames.length === 0 ? (
                    <span className="text-[var(--text-muted)]">Aucun coach assigné.</span>
                  ) : (
                    detailSession.coachNames.map((name) => (
                      <span key={name} className="px-3 py-1 rounded-full bg-[var(--accent-primary)] text-white text-xs font-semibold">
                        {name}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-input bg-[var(--bg-dim)] p-4">
                <strong>Objectifs travaillés :</strong>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detailSession.goals.length === 0 ? (
                    <span className="text-[var(--text-muted)]">Aucun objectif lié.</span>
                  ) : (
                    detailSession.goals.map((goal) => (
                      <span key={goal.id} className="px-3 py-1 rounded-full bg-[var(--accent-secondary)] text-[var(--accent-primary)] text-xs font-semibold">
                        {goal.nom}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              {detailSession.type === 'match' && (
                <button
                  onClick={() => {
                    setMatchSession(detailSession)
                    setDetailSession(null)
                  }}
                  className="px-5 py-3 rounded-input bg-[var(--accent-cta)] text-[var(--text-main)] font-semibold shadow hover:opacity-95 transition"
                >
                  Statistiques du match
                </button>
              )}
              <button
                onClick={() => setDetailSession(null)}
                className="px-5 py-3 rounded-input border border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--bg-dim)] transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {matchSession && selectedPlayer && (
        <MatchDetailsModal
          sessionId={matchSession.id}
          playerId={matchSession.player_id}
          playerName={selectedPlayer.nom}
          sessionDate={matchSession.date}
          onClose={() => setMatchSession(null)}
        />
      )}
    </div>
  )
}
