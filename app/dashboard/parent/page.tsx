'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { WeatherBadge } from '@/components/ui/WeatherBadge'
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

export default function ParentDashboard() {
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [linkedPlayers, setLinkedPlayers] = useState<LinkedPlayer[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [periods, setPeriods] = useState<PeriodItem[]>([])
  const [weather, setWeather] = useState<WeatherByDate>({})
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [weeklyRating, setWeeklyRating] = useState<RatingValue>({ id: null, rating: null })
  const [ratingSaving, setRatingSaving] = useState(false)
  const [ratingError, setRatingError] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  // Statuts recalculés en direct : "Prévue" → "En cours" → "Faite" sans reload.
  const now = useNow(30000)

  const selectedPlayer = useMemo(
    () => linkedPlayers.find((player) => player.id === selectedPlayerId) || null,
    [linkedPlayers, selectedPlayerId]
  )

  const weekDays = useMemo(() => getWeekDays(currentWeekStart), [currentWeekStart])

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
    if (!selectedPlayerId) return

    let active = true

    const loadSelectedPlayerData = async () => {
      try {
        setError('')
        setRatingError('')

        const [sessionsResult, matchesResult, periodsResult, sessionGoalsResult, goalsResult, ratingResult] = await Promise.all([
          supabase
            .from('sessions')
            .select('id, player_id, date, heure_debut, heure_fin, localisation, type, statut, notes_coach')
            .eq('player_id', selectedPlayerId)
            .order('date', { ascending: false })
            .order('heure_debut', { ascending: true }),
          supabase.from('matches').select('id, date, adversaire, score, resultat').eq('player_id', selectedPlayerId).order('date', { ascending: false }),
          supabase.from('periods').select('id, player_id, type, nom, date_debut, date_fin, notes, tournament_id').eq('player_id', selectedPlayerId).order('date_debut', { ascending: true }),
          supabase.from('session_goals').select('session_id, goal_id'),
          supabase.from('goals').select('id, nom, player_id').eq('player_id', selectedPlayerId).order('nom'),
          supabase
            .from('weekly_ratings')
            .select('id, rating')
            .eq('player_id', selectedPlayerId)
            .eq('week_start', formatDateKey(currentWeekStart))
            .maybeSingle(),
        ])

        if (!active) return

        const sessionGoalsData = sessionGoalsResult.data || []
        const goalsData = goalsResult.data || []

        const enrichedSessions: SessionItem[] = (sessionsResult.data || []).map((session) => {
          const mappedGoals = sessionGoalsData
            .filter((row) => row.session_id === session.id)
            .map((row) => {
              const goal = goalsData.find((item) => item.id === row.goal_id)
              return { id: row.goal_id, nom: goal?.nom || 'Objectif inconnu' }
            })

          return {
            ...session,
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
  }, [selectedPlayerId, currentWeekStart])

  const handleSaveRating = async (value: number) => {
    if (!selectedPlayerId) return

    setRatingSaving(true)
    setRatingError('')

    try {
      if (weeklyRating.id) {
        const { error: updateError } = await supabase
          .from('weekly_ratings')
          .update({ rating: value })
          .eq('id', weeklyRating.id)

        if (updateError) throw updateError
      } else {
        const { data, error: insertError } = await supabase
          .from('weekly_ratings')
          .insert([
            {
              player_id: selectedPlayerId,
              parent_id: (await supabase.auth.getUser()).data.user?.id,
              week_start: formatDateKey(currentWeekStart),
              rating: value,
            },
          ])
          .select('id')
          .single()

        if (insertError || !data) throw insertError || new Error('Unable to save rating')
        setWeeklyRating({ id: data.id, rating: value })
      }

      setWeeklyRating((current) => ({ ...current, rating: value }))
    } catch (saveError) {
      console.error('Error saving weekly rating:', saveError)
      setRatingError('Impossible d’enregistrer la note hebdomadaire.')
    } finally {
      setRatingSaving(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    document.cookie = 'user_name=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
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
                  <p className="text-[var(--text-muted)] mt-1">Vue hebdomadaire simple avec les créneaux de votre enfant.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="secondary" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}>← Précédent</Button>
                  <Button variant="secondary" onClick={() => setCurrentWeekStart(startOfWeek(new Date()))}>Aujourd’hui</Button>
                  <Button variant="secondary" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}>Suivant →</Button>
                </div>
              </div>

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
                      <div className="space-y-2">
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
