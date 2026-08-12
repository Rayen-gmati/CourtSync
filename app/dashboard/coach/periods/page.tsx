'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchAllPeriods, type PeriodRow } from '@/lib/periods'
import { pickPeriodColor, periodColor } from '@/lib/period-colors'
import { Badge } from '@/components/ui/Badge'
import { BouncingBall } from '@/components/ui/BouncingBall'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { EmptyState } from '@/components/ui/EmptyState'
import { BackButton } from '@/components/ui/BackButton'


type PlayerOption = {
  id: string
  nom: string
}

type TournamentOption = {
  id: string
  nom: string
  player_id: string | null
}

type PeriodFormState = {
  playerId: string
  type: string
  nom: string
  dateDebut: string
  dateFin: string
  tournamentId: string
  notes: string
}

function createEmptyForm(): PeriodFormState {
  return {
    playerId: '',
    type: 'preparation',
    nom: '',
    dateDebut: '',
    dateFin: '',
    tournamentId: '',
    notes: '',
  }
}

function getPeriodTypeLabel(value: string | null | undefined) {
  switch (value) {
    case 'preparation':
      return 'Préparation'
    case 'competition':
      return 'Compétition'
    default:
      return value || '—'
  }
}

// La contrainte periods_type_check n'accepte que 'preparation' / 'competition'
// (sans accents) : on normalise toute valeur entrante avant l'insertion.
function normalizePeriodType(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return normalized === 'competition' ? 'competition' : 'preparation'
}

