// Fiche match : types et calculs partagés (formulaire, fiche, export PDF, historique).

export type MatchSet = { player: number; opponent: number }

export type MatchDetailsRow = {
  id: string
  session_id: string
  player_id: string
  adversaire: string
  tournament_name: string | null
  round: string | null
  surface: string | null
  sets: MatchSet[]
  result_override: string | null
  aces: number
  double_faults: number
  first_serve_percent: number | null
  winners: number
  direct_errors: number
  break_points_won: number
  break_points_total: number
  notes: string | null
  last_edited_by: string | null
  last_edited_at: string | null
}

export const MAX_SETS = 5

export function createEmptySets(): MatchSet[] {
  return [
    { player: 0, opponent: 0 },
    { player: 0, opponent: 0 },
  ]
}

export type MatchResult = 'victoire' | 'defaite' | 'incomplet' | 'abandon' | 'non_joue'

export const MATCH_RESULT_LABELS: Record<MatchResult, string> = {
  victoire: 'Victoire',
  defaite: 'Défaite',
  incomplet: 'Score incomplet',
  abandon: 'Abandon',
  non_joue: 'Non joué',
}

export function setsWon(sets: MatchSet[]) {
  let player = 0
  let opponent = 0
  for (const set of sets) {
    if (set.player > set.opponent) player += 1
    else if (set.opponent > set.player) opponent += 1
  }
  return { player, opponent }
}

// Résultat global déduit des sets (pas de double saisie), avec override manuel.
export function computeMatchResult(sets: MatchSet[], resultOverride: string | null): MatchResult | null {
  if (resultOverride === 'abandon') return 'abandon'
  if (resultOverride === 'non_joue') return 'non_joue'
  const played = sets.filter((set) => set.player + set.opponent > 0)
  if (played.length === 0) return null
  const { player, opponent } = setsWon(played)
  if (player === opponent) return 'incomplet'
  return player > opponent ? 'victoire' : 'defaite'
}

export function formatScore(sets: MatchSet[]): string {
  const played = sets.filter((set) => set.player + set.opponent > 0)
  if (played.length === 0) return '—'
  return played.map((set) => `${set.player}-${set.opponent}`).join('  ')
}

export function winnersErrorsRatio(winners: number, directErrors: number): string | null {
  if (directErrors === 0) return winners > 0 ? `${winners.toFixed(1).replace('.', ',')} / 0` : null
  return (winners / directErrors).toFixed(2).replace('.', ',')
}

export function breakConversionPercent(won: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((won / total) * 100)
}

export type MatchFormState = {
  adversaire: string
  tournament_name: string
  round: string
  surface: string
  sets: MatchSet[]
  result_override: string
  aces: number
  double_faults: number
  first_serve_percent: string
  winners: number
  direct_errors: number
  break_points_won: number
  break_points_total: number
  notes: string
}

export function createEmptyMatchForm(): MatchFormState {
  return {
    adversaire: '',
    tournament_name: '',
    round: '',
    surface: '',
    sets: createEmptySets(),
    result_override: '',
    aces: 0,
    double_faults: 0,
    first_serve_percent: '',
    winners: 0,
    direct_errors: 0,
    break_points_won: 0,
    break_points_total: 0,
    notes: '',
  }
}

export function formFromRow(row: MatchDetailsRow): MatchFormState {
  return {
    adversaire: row.adversaire || '',
    tournament_name: row.tournament_name || '',
    round: row.round || '',
    surface: row.surface || '',
    sets: Array.isArray(row.sets) && row.sets.length > 0 ? row.sets.map((set) => ({ ...set })) : createEmptySets(),
    result_override: row.result_override || '',
    aces: row.aces ?? 0,
    double_faults: row.double_faults ?? 0,
    first_serve_percent: row.first_serve_percent === null || row.first_serve_percent === undefined ? '' : String(row.first_serve_percent),
    winners: row.winners ?? 0,
    direct_errors: row.direct_errors ?? 0,
    break_points_won: row.break_points_won ?? 0,
    break_points_total: row.break_points_total ?? 0,
    notes: row.notes || '',
  }
}

// Indicateur de complétion : 10 champs clés.
export function matchCompletion(form: MatchFormState): { filled: number; total: number } {
  const checks = [
    form.adversaire.trim() !== '',
    form.tournament_name.trim() !== '',
    form.round.trim() !== '',
    form.surface.trim() !== '',
    form.sets.some((set) => set.player + set.opponent > 0),
    form.aces > 0,
    form.double_faults > 0,
    form.first_serve_percent !== '',
    form.winners > 0,
    form.direct_errors > 0,
  ]
  return { filled: checks.filter(Boolean).length, total: checks.length }
}

export function sanitizeFileName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
