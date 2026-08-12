import {
  EFFECTIVE_STATUS_LABELS,
  getEffectiveStatus,
  type EffectiveStatus,
  type SessionTimes,
} from '@/lib/session-status'

const STATUS_STYLES: Record<EffectiveStatus, string> = {
  prevue: 'bg-[var(--border-subtle)] text-[var(--text-muted)]',
  en_cours: 'bg-[var(--accent-ball)] text-[var(--accent-primary)]',
  faite: 'bg-[var(--bg-green-muted)] text-[var(--accent-primary)]',
  annulee: 'bg-[var(--bg-clay-muted)] text-[var(--accent-secondary-dark)]',
}

// Badge de statut calculé à la volée (jamais le statut brut de la base,
// sauf "annulée" qui prime). Cohérent coach + parent.
export function SessionStatusBadge({
  session,
  now,
  className = '',
}: {
  session: SessionTimes
  now?: Date
  className?: string
}) {
  const status = getEffectiveStatus(session, now)
  const label = EFFECTIVE_STATUS_LABELS[status]

  return (
    <span
      title={`Statut : ${label}`}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${STATUS_STYLES[status]} ${className}`}
    >
      {label}
    </span>
  )
}
