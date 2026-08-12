import type { CSSProperties } from 'react'
import { hexToRgba, periodColor, shadeHex } from '@/lib/period-colors'

export type BandPeriod = {
  id: string
  nom: string
  date_debut: string
  date_fin: string
  color: string | null
}

export type PeriodBandSegment = {
  period: BandPeriod
  // Colonnes (0-6) occupées par le segment visible dans la semaine.
  startCol: number
  endCol: number
  // Vrai si la période commence/se termine réellement dans cette semaine
  // (sinon bord coupé net pour l'effet de continuité entre semaines).
  startsInWeek: boolean
  endsInWeek: boolean
}

function pad(n: number) {
  return `${n}`.padStart(2, '0')
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Découpe chaque période en segment visible pour la semaine affichée.
export function getWeekBandSegments(weekDays: Date[], periods: BandPeriod[]): PeriodBandSegment[] {
  if (weekDays.length === 0) return []

  const keys = weekDays.map(dayKey)
  const first = keys[0]
  const last = keys[keys.length - 1]
  const segments: PeriodBandSegment[] = []

  periods.forEach((period) => {
    if (period.date_fin < first || period.date_debut > last) return

    const startKey = period.date_debut > first ? period.date_debut : first
    const endKey = period.date_fin < last ? period.date_fin : last

    segments.push({
      period,
      startCol: keys.indexOf(startKey),
      endCol: keys.indexOf(endKey),
      startsInWeek: period.date_debut >= first,
      endsInWeek: period.date_fin <= last,
    })
  })

  return segments.sort((a, b) => a.startCol - b.startCol || a.period.id.localeCompare(b.period.id))
}

// Nombre de lignes de bandes nécessaires quand plusieurs périodes se chevauchent.
export function bandRowCount(segments: PeriodBandSegment[]): number {
  let rows = 0
  for (let col = 0; col < 7; col++) {
    const covering = segments.filter((segment) => segment.startCol <= col && col <= segment.endCol).length
    rows = Math.max(rows, covering)
  }
  return rows
}

const BAND_ROW_HEIGHT = 22 // bande 20 px + espace 2 px

export function bandSpacerHeight(rows: number): number {
  return rows * BAND_ROW_HEIGHT
}

/**
 * Bande de période continue, type Google Calendar : une seule bande horizontale
 * par semaine, du jour de début (ou lundi) au jour de fin (ou dimanche), placée
 * sous les numéros de jour et avant les séances. Le nom n'apparaît qu'une fois,
 * tronqué avec ellipsis, tooltip avec nom complet + dates exactes.
 *
 * Le conteneur doit être une grille 7 colonnes (mêmes gaps que la grille de
 * jours) positionnée en absolu au-dessus de la ligne de semaine.
 */
export function PeriodBands({ segments, className }: { segments: PeriodBandSegment[]; className?: string }) {
  if (segments.length === 0) return null

  return (
    <div className={`pointer-events-none grid auto-rows-[20px] gap-y-0.5 ${className || ''}`}>
      {segments.map((segment) => {
        const color = periodColor(segment.period)
        const style = {
          gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
          backgroundColor: hexToRgba(color, 0.18),
          borderRadius: `${segment.startsInWeek ? 6 : 0}px ${segment.endsInWeek ? 6 : 0}px ${segment.endsInWeek ? 6 : 0}px ${segment.startsInWeek ? 6 : 0}px`,
          '--period-text-light': shadeHex(color, -0.35),
          '--period-text-dark': shadeHex(color, 0.55),
        } as CSSProperties

        return (
          <div
            key={segment.period.id}
            style={style}
            title={`${segment.period.nom} (${segment.period.date_debut} → ${segment.period.date_fin})`}
            className="pointer-events-auto relative flex items-center px-1.5 overflow-hidden"
          >
            <span className="period-label-text text-[11px] font-medium leading-none truncate">
              {segment.period.nom}
            </span>
          </div>
        )
      })}
    </div>
  )
}
