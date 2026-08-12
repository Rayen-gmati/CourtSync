'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BouncingBall } from '@/components/ui/BouncingBall'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { EmptyState } from '@/components/ui/EmptyState'


type Player = {
  id: string
  nom: string
  date_naissance: string | null
  niveau: string | null
}

export default function CoachPlayersPage() {
  const [userName, setUserName] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [nom, setNom] = useState('')
  const [dateNaissance, setDateNaissance] = useState('')
  const [niveau, setNiveau] = useState('débutant')
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    const fetchData = async () => {
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

        setUserName(userData.nom)

        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('id, nom, date_naissance, niveau')
          .order('nom')

        if (!playersError && playersData && mounted) {
          setPlayers(playersData)
        }
      } catch (fetchError) {
        console.error('Error loading players page:', fetchError)
        router.push('/login')
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      mounted = false
    }
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    await fetch('/api/auth/session', { method: 'DELETE' })
    router.push('/login')
  }

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const { data, error } = await supabase
        .from('players')
        .insert([
          {
            nom,
            date_naissance: dateNaissance || null,
            niveau,
          },
        ])
        .select('id, nom, date_naissance, niveau')
        .single()

      if (error || !data) {
        console.error('Supabase error while creating player:', error)
        setError(error?.message || 'Impossible de créer le joueur')
        return
      }

      setPlayers((currentPlayers) => [data, ...currentPlayers.filter((player) => player.id !== data.id)])
      window.dispatchEvent(new Event('players-updated'))
      setSuccess(`Joueur ${data.nom} ajouté avec succès.`)
      setNom('')
      setDateNaissance('')
      setNiveau('débutant')
    } catch (createError) {
      console.error('Unexpected error while creating player:', createError)
      setError('Une erreur est survenue lors de la création du joueur')
    } finally {
      setSubmitting(false)
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
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between gap-4 relative z-10">
          <div>
            <h1 className="text-3xl font-sora font-bold text-[var(--accent-primary)]">Gestion des joueurs</h1>
            <p className="text-[var(--text-muted)] mt-1">Bonjour {userName}</p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="secondary" onClick={handleLogout}>Déconnexion</Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-10 relative z-10">
        <Card className="p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-sora font-bold text-[var(--accent-primary)]">Ajouter un joueur</h2>
              <p className="text-[var(--text-muted)] mt-1">Créer un joueur directement dans la base CourtSync.</p>
            </div>
          </div>

          {error && (
            <div className="bg-[var(--bg-clay-muted)] border border-[var(--accent-secondary-dark)]/20 text-[var(--accent-secondary-dark)] px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-[var(--bg-green-muted)] border border-[var(--accent-primary)]/20 text-[var(--accent-primary)] px-4 py-3 rounded-lg mb-6">
              {success}
            </div>
          )}

          <form onSubmit={handleAddPlayer} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Nom"
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom du joueur"
              required
            />

            <Input
              label="Date de naissance"
              type="date"
              value={dateNaissance}
              onChange={(e) => setDateNaissance(e.target.value)}
              required
            />

            <Input
              label="Niveau"
              type="text"
              value={niveau}
              onChange={(e) => setNiveau(e.target.value)}
              placeholder="Débutant / intermédiaire / avancé"
              required
            />

            <div className="md:col-span-3">
              <Button type="submit" variant="accent" isLoading={submitting}>
                {submitting ? 'Ajout en cours...' : 'Ajouter le joueur'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-sora font-bold text-[var(--accent-primary)]">Joueurs existants</h2>
              <p className="text-[var(--text-muted)] mt-1">Liste synchronisée avec la table players.</p>
            </div>
            <span className="text-sm text-[var(--text-muted)] font-sora font-semibold tabular-nums">{players.length} joueur(s)</span>
          </div>

          {players.length === 0 ? (
            <EmptyState message="Aucun joueur enregistré pour l’instant." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
              <table className="min-w-full divide-y divide-[var(--border-subtle)] bg-[var(--bg-card)]">
                <thead className="bg-[var(--bg-dim)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Nom</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Date de naissance</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Niveau</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {players.map((player) => (
                    <tr key={player.id} className="hover:bg-[var(--bg-dim)] transition">
                      <td className="px-4 py-4 font-medium text-[var(--text-main)]">{player.nom}</td>
                      <td className="px-4 py-4 text-[var(--text-muted)] font-sora font-semibold tabular-nums">{player.date_naissance ?? '—'}</td>
                      <td className="px-4 py-4 text-[var(--text-muted)]">{player.niveau ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
