'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BouncingBall } from '@/components/ui/BouncingBall'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

interface Player {
  id: string
  nom: string
}

export default function CreateUserPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('coach')
  const [playerId, setPlayerId] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [tempPassword, setTempPassword] = useState('')
  const router = useRouter()

  useEffect(() => {
    let active = true

    const fetchPlayers = async () => {
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id, nom')
        .order('nom')

      if (!playersError && playersData && active) {
        setPlayers(playersData)
      }
    }

    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()

        if (error || !data.user) {
          router.push('/login')
          return
        }

        // Get user role
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.user.id)
          .single()

        if (userError || !userData || userData.role !== 'coach_admin') {
          router.push('/dashboard/coach')
          return
        }

        await fetchPlayers()
      } catch (err) {
        console.error('Error checking auth:', err)
        router.push('/login')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void checkAuth()

    const handlePlayersUpdated = () => {
      void fetchPlayers()
    }

    window.addEventListener('players-updated', handlePlayersUpdated)

    return () => {
      active = false
      window.removeEventListener('players-updated', handlePlayersUpdated)
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setTempPassword('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          role,
          playerId: role === 'parent' ? playerId : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erreur lors de la création du compte')
        setSubmitting(false)
        return
      }

      setSuccess(true)
      setTempPassword(data.tempPassword)
      setEmail('')
      setName('')
      setRole('coach')
      setPlayerId('')

      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
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
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center relative z-10">
          <div>
            <h1 className="text-3xl font-sora font-bold text-[var(--accent-primary)]">Gestion des utilisateurs</h1>
            <p className="text-[var(--text-muted)] mt-1">Créer des accès pour les coachs et les parents.</p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 relative z-10">
        <Card className="p-8">
          {success && (
            <div className="bg-[var(--bg-green-muted)] border border-[var(--accent-primary)]/20 text-[var(--accent-primary)] px-4 py-4 rounded-lg mb-6">
              <p className="font-semibold mb-2">Compte créé avec succès !</p>
              <p className="text-sm mb-3">Email: <code className="bg-[var(--bg-card)] px-2 py-1 rounded text-[var(--text-main)]">{email}</code></p>
              <p className="text-sm">Mot de passe temporaire: <code className="bg-[var(--bg-card)] px-2 py-1 rounded font-mono text-xs text-[var(--text-main)]">{tempPassword}</code></p>
              <p className="text-sm mt-3 text-[var(--accent-hover)]">Copiez ce mot de passe pour le transmettre à l’utilisateur.</p>
            </div>
          )}

          {error && (
            <div className="bg-[var(--bg-clay-muted)] border border-[var(--accent-secondary-dark)]/20 text-[var(--accent-secondary-dark)] px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <h2 className="text-2xl font-sora font-bold text-[var(--accent-primary)] mb-6">Créer un nouveau compte</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Nom complet"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Select label="Rôle" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="coach">Coach</option>
              <option value="parent">Parent</option>
            </Select>

            {role === 'parent' && (
              <Select
                label="Joueur associé"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                required={role === 'parent'}
              >
                <option value="">-- Sélectionner un joueur --</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.nom}
                  </option>
                ))}
              </Select>
            )}

            <Button type="submit" variant="primary" className="w-full mt-8" isLoading={submitting}>
              {submitting ? 'Création en cours...' : 'Créer le compte'}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  )
}
