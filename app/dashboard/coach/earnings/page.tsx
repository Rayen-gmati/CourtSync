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

type PlayerEarning = {
  playerId: string
  nom: string
  count: number
  hours: number
  total: number
}

type MonthEarning = {
  key: string
  label: string
  total: number
  count: number
  hours: number
  players: PlayerEarning[]
}

type HistoryResponse = {
  currency: string
  priceFallback: boolean
  months: MonthEarning[]
}

type PlayerSort = 'total' | 'nom' | 'hours'

const playerSortOptions: Array<{ value: PlayerSort; label: string }> = [
  { value: 'total', label: 'Montant' },
  { value: 'hours', label: 'Heures' },
  { value: 'nom', label: 'Nom' },
]

function sortPlayers(players: PlayerEarning[], sort: PlayerSort) {
  const copy = [...players]
  if (sort === 'nom') return copy.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  if (sort === 'hours') return copy.sort((a, b) => b.hours - a.hours || b.total - a.total)
  return copy.sort((a, b) => b.total - a.total)
}

export default function CoachEarningsPage() {
  const [userName, setUserName] = useState('')
  const [history, setHistory] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedMonths, setExpandedMonths] = useState<string[]>([])
  const [playerSort, setPlayerSort] = useState<PlayerSort>('total')
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

        if (mounted) {
          setUserName(userData.nom)
        }

        const response = await fetch('/api/earnings/history', { cache: 'no-store' })
        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new Error(body?.error || `Erreur API (${response.status})`)
        }

        const payload: HistoryResponse = await response.json()
        if (mounted) {
          setHistory(payload)
          // Le mois le plus récent est ouvert par défaut.
          setExpandedMonths(payload.months.length > 0 ? [payload.months[0].key] : [])
        }
      } catch (pageError) {
        console.error('Error loading earnings history:', pageError)
        if (mounted) {
          setError(pageError instanceof Error ? pageError.message : 'Impossible de charger l’historique des gains.')
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    await fetch('/api/auth/session', { method: 'DELETE' })
    router.push('/login')
  }

  const toggleMonth = (key: string) => {
    setExpandedMonths((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    )
  }

  const sortedMonths = useMemo(() => history?.months || [], [history])

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
            <h1 className="text-3xl font-sora font-bold text-[var(--accent-primary)]">Historique des gains</h1>
            <p className="text-[var(--text-muted)] mt-1">Bonjour {userName} — détail mensuel des séances effectuées.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <ThemeToggle />
            <Button variant="secondary" onClick={handleLogout}>Déconnexion</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-10 pb-24 md:pb-10 space-y-8 relative z-10">
        {error && (
          <div className="bg-[var(--bg-clay-muted)] border border-[var(--accent-secondary-dark)]/20 text-[var(--accent-secondary-dark)] px-4 py-3 rounded">
            {error}
          </div>
        )}

        {history?.priceFallback && (
          <div className="bg-[var(--bg-yellow-muted)] border border-[var(--border-strong)]/20 text-[var(--text-main)] px-4 py-3 rounded text-sm">
            Aucun montant coach enregistré : les gains sont calculés à partir du prix de chaque séance.
          </div>
        )}

        <Card className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h2 className="text-2xl font-sora font-bold text-[var(--accent-primary)]">Gains par mois</h2>
              <p className="text-[var(--text-muted)] mt-1">Séances au statut « faite » uniquement. Cliquez sur un mois pour voir le détail par joueur.</p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-[var(--text-muted)]">Tri joueurs :</label>
              <select
                value={playerSort}
                onChange={(e) => setPlayerSort(e.target.value as PlayerSort)}
                className="bg-[var(--bg-card)] text-[var(--text-main)] px-3 py-2 rounded-input border border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 text-sm"
              >
                {playerSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {sortedMonths.length === 0 ? (
            <EmptyState message="Aucune séance effectuée pour le moment." />
          ) : (
            <div className="space-y-3">
              {sortedMonths.map((month) => {
                const isExpanded = expandedMonths.includes(month.key)
                return (
                  <div key={month.key} className="rounded-card border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleMonth(month.key)}
                      aria-expanded={isExpanded}
                      className="w-full text-left px-4 py-4 hover:bg-[var(--bg-dim)] transition flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full border border-[var(--border-strong)] text-xs text-[var(--text-main)] transition-transform ${isExpanded ? 'rotate-90' : ''}`} aria-hidden="true">
                          ▸
                        </span>
                        <span className="font-sora font-semibold text-lg text-[var(--text-main)]">{month.label}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                        <span className="font-sora font-bold text-[var(--accent-primary)]">{month.total} {history?.currency}</span>
                        <span className="text-[var(--text-muted)]">{month.count} séance{month.count > 1 ? 's' : ''}</span>
                        <span className="text-[var(--text-muted)]">{month.hours} h</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[var(--border-subtle)] px-4 py-4">
                        <div className="grid grid-cols-1 gap-2 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] md:grid-cols-[1fr_100px_100px_140px] pb-2 border-b border-[var(--border-subtle)]">
                          <span>Joueur</span>
                          <span className="text-right">Séances</span>
                          <span className="text-right">Heures</span>
                          <span className="text-right">Montant</span>
                        </div>
                        <div className="divide-y divide-[var(--border-subtle)]">
                          {sortPlayers(month.players, playerSort).map((player) => (
                            <div key={player.playerId} className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[1fr_100px_100px_140px] items-center">
                              <span className="font-semibold text-[var(--text-main)]">{player.nom}</span>
                              <span className="text-[var(--text-muted)] md:text-right">{player.count}</span>
                              <span className="text-[var(--text-muted)] md:text-right">{player.hours} h</span>
                              <span className="font-semibold text-[var(--accent-primary)] md:text-right">{player.total} {history?.currency}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </main>

      <CoachBottomNav />
    </div>
  )
}
