export type SessionTimes = {
  date: string
  heure_debut: string | null
  heure_fin: string | null
  statut: string | null
}

export type EffectiveStatus = 'prevue' | 'en_cours' | 'faite' | 'annulee'

export const EFFECTIVE_STATUS_LABELS: Record<EffectiveStatus, string> = {
  prevue: 'Prévue',
  en_cours: 'En cours',
  faite: 'Faite',
  annulee: 'Annulée',
}

function parseTime(value: string | null, fallback = '00:00'): string {
  if (!value) return fallback
  return value.length === 5 ? `${value}:00` : value
}

export function getSessionStartEnd(session: SessionTimes): { start: Date; end: Date } {
  const start = new Date(`${session.date}T${parseTime(session.heure_debut, '00:00')}`)
  const fallbackEnd = new Date(start.getTime() + 60 * 60 * 1000)
  const end = session.heure_fin ? new Date(`${session.date}T${parseTime(session.heure_fin)}`) : fallbackEnd
  return { start, end: Number.isNaN(end.getTime()) || end <= start ? fallbackEnd : end }
}

export function getSessionDurationHours(session: SessionTimes): number {
  const { start, end } = getSessionStartEnd(session)
  if (Number.isNaN(start.getTime())) return 0
  return Math.max((end.getTime() - start.getTime()) / 3600000, 0)
}

// Statut affiché = calculé à la volée selon la position dans le temps.
// Les statuts manuels priment toujours : "annulée" n'est jamais écrasée et
// une séance marquée "faite" manuellement reste faite.
export function getEffectiveStatus(session: SessionTimes, now: Date = new Date()): EffectiveStatus {
  const stored = (session.statut || '').trim().toLowerCase()
  if (stored === 'annulée') return 'annulee'
  if (stored === 'faite') return 'faite'

  const { start, end } = getSessionStartEnd(session)
  if (Number.isNaN(start.getTime())) return 'prevue'
  if (now < start) return 'prevue'
  if (now <= end) return 'en_cours'
  return 'faite'
}
