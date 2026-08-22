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
    return <p className="rounded-card border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-center text-sm text-[var(--text-muted)]">{emptyMessage}</p>
  }

  return (
    <div className="space-y-1">
      {visibleDays.map((day) => {
        const key = formatDateKey(day)
        const daySessions = sessionsFor(key)
        const dayPeriods = periodsFor(key)
        const isToday = key === todayKey
        const hasContent = daySessions.length > 0 || dayPeriods.length > 0

        return (
          <section
            key={key}
            id={isToday ? 'cal-today' : undefined}
            className={`rounded-xl px-3 ${hasContent ? 'py-2' : 'py-1.5'} ${isToday ? 'bg-[var(--bg-clay-muted)] ring-2 ring-[var(--accent-cta)]' : 'bg-[var(--bg-card)]'}`}
          >
            <div className="flex items-center justify-between gap-2 min-h-[22px]">
              <div className="flex items-center gap-1.5 text-sm font-sora font-semibold text-[var(--text-main)] capitalize leading-tight">
                {day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                {isToday && (
                  <span className="rounded-full bg-[var(--accent-cta)] px-1.5 py-px text-[9px] font-semibold normal-case text-[var(--text-main)] leading-none">
                    Aujourd’hui
                  </span>
                )}
              </div>
              <WeatherBadge weather={weather[key]} />
            </div>

            {dayPeriods.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {dayPeriods.map((period) => (
                  <span
                    key={period.id}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-px text-[10px] font-semibold text-[var(--text-main)] bg-[var(--bg-dim)] leading-tight"
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: period.color || 'var(--accent-secondary)' }} />
                    {period.nom}
                  </span>
                ))}
              </div>
            )}

            {daySessions.length > 0 ? (
              <div className="mt-1.5 space-y-1">
                {daySessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => onSessionClick?.(session.id)}
                    className="w-full text-left rounded-lg bg-[var(--bg-card-nested)] px-2.5 py-1.5 transition hover:opacity-90 active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--text-main)] tabular-nums shrink-0">
                        {formatTime(session.heure_debut)}–{formatTime(session.heure_fin)}
                      </span>
                      <SessionStatusBadge session={session} now={now} />
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-tight">
                      {session.label}
                      {session.sublabel && <span className="ml-1 opacity-80">· {session.sublabel}</span>}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              !onDayClick && <p className="mt-0.5 text-[11px] text-[var(--text-muted)]/70 leading-tight">{emptyMessage}</p>
            )}

            {onDayClick && (
              <button
                type="button"
                onClick={() => onDayClick(key)}
                className="mt-1.5 w-full min-h-[32px] rounded-input border border-dashed border-[var(--border-strong)] text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-dim)] transition"
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
