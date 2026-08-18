'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BouncingBall } from '@/components/ui/BouncingBall'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { EmptyState } from '@/components/ui/EmptyState'
import { BackButton } from '@/components/ui/BackButton'
import { CoachBottomNav } from '@/components/CoachBottomNav'
import { Select } from '@/components/ui/Select'
import { StarRating } from '@/components/ui/StarRating'

type ReclamationStatut = 'nouvelle' | 'en_cours' | 'traitee'

type ReclamationItem = {
  id: string
  parent_id: string
  player_id: string | null
  sujet: string
  message: string
  statut: string
  created_at: string
  parentNom: string
  playerNom: string | null
  coach_ids: string[]
}

type WeeklyRatingRow = {
  id: string
  playerId: string
  playerName: string
  parentName: string
  weekStart: string
  rating: number
}

type StatutFilter = 'toutes' | ReclamationStatut

const statutOptions: Array<{ value: StatutFilter; label: string }> = [
  { value: 'toutes', label: 'Toutes' },
  { value: 'nouvelle', label: 'Nouvelles' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'traitee', label: 'Traitées' },
]

function getStatutLabel(statut: string) {
  switch (statut) {
    case 'en_cours':
      return 'En cours'
    case 'traitee':
      return 'Traitée'
    default:
      return 'Nouvelle'
  }
}

function getStatutBadgeStyle(statut: string) {
  switch (statut) {
    case 'traitee':
      return 'bg-[var(--bg-green-muted)] text-[var(--accent-primary)]'
    case 'en_cours':
      return 'bg-[var(--bg-yellow-muted)] text-[var(--text-main)]'
    default:
      return 'bg-[var(--bg-clay-muted)] text-[var(--accent-secondary-dark)]'
  }
}

