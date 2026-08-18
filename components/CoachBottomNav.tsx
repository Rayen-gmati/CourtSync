'use client'

// Barre de navigation mobile (bottom nav) pour l'espace coach.
// Visible sous md uniquement ; les pages conservent leur navigation desktop.

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  {
    href: '/dashboard/coach/sessions',
    label: 'Séances',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M8 2v4M16 2v4M3 9h18" />
      </svg>
    ),
  },
  {
    href: '/dashboard/coach/players',
    label: 'Joueurs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
      </svg>
    ),
  },
  {
    href: '/dashboard/coach/periods',
    label: 'Périodes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d="M3 8h18M3 12h14M3 16h10" />
      </svg>
    ),
  },
  {
    href: '/dashboard/coach/earnings',
    label: 'Gains',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d="M17 6.5H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H7" />
        <path d="M12 4v2M12 18v2" />
      </svg>
    ),
  },
  {
    href: '/dashboard/coach/reclamations',
    label: 'Réclam.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d="M12 3l10 18H2L12 3z" />
        <path d="M12 10v4M12 17.5v.5" />
      </svg>
    ),
  },
]

export function CoachBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-[var(--border-subtle)] bg-[var(--bg-card)]/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
