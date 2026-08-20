'use client'

// Agenda mobile (liste par jour) : alternative lisible à la grille 7 colonnes
// sur petit écran. Conserve bandes de périodes (en chips), météo et statuts.

import { SessionStatusBadge } from './SessionStatusBadge'
import { formatTime } from '@/lib/format-time'
import { WeatherBadge } from './WeatherBadge'
import type { WeatherByDate } from '@/lib/weather'

export type AgendaSession = {
  id: string
  date: string
  heure_debut: string
  heure_fin: string
  type: string | null
  statut: string | null
  label: string
  sublabel?: string
}

export type AgendaPeriod = { id: string; nom: string; color: string | null }

type MobileAgendaProps = {
  days: Date[]
  sessionsFor: (key: string) => AgendaSession[]
  periodsFor: (key: string) => AgendaPeriod[]
  weather: WeatherByDate
  now: Date
  showEmptyDays: boolean
  onDayClick?: (key: string) => void
  onSessionClick?: (id: string) => void
  emptyMessage: string
}

function pad(n: number) {
  return `${n}`.padStart(2, '0')
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function MobileAgenda({
  days,
  sessionsFor,
  periodsFor,
  weather,
  now,
  showEmptyDays,
  onDayClick,
  onSessionClick,
  emptyMessage,
}: MobileAgendaProps) {
  const todayKey = formatDateKey(new Date())

  const visibleDays = showEmptyDays
    ? days
    : days.filter((day) => {
        const key = formatDateKey(day)
        return sessionsFor(key).length > 0 || periodsFor(key).length > 0
      })

  if (visibleDays.length === 0) {
    return <p className="rounded-card border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-center text-sm text-[var(--text-muted)]">{emptyMessage}</p>
  }

  return (
    <div className="space-y-3">
      {visibleDays.map((day) => {
        const key = formatDateKey(day)
        const daySessions = sessionsFor(key)
        const dayPeriods = periodsFor(key)
        const isToday = key === todayKey

        return (
          <section key={key} className={`rounded-card border bg-[var(--bg-card)] p-4 ${isToday ? 'border-[var(--accent-secondary)] ring-1 ring-[var(--accent-secondary)]' : 'border-[var(--border-subtle)]'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-base font-sora font-semibold text-[var(--text-main)] capitalize">
                {day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <WeatherBadge weather={weather[key]} />
            </div>

            {dayPeriods.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {dayPeriods.map((period) => (
                  <span
                    key={period.id}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-[var(--text-main)] bg-[var(--bg-dim)]"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: period.color || 'var(--accent-secondary)' }} />
                    {period.nom}
                  </span>
                ))}
              </div>
            )}

            {daySessions.length > 0 ? (
              <div className="mt-3 space-y-2">
                {daySessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => onSessionClick?.(session.id)}
                    className="w-full min-h-[44px] text-left rounded-input border border-[var(--border-subtle)] bg-[var(--bg-dim)] px-4 py-3 transition hover:opacity-90"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--text-main)] tabular-nums">
                        {formatTime(session.heure_debut)} – {formatTime(session.heure_fin)}
                      </span>
                      <SessionStatusBadge session={session} now={now} />
                    </div>
                    <div className="mt-0.5 text-sm text-[var(--text-muted)]">{session.label}</div>
                    {session.sublabel && <div className="text-xs text-[var(--text-muted)]/80">{session.sublabel}</div>}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--text-muted)]">{emptyMessage}</p>
            )}

            {onDayClick && (
              <button
                type="button"
                onClick={() => onDayClick(key)}
                className="mt-3 w-full min-h-[44px] rounded-input border border-dashed border-[var(--border-strong)] text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-dim)] transition"
              >
                + Ajouter une séance
              </button>
            )}
          </section>
        )
      })}
    </div>
  )
}