export default function CoachPeriodsPage() {
  const [userName, setUserName] = useState('')
  const [players, setPlayers] = useState<PlayerOption[]>([])
  const [tournaments, setTournaments] = useState<TournamentOption[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedPlayerFilter, setSelectedPlayerFilter] = useState('')
  const [form, setForm] = useState<PeriodFormState>(createEmptyForm())
  const router = useRouter()

  const filteredPeriods = useMemo(() => {
    return selectedPlayerFilter ? periods.filter((period) => period.player_id === selectedPlayerFilter) : periods
  }, [periods, selectedPlayerFilter])

  const currentPlayerTournaments = useMemo(() => {
    return form.playerId ? tournaments.filter((tournament) => tournament.player_id === form.playerId) : []
  }, [form.playerId, tournaments])

  const refreshData = async () => {
    const [playersResult, tournamentsResult, periodsData] = await Promise.all([
      supabase.from('players').select('id, nom').order('nom'),
      supabase.from('tournaments').select('id, nom, player_id').order('nom'),
      fetchAllPeriods(),
    ])

    if (playersResult.data) setPlayers(playersResult.data)
    if (tournamentsResult.data) setTournaments(tournamentsResult.data)
    setPeriods(periodsData)
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

        await refreshData()
      } catch (pageError) {
        console.error('Error loading periods page:', pageError)
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    await fetch('/api/auth/session', { method: 'DELETE' })
    router.push('/login')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      // Couleur déterministe (hash nom + joueur + date), stockée en base à la
      // création, et différente de la période précédente du même joueur.
      const previous = periods
        .filter((item) => item.player_id === form.playerId && item.date_debut < form.dateDebut)
        .sort((a, b) => b.date_debut.localeCompare(a.date_debut))[0]
      const color = pickPeriodColor(
        `${form.nom}|${form.playerId}|${form.dateDebut}`,
        previous ? periodColor(previous) : null
      )

      const payload = {
        player_id: form.playerId,
        type: normalizePeriodType(form.type),
        nom: form.nom,
        date_debut: form.dateDebut,
        date_fin: form.dateFin,
        tournament_id: form.tournamentId || null,
        notes: form.notes,
      }

      let { error: insertError } = await supabase.from('periods').insert([{ ...payload, color }])
      if (insertError && insertError.message.includes('color')) {
        // Colonne color pas encore migrée : on réessaie sans la couleur.
        ;({ error: insertError } = await supabase.from('periods').insert([payload]))
      }

      if (insertError) {
        throw insertError
      }

      await refreshData()
      setForm(createEmptyForm())
      setSuccess('Période ajoutée avec succès.')
    } catch (submitError) {
      console.error('Error saving period:', submitError)
      const message = (submitError as { message?: string } | null)?.message
      setError(message || 'Impossible d’enregistrer la période')
    } finally {
      setSaving(false)
    }
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
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between relative z-10">
          <div>
            <BackButton className="mb-3" />
            <h1 className="text-3xl font-sora font-bold text-[var(--accent-primary)]">Périodes d'entraînement</h1>
            <p className="text-[var(--text-muted)] mt-1">Bonjour {userName}</p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="secondary" onClick={handleLogout}>Déconnexion</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8 relative z-10">
        <Card className="p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between mb-6">
            <div>
              <h2 className="text-2xl font-sora font-bold text-[var(--accent-primary)]">Ajouter une période</h2>
              <p className="text-[var(--text-muted)] mt-1">Préparation ou compétition pour un joueur.</p>
            </div>
            <Select
              value={selectedPlayerFilter}
              onChange={(e) => setSelectedPlayerFilter(e.target.value)}
              className="xl:max-w-xs"
              aria-label="Filtrer par joueur"
            >
              <option value="">Tous les joueurs</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.nom}
                </option>
              ))}
            </Select>
          </div>

          {error && <div className="bg-[var(--bg-clay-muted)] border border-[var(--accent-secondary-dark)]/20 text-[var(--accent-secondary-dark)] px-4 py-3 rounded-lg mb-6">{error}</div>}
          {success && <div className="bg-[var(--bg-green-muted)] border border-[var(--accent-primary)]/20 text-[var(--accent-primary)] px-4 py-3 rounded-lg mb-6">{success}</div>}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select
              label="Joueur"
              value={form.playerId}
              onChange={(e) => setForm((current) => ({ ...current, playerId: e.target.value, tournamentId: '' }))}
              required
            >
              <option value="">-- Sélectionner un joueur --</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.nom}
                </option>
              ))}
            </Select>

            <Select
              label="Type"
              value={form.type}
              onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))}
              required
            >
              <option value="preparation">Préparation</option>
              <option value="competition">Compétition</option>
            </Select>

            <Input
              label="Nom de la période"
              type="text"
              value={form.nom}
              onChange={(e) => setForm((current) => ({ ...current, nom: e.target.value }))}
              required
            />

            <Input
              label="Date début"
              type="date"
              value={form.dateDebut}
              onChange={(e) => setForm((current) => ({ ...current, dateDebut: e.target.value }))}
              required
            />

            <Input
              label="Date fin"
              type="date"
              value={form.dateFin}
              onChange={(e) => setForm((current) => ({ ...current, dateFin: e.target.value }))}
              required
            />

            <Select
              label="Tournoi lié"
              value={form.tournamentId}
              onChange={(e) => setForm((current) => ({ ...current, tournamentId: e.target.value }))}
            >
              <option value="">Aucun tournoi</option>
              {currentPlayerTournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.nom}
                </option>
              ))}
            </Select>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block mb-1.5 text-sm font-medium text-[var(--text-muted)]">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-input text-[var(--text-main)] outline-none transition-all focus:border-[var(--accent-secondary)] focus:ring-2 focus:ring-[var(--accent-secondary)]/30 min-h-[120px]"
                placeholder="Notes sur la période..."
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <Button type="submit" variant="accent" isLoading={saving}>
                {saving ? 'Enregistrement...' : 'Créer la période'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-sora font-bold text-[var(--accent-primary)] mb-4">Périodes existantes</h2>
          {filteredPeriods.length === 0 ? (
            <EmptyState message="Aucune période enregistrée pour le moment." />
          ) : (
            <div className="space-y-4">
              {filteredPeriods.map((period) => {
                const player = players.find((item) => item.id === period.player_id)
                const tournament = tournaments.find((item) => item.id === period.tournament_id)

                return (
                  <Card key={period.id} className="p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-xl font-sora font-bold text-[var(--text-main)] flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: periodColor(period) }}
                            aria-hidden="true"
                          />
                          <span className="truncate">{period.nom}</span>
                        </h3>
                        <p className="text-[var(--text-muted)] text-sm">{player?.nom || 'Joueur inconnu'} · {getPeriodTypeLabel(period.type)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 rounded-full bg-[var(--bg-yellow-muted)] text-[var(--text-main)] text-xs font-sora font-semibold tabular-nums">
                          {period.date_debut} → {period.date_fin}
                        </span>
                        {tournament && <Badge type="faite">Tournoi: {tournament.nom}</Badge>}
                      </div>
                    </div>
                    {period.notes && <p className="mt-3 text-[var(--text-muted)] whitespace-pre-line">{period.notes}</p>}
                  </Card>
                )
              })}
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
