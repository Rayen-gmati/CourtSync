'use client'

import { useRouter } from 'next/navigation'

type BackButtonProps = {
  // Route précise si l'historique ne suffit pas (ex: détail → calendrier).
  to?: string
  label?: string
  className?: string
}

// Bouton discret de navigation arrière : icône seule sur mobile, icône + texte dès sm.
export function BackButton({ to, label = 'Retour', className = '' }: BackButtonProps) {
  const router = useRouter()

  const handleBack = () => {
    if (to) {
      router.push(to)
      return
    }
    router.back()
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={label}
      className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--border-strong)] bg-transparent text-[var(--text-main)] transition-colors duration-150 hover:bg-[var(--bg-yellow-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 active:scale-[0.97] ${className}`}
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
      </svg>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