export default function CoachReclamationsPage() {
  const [userName, setUserName] = useState('')
  const [reclamations, setReclamations] = useState<ReclamationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statutFilter, setStatutFilter] = useState<StatutFilter>('toutes')
  const [savingId, setSavingId] = useState('')
  const [coaches, setCoaches] = useState<Array<{ id: string; nom: string }>>([])
  const [players, setPlayers] = useState<Array<{ id: string; nom: string }>>([])
  const [ratings, setRatings] = useState<WeeklyRatingRow[]>([])
  const [ratingsPlayerFilter, setRatingsPlayerFilter] = useState('')
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    const loadPage = async () => {
      try {
        const { data, error: authError } = await supabase.auth.getUser()

        if (authError || !data.user) {
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

        const { data: rows, error: reclamationsError } = await supabase
          .from('reclamations')
          .select('id, parent_id, player_id, sujet, message, statut, created_at, coach_ids, parent:users!reclamations_parent_id_fkey(nom), player:players!reclamations_player_id_fkey(nom)')
          .order('created_at', { ascending: false })

        if (reclamationsError) throw reclamationsError

        const { data: coachesData } = await supabase
          .from('users')
          .select('id, nom')
          .in('role', ['coach', 'coach_admin'])
          .order('nom')

        // Notations hebdomadaires des parents (même présentation que la page joueurs).
        const { data: playersData } = await supabase.from('players').select('id, nom').order('nom')
        const { data: ratingsData, error: ratingsError } = await supabase
          .from('weekly_ratings')
          .select('id, player_id, parent_id, week_start_date, rating')
          .order('week_start_date', { ascending: false })

        if (ratingsError) {
          console.warn('Weekly ratings unavailable:', ratingsError.message)
        }

        if (mounted) {
          setUserName(userData.nom)
          setCoaches(coachesData || [])
          setPlayers(playersData || [])

          if (ratingsData && ratingsData.length > 0) {
            const parentIds = Array.from(new Set(ratingsData.map((row) => row.parent_id).filter(Boolean))) as string[]
            let parentMap: Record<string, string> = {}
            if (parentIds.length > 0) {
              const { data: parentsData } = await supabase.from('users').select('id, nom').in('id', parentIds)
              parentMap = Object.fromEntries((parentsData || []).map((user) => [user.id, user.nom]))
            }
            const playerMap = Object.fromEntries((playersData || []).map((player) => [player.id, player.nom]))
            setRatings(
              ratingsData.map((row) => ({
                id: row.id,
                playerId: row.player_id,
                playerName: playerMap[row.player_id] || 'Joueur inconnu',
                parentName: row.parent_id ? parentMap[row.parent_id] || 'Parent inconnu' : '—',
                weekStart: row.week_start_date,
                rating: row.rating,
              }))
            )
          }
          setReclamations(
            (rows || []).map((row: any) => ({
              id: row.id,
              parent_id: row.parent_id,
              player_id: row.player_id,
              sujet: row.sujet,
              message: row.message,
              statut: row.statut,
              created_at: row.created_at,
              parentNom: row.parent?.nom || 'Parent',
              playerNom: row.player?.nom || null,
              coach_ids: row.coach_ids || [],
            }))
          )
        }
      } catch (pageError) {
        console.error('Error loading reclamations:', pageError)
        if (mounted) {
          setError('Impossible de charger les réclamations. Vérifiez que la migration « reclamations » a bien été exécutée.')
        }
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

  const handleChangeStatut = async (reclamation: ReclamationItem, statut: ReclamationStatut) => {
    if (reclamation.statut === statut) return

    setSavingId(reclamation.id)
    const previousStatut = reclamation.statut

    // Mise à jour optimiste, annulée en cas d'échec.
    setReclamations((current) => current.map((item) => (item.id === reclamation.id ? { ...item, statut } : item)))

    try {
      const { error: updateError } = await supabase
        .from('reclamations')
        .update({ statut })
        .eq('id', reclamation.id)

      if (updateError) throw updateError
    } catch (updateError) {
      console.error('Error updating reclamation statut:', updateError)
      setReclamations((current) => current.map((item) => (item.id === reclamation.id ? { ...item, statut: previousStatut } : item)))
      setError('Impossible de mettre à jour le statut de cette réclamation.')
    } finally {
      setSavingId('')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    await fetch('/api/auth/session', { method: 'DELETE' })
    router.push('/login')
  }

  const filteredReclamations = useMemo(
    () => (statutFilter === 'toutes' ? reclamations : reclamations.filter((item) => item.statut === statutFilter)),
    [reclamations, statutFilter]
  )

  const filteredRatings = useMemo(
    () => (ratingsPlayerFilter ? ratings.filter((row) => row.playerId === ratingsPlayerFilter) : ratings),
    [ratings, ratingsPlayerFilter]
  )

  const nouvelleCount = reclamations.filter((item) => item.statut === 'nouvelle').length

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BouncingBall size="md" />
      </div>
    )
  }

  return (
    <div className="min-h-screen animate-fade-in">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-main)]">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-3xl font-sora font-bold text-[var(--accent-primary)]">Réclamations des parents</h1>
              <p className="text-[var(--text-muted)] mt-1">
                Bonjour {userName}
                {nouvelleCount > 0 ? ` · ${nouvelleCount} nouvelle${nouvelleCount > 1 ? 's' : ''} à traiter` : ' · Aucune nouvelle réclamation'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="secondary" onClick={handleLogout}>Déconnexion</Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-10 pb-24 md:pb-10 space-y-6">
        {error && (
          <div className="rounded-input border border-[var(--border-strong)] bg-[var(--bg-clay-muted)] px-4 py-3 text-sm text-[var(--accent-secondary-dark)]">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {statutOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setStatutFilter(option.value)}
              className={`px-4 py-2 rounded-input text-sm font-semibold transition border ${
                statutFilter === option.value
                  ? 'bg-[var(--accent-cta)] text-white border-transparent'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-strong)] hover:bg-[var(--bg-dim)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {filteredReclamations.length === 0 ? (
          <EmptyState title="Aucune réclamation" message="Aucune réclamation ne correspond à ce filtre pour le moment." />
        ) : (
          filteredReclamations.map((item) => (
            <Card key={item.id} className="p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-sora font-bold text-[var(--text-main)]">{item.sujet}</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatutBadgeStyle(item.statut)}`}>
                      {getStatutLabel(item.statut)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    De {item.parentNom}
                    {item.playerNom ? ` · Joueur : ${item.playerNom}` : ''}
                    {' · '}
                    {new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {' · Envoyé à : '}
                    {item.coach_ids.length === 0 || item.coach_ids.length === coaches.length
                      ? 'Tous les coachs'
                      : item.coach_ids.map((id) => coaches.find((coach) => coach.id === id)?.nom || 'Coach').join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={item.statut === 'traitee'}
                      disabled={savingId === item.id}
                      onChange={(e) => void handleChangeStatut(item, e.target.checked ? 'traitee' : 'en_cours')}
                      className="w-4 h-4 accent-[var(--accent-primary)]"
                    />
                    Marquer comme traitée
                  </label>
                  {(['nouvelle', 'en_cours', 'traitee'] as ReclamationStatut[]).map((statut) => (
                    <button
                      key={statut}
                      onClick={() => void handleChangeStatut(item, statut)}
                      disabled={savingId === item.id}
                      className={`px-3 py-1.5 rounded-input text-xs font-semibold transition border disabled:opacity-60 ${
                        item.statut === statut
                          ? 'bg-[var(--accent-primary)] text-white border-transparent'
                          : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-strong)] hover:bg-[var(--bg-dim)]'
                      }`}
                    >
                      {getStatutLabel(statut)}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-4 text-sm text-[var(--text-main)] whitespace-pre-line rounded-input bg-[var(--bg-dim)] p-4">
                {item.message}
              </p>
            </Card>
          ))
        )}

        <Card className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h2 className="text-2xl font-sora font-bold text-[var(--accent-primary)]">Notations hebdomadaires des parents</h2>
              <p className="text-[var(--text-muted)] mt-1">Appréciation de la semaine d’entraînement laissée par les parents pour chaque joueur.</p>
            </div>
            {players.length > 0 && (
              <Select
                value={ratingsPlayerFilter}
                onChange={(e) => setRatingsPlayerFilter(e.target.value)}
                className="px-4 py-2 rounded-lg focus:ring-2 focus:ring-[var(--accent-secondary)]"
              >
                <option value="">Tous les joueurs</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.nom}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {filteredRatings.length === 0 ? (
            <EmptyState message="Aucune notation hebdomadaire pour l’instant." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
              <table className="min-w-full divide-y divide-[var(--border-subtle)] bg-[var(--bg-card)]">
                <thead className="bg-[var(--bg-dim)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Joueur</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Semaine du</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Note</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Parent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filteredRatings.map((row) => (
                    <tr key={row.id} className="hover:bg-[var(--bg-dim)] transition">
                      <td className="px-4 py-4 font-medium text-[var(--text-main)]">{row.playerName}</td>
                      <td className="px-4 py-4 text-[var(--text-muted)] font-sora font-semibold tabular-nums">{row.weekStart}</td>
                      <td className="px-4 py-4"><StarRating rating={row.rating} /></td>
                      <td className="px-4 py-4 text-[var(--text-muted)]">{row.parentName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>

      <CoachBottomNav />
    </div>
  )
}
