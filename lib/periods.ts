import { supabase } from '@/lib/supabase'

export type PeriodRow = {
  id: string
  player_id: string
  type: string
  nom: string
  date_debut: string
  date_fin: string
  tournament_id: string | null
  notes: string | null
  color: string | null
}

const SELECT_WITH_COLOR = 'id, player_id, type, nom, date_debut, date_fin, tournament_id, notes, color'
const SELECT_BASE = 'id, player_id, type, nom, date_debut, date_fin, tournament_id, notes'

function withNullColor(rows: Omit<PeriodRow, 'color'>[]): PeriodRow[] {
  return rows.map((row) => ({ ...row, color: null }))
}

// Toutes les périodes (vue coach), triées par date de début décroissante.
// Si la colonne color n'a pas encore été migrée, repli sans la colonne.
export async function fetchAllPeriods(): Promise<PeriodRow[]> {
  const result = await supabase
    .from('periods')
    .select(SELECT_WITH_COLOR)
    .order('date_debut', { ascending: false })

  if (!result.error) return (result.data || []) as PeriodRow[]

  const fallback = await supabase
    .from('periods')
    .select(SELECT_BASE)
    .order('date_debut', { ascending: false })
  return withNullColor((fallback.data || []) as Omit<PeriodRow, 'color'>[])
}

// Périodes d'un joueur (vue parent), triées par date de début croissante.
export async function fetchPeriodsForPlayer(playerId: string): Promise<PeriodRow[]> {
  const result = await supabase
    .from('periods')
    .select(SELECT_WITH_COLOR)
    .eq('player_id', playerId)
    .order('date_debut', { ascending: true })

  if (!result.error) return (result.data || []) as PeriodRow[]

  const fallback = await supabase
    .from('periods')
    .select(SELECT_BASE)
    .eq('player_id', playerId)
    .order('date_debut', { ascending: true })
  return withNullColor((fallback.data || []) as Omit<PeriodRow, 'color'>[])
}

export function coversDay(period: { date_debut: string; date_fin: string }, dayKey: string): boolean {
  return period.date_debut <= dayKey && dayKey <= period.date_fin
}
