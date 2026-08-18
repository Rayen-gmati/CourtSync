'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BouncingBall } from '@/components/ui/BouncingBall'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CourtDivider } from '@/components/ui/CourtDivider'

import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { CoachBottomNav } from '@/components/CoachBottomNav'

type EarningsSummary = {
  currency: string
  priceFallback: boolean
  month: { total: number; count: number; hours: number }
  toToday: { total: number; count: number; hours: number }
} | null

const dashboardLinks = [
  {
    href: '/dashboard/coach/users',
    title: 'Gestion des utilisateurs',
    description: 'Créer de nouveaux comptes pour les coachs et parents',
  },
  {
    href: '/dashboard/coach/players',
    title: 'Suivi des joueurs',
    description: 'Voir la progression tennistique de vos joueurs',
  },
  {
    href: '/dashboard/coach/sessions',
    title: 'Gestion des séances',
    description: 'Calendrier, statut, objectifs et coachs assignés',
  },
  {
    href: '/dashboard/coach/periods',
    title: "Périodes d'entraînement",
    description: 'Préparation, compétition et suivi par joueur',
  },
  {
    href: '/dashboard/coach/earnings',
    title: 'Historique des gains',
    description: 'Détail mensuel des gains par joueur et par séance faite',
  },
  {
    href: '/dashboard/coach/reclamations',
    title: 'Réclamations des parents',
    description: 'Lire et traiter les réclamations envoyées par les parents',
  },
]

export default function CoachDashboard() {
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [earnings, setEarnings] = useState<EarningsSummary>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()

        if (error || !data.user) {
          router.push('/login')
          return
        }

        // Get user info from table
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

        // Résumé des gains : silencieux en cas d'erreur (cartes masquées).
        try {
          const response = await fetch('/api/earnings/summary', { cache: 'no-store' })
          if (response.ok) {
            setEarnings(await response.json())
          }
        } catch (earningsError) {
          console.error('Error fetching earnings summary:', earningsError)
        }
      } catch (err) {
        console.error('Error fetching user:', err)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [router])

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
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center relative z-10">
          <div>
            <h1 className="text-3xl font-sora font-bold text-[var(--accent-primary)]">CourtSync</h1>
            <p className="text-[var(--text-muted)] mt-1">Bonjour {userName}</p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="secondary" onClick={handleLogout}>Déconnexion</Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-12 pb-24 md:pb-12 relative z-10">
        {earnings && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">Gains ce mois-ci</p>
              <p className="text-3xl font-sora font-bold text-[var(--accent-primary)]">{earnings.month.total} {earnings.currency}</p>
              <p className="text-[var(--text-muted)] mt-1">{earnings.month.count} séance{earnings.month.count > 1 ? 's' : ''} · {earnings.month.hours} h</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">Gains à ce jour</p>
              <p className="text-3xl font-sora font-bold text-[var(--accent-primary)]">{earnings.toToday.total} {earnings.currency}</p>
              <p className="text-[var(--text-muted)] mt-1">{earnings.toToday.count} séance{earnings.toToday.count > 1 ? 's' : ''} · {earnings.toToday.hours} h</p>
              {earnings.priceFallback && (
                <p className="text-xs text-[var(--text-muted)] mt-2">Calcul basé sur le prix des séances (aucun montant coach enregistré).</p>
              )}
            </Card>
          </div>
        )}

        <Card className="p-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-sora font-bold text-[var(--text-main)] mb-3">Tableau de bord Coach</h2>
            <p className="text-lg text-[var(--text-muted)]">Bienvenue sur votre espace de gestion CourtSync.</p>
          </div>

          <CourtDivider label="Gestion" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {dashboardLinks.map((item) => (
              <Link key={item.href} href={item.href} className="block focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/60 rounded-card">
                <Card interactive className="h-full p-6">
                  <h3 className="text-xl font-sora font-bold text-[var(--accent-primary)] mb-2">{item.title}</h3>
                  <p className="text-[var(--text-muted)]">{item.description}</p>
                </Card>
              </Link>
            ))}
          </div>
        </Card>
      </main>

      <CoachBottomNav />
    </div>
  )
}
