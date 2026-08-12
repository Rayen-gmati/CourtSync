import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { BouncingBall } from '@/components/ui/BouncingBall'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col animate-fade-in relative">
      <header className="w-full px-8 py-6 relative z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-2xl font-sora font-bold text-[var(--accent-primary)] tracking-tight">CourtSync</div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost">Se connecter</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow flex items-center relative z-10">
        <div className="max-w-6xl mx-auto w-full px-6 lg:px-8 py-12">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 text-center lg:text-left">
              <h1 className="text-5xl sm:text-6xl font-sora font-extrabold text-[var(--accent-primary)] leading-tight mb-6">
                Le suivi de <span className="text-[var(--accent-secondary)]">tennis</span> réinventé
              </h1>
              <p className="text-lg text-[var(--text-muted)] max-w-xl mb-10 mx-auto lg:mx-0">
                La plateforme qui connecte coachs et parents pour suivre chaque étape de la progression tennistique, des entraînements aux matchs.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link href="/login">
                  <Button variant="primary" className="px-8 py-3 text-base">
                    Espace Coach
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="secondary" className="px-8 py-3 text-base">
                    Espace Parent
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center py-10">
               <BouncingBall size="lg" className="scale-150" />
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full py-8 border-t border-[var(--border-subtle)] bg-[var(--bg-card)]/50 backdrop-blur-sm relative z-10">
        <div className="max-w-6xl mx-auto px-8 flex flex-col sm:flex-row justify-between items-center text-sm text-[var(--text-muted)]">
          <div>&copy; {new Date().getFullYear()} CourtSync</div>
          <div>Developed by Rayen Gmati</div>
        </div>
      </footer>
    </div>
  )
}
