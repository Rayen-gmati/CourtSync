'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      const userId = data.user?.id

      if (!userId) {
        setError('Connexion réussie, mais impossible de récupérer l’identifiant utilisateur.')
        setLoading(false)
        return
      }

      // Ensure the session is established before querying role data
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('Supabase session error after signInWithPassword:', sessionError)
      }

      if (!sessionData.session) {
        setError('La session Supabase n’a pas été établie correctement.')
        setLoading(false)
        return
      }

      // Établit les cookies d'auth côté serveur (HttpOnly). Le rôle est relu en
      // base par la route et renvoyé pour la redirection.
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: sessionData.session.access_token }),
      })

      if (!sessionResponse.ok) {
        const body = await sessionResponse.json().catch(() => null)
        setError(body?.error || 'Impossible d’établir la session.')
        setLoading(false)
        return
      }

      const { role } = await sessionResponse.json()

      // Redirect based on role
      if (role === 'parent') {
        router.push('/dashboard/parent')
      } else {
        router.push('/dashboard/coach')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 animate-fade-in relative">
      <div className="absolute top-6 right-8 z-20">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md relative z-10">
        <Card className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-sora font-bold text-[var(--accent-primary)] mb-2 tracking-tight">CourtSync</h1>
            <p className="text-[var(--text-muted)]">Connectez-vous à votre compte</p>
          </div>

          {error && (
            <div className="bg-[var(--bg-clay-muted)] border border-[var(--accent-secondary-dark)]/20 text-[var(--accent-secondary-dark)] px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Mot de passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={loading}
            >
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--text-muted)] mt-8">
            Seul un administrateur peut créer des comptes.
          </p>
        </Card>
      </div>
    </div>
  )
}
