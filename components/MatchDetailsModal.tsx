'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import {
  MAX_SETS,
  MatchDetailsRow,
  MatchFormState,
  MATCH_RESULT_LABELS,
  breakConversionPercent,
  computeMatchResult,
  createEmptyMatchForm,
  formFromRow,
  matchCompletion,
  winnersErrorsRatio,
} from '@/lib/match-stats'
import { exportMatchPdf } from '@/lib/match-pdf'

type MatchDetailsModalProps = {
  sessionId: string
  playerId: string
  playerName: string
  sessionDate: string
  onClose: () => void
}

function NumberStepper({
  label,
  value,
  onChange,
  max,
}: {
  label: string
  value: number
  onChange: (next: number) => void
  max?: number
}) {
  const clamp = (next: number) => Math.max(0, max !== undefined ? Math.min(max, next) : next)
  return (
    <div className="flex items-center justify-between gap-3 rounded-input border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2">
      <span className="text-sm font-semibold text-[var(--text-main)]">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-input border border-[var(--border-strong)] text-lg font-bold text-[var(--text-main)] hover:bg-[var(--bg-dim)] transition"
          aria-label={`Diminuer ${label}`}
        >
          −
        </button>
        <span className="w-10 text-center text-lg font-sora font-bold tabular-nums text-[var(--text-main)]">{value}</span>
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-input border border-[var(--border-strong)] text-lg font-bold text-[var(--text-main)] hover:bg-[var(--bg-dim)] transition"
          aria-label={`Augmenter ${label}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-sm font-sora font-bold uppercase tracking-[0.14em] text-[var(--accent-primary)] border-b border-[var(--border-subtle)] pb-2">
      {children}
    </h4>
  )
}

export function MatchDetailsModal({ sessionId, playerId, playerName, sessionDate, onClose }: MatchDetailsModalProps) {
  const [form, setForm] = useState<MatchFormState>(() => createEmptyMatchForm())
  const [row, setRow] = useState<MatchDetailsRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const [lastEditedName, setLastEditedName] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const loadedRef = useRef(false)

  const draftKey = `match_draft_${sessionId}`

  // Chargement : fiche existante + utilisateur courant + brouillon local éventuel.
  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser()
        if (userData?.user) userIdRef.current = userData.user.id

        const { data } = await supabase
          .from('match_details')
          .select('*')
          .eq('session_id', sessionId)
          .maybeSingle()

        if (!active) return

        if (data) {
          setRow(data as MatchDetailsRow)
          setForm(formFromRow(data as MatchDetailsRow))
          if ((data as MatchDetailsRow).last_edited_by) {
            const { data: editor } = await supabase
              .from('users')
              .select('nom')
              .eq('id', (data as MatchDetailsRow).last_edited_by)
              .maybeSingle()
            if (active && editor) setLastEditedName(editor.nom)
          }
        } else {
          const rawDraft = typeof window !== 'undefined' ? window.localStorage.getItem(draftKey) : null
          if (rawDraft) {
            try {
              const parsed = JSON.parse(rawDraft) as MatchFormState
              setForm({ ...createEmptyMatchForm(), ...parsed })
              setDraftRestored(true)
            } catch {
              window.localStorage.removeItem(draftKey)
            }
          }
        }
      } catch (loadError) {
        console.error('Error loading match details:', loadError)
        if (active) setError('Impossible de charger la fiche match.')
      } finally {
        if (active) {
          loadedRef.current = true
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [sessionId, draftKey])

  // Sauvegarde automatique du brouillon (debounce 2,5 s) — jamais les données serveur.
  useEffect(() => {
    if (!loadedRef.current || row !== null) return
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(form))
        setDraftSavedAt(new Date())
      } catch {
        // stockage local indisponible : silencieux
      }
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [form, draftKey, row])

  const result = useMemo(() => computeMatchResult(form.sets, form.result_override || null), [form.sets, form.result_override])
  const completion = useMemo(() => matchCompletion(form), [form])
  const ratio = winnersErrorsRatio(form.winners, form.direct_errors)
  const breakPercent = breakConversionPercent(form.break_points_won, form.break_points_total)

  const updateSet = (index: number, side: 'player' | 'opponent', raw: string) => {
    const value = Math.max(0, Math.min(99, Number(raw) || 0))
    setForm((current) => ({
      ...current,
      sets: current.sets.map((set, i) => (i === index ? { ...set, [side]: value } : set)),
    }))
  }

  const addSet = () => setForm((current) => (current.sets.length >= MAX_SETS ? current : { ...current, sets: [...current.sets, { player: 0, opponent: 0 }] }))
  const removeSet = (index: number) =>
    setForm((current) => (current.sets.length <= 1 ? current : { ...current, sets: current.sets.filter((_, i) => i !== index) }))

  const handleSave = async () => {
    if (!userIdRef.current) return
    setSaving(true)
    setError('')
    setSuccess('')

    const now = new Date().toISOString()
    const payload = {
      session_id: sessionId,
      player_id: playerId,
      adversaire: form.adversaire.trim(),
      tournament_name: form.tournament_name.trim() || null,
      round: form.round.trim() || null,
      surface: form.surface.trim() || null,
      sets: form.sets,
      result_override: form.result_override || null,
      aces: form.aces,
      double_faults: form.double_faults,
      first_serve_percent: form.first_serve_percent === '' ? null : Math.max(0, Math.min(100, Number(form.first_serve_percent) || 0)),
      winners: form.winners,
      direct_errors: form.direct_errors,
      break_points_won: form.break_points_won,
      break_points_total: form.break_points_total,
      notes: form.notes.trim() || null,
      last_edited_by: userIdRef.current,
      last_edited_at: now,
    }

    try {
      const { data, error: upsertError } = await supabase
        .from('match_details')
        .upsert(payload, { onConflict: 'session_id' })
        .select('*')
        .single()

      if (upsertError || !data) throw upsertError || new Error('Match details save failed')

      setRow(data as MatchDetailsRow)
      setLastEditedName(null)
      const { data: editor } = await supabase.from('users').select('nom').eq('id', userIdRef.current).maybeSingle()
      if (editor) setLastEditedName(editor.nom)
      try {
        window.localStorage.removeItem(draftKey)
      } catch {
        // ignore
      }
      setDraftSavedAt(null)
      setDraftRestored(false)
      setSuccess('Fiche match enregistrée.')
    } catch (saveError) {
      console.error('Error saving match details:', saveError)
      setError('Impossible d’enregistrer la fiche match. Vérifiez que la migration « match_details » a été exécutée.')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    if (!row) return
    await exportMatchPdf({ row, playerName, sessionDate, lastEditedName })
  }

  const inputClass =
    'w-full px-4 py-2 border border-[var(--border-strong)] rounded-input focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 text-[var(--text-main)] bg-[var(--bg-card)] text-base'

  return (
    <div className="fixed inset-0 z-50 bg-[var(--text-main)]/60 backdrop-blur-sm flex items-start justify-center p-0 md:p-4 overflow-y-auto">
      <div className="bg-[var(--bg-card)] text-[var(--text-main)] w-full max-w-3xl md:rounded-card shadow-2xl p-5 md:p-8 my-0 md:my-6 border border-[var(--border-strong)] min-h-full md:min-h-0">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-sora font-bold text-[var(--accent-primary)]">Fiche match – {playerName}</h3>
            <p className="text-[var(--text-muted)] mt-1">{sessionDate}</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-2xl leading-none p-2" aria-label="Fermer">
            ×
          </button>
        </div>

        {loading ? (
          <p className="text-[var(--text-muted)]">Chargement de la fiche…</p>
        ) : (
          <div className="space-y-8">
            {row && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-input bg-[var(--bg-dim)] px-4 py-3 text-sm text-[var(--text-muted)]">
                <span>
                  {row.last_edited_at
                    ? `Dernière modification par ${lastEditedName || '…'} le ${new Date(row.last_edited_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : 'Fiche créée.'}
                </span>
                <Button variant="secondary" onClick={handleExport}>Exporter en PDF</Button>
              </div>
            )}

            {/* ---- Résultat & Score ---- */}
            <section className="space-y-4">
              <SectionTitle>Résultat &amp; Score</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Adversaire</label>
                  <input type="text" value={form.adversaire} onChange={(e) => setForm((c) => ({ ...c, adversaire: e.target.value }))} className={inputClass} placeholder="Nom de l’adversaire" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Tournoi</label>
                  <input type="text" value={form.tournament_name} onChange={(e) => setForm((c) => ({ ...c, tournament_name: e.target.value }))} className={inputClass} placeholder="Ex : ITF Juniors Tunis" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Tour / round</label>
                  <input type="text" value={form.round} onChange={(e) => setForm((c) => ({ ...c, round: e.target.value }))} className={inputClass} placeholder="Ex : demi-finale" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Surface</label>
                  <input type="text" value={form.surface} onChange={(e) => setForm((c) => ({ ...c, surface: e.target.value }))} className={inputClass} placeholder="Ex : terre battue" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_44px] gap-2 text-sm font-semibold text-[var(--text-muted)] px-1">
                  <span>{playerName}</span>
                  <span>Adversaire</span>
                  <span />
                </div>
                {form.sets.map((set, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_44px] gap-2 items-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={99}
                      value={set.player}
                      onChange={(e) => updateSet(index, 'player', e.target.value)}
                      className={`px-3 py-2 text-center text-lg font-sora font-bold tabular-nums rounded-input border focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 bg-[var(--bg-card)] ${
                        set.player + set.opponent > 0 && set.player > set.opponent
                          ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                          : 'border-[var(--border-strong)] text-[var(--text-main)]'
                      }`}
                      aria-label={`Jeux ${playerName} set ${index + 1}`}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={99}
                      value={set.opponent}
                      onChange={(e) => updateSet(index, 'opponent', e.target.value)}
                      className={`px-3 py-2 text-center text-lg font-sora font-bold tabular-nums rounded-input border focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30 bg-[var(--bg-card)] ${
                        set.player + set.opponent > 0 && set.opponent > set.player
                          ? 'border-[var(--accent-secondary-dark)] text-[var(--accent-secondary-dark)]'
                          : 'border-[var(--border-strong)] text-[var(--text-main)]'
                      }`}
                      aria-label={`Jeux adversaire set ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeSet(index)}
                      disabled={form.sets.length <= 1}
                      className="h-11 w-11 rounded-input border border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--bg-clay-muted)] transition disabled:opacity-40"
                      aria-label={`Supprimer le set ${index + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={addSet}
                    disabled={form.sets.length >= MAX_SETS}
                    className="px-4 py-2 rounded-input border border-[var(--border-strong)] text-sm font-semibold text-[var(--text-main)] hover:bg-[var(--bg-dim)] transition disabled:opacity-40"
                  >
                    + Ajouter un set
                  </button>
                  <div className="flex items-center gap-3">
                    <select
                      value={form.result_override}
                      onChange={(e) => setForm((c) => ({ ...c, result_override: e.target.value }))}
                      className="px-3 py-2 rounded-input border border-[var(--border-strong)] bg-[var(--bg-card)] text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]/30"
                    >
                      <option value="">Résultat déduit des sets</option>
                      <option value="abandon">Abandon</option>
                      <option value="non_joue">Non joué</option>
                    </select>
                    {result && (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          result === 'victoire'
                            ? 'bg-[var(--bg-green-muted)] text-[var(--accent-primary)]'
                            : result === 'defaite'
                              ? 'bg-[var(--bg-clay-muted)] text-[var(--accent-secondary-dark)]'
                              : 'bg-[var(--bg-dim)] text-[var(--text-muted)]'
                        }`}
                      >
                        {MATCH_RESULT_LABELS[result]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ---- Statistiques de service ---- */}
            <section className="space-y-3">
              <SectionTitle>Statistiques de service</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumberStepper label="Aces" value={form.aces} onChange={(v) => setForm((c) => ({ ...c, aces: v }))} />
                <NumberStepper label="Doubles fautes" value={form.double_faults} onChange={(v) => setForm((c) => ({ ...c, double_faults: v }))} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">% première balle</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={form.first_serve_percent}
                  onChange={(e) => setForm((c) => ({ ...c, first_serve_percent: e.target.value }))}
                  className={inputClass}
                  placeholder="Ex : 62"
                />
              </div>
            </section>

            {/* ---- Statistiques de jeu ---- */}
            <section className="space-y-3">
              <SectionTitle>Statistiques de jeu</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumberStepper label="Winners" value={form.winners} onChange={(v) => setForm((c) => ({ ...c, winners: v }))} />
                <NumberStepper label="Erreurs directes" value={form.direct_errors} onChange={(v) => setForm((c) => ({ ...c, direct_errors: v }))} />
                <NumberStepper label="Balles de break gagnées" value={form.break_points_won} onChange={(v) => setForm((c) => ({ ...c, break_points_won: v }))} />
                <NumberStepper label="Balles de break jouées" value={form.break_points_total} onChange={(v) => setForm((c) => ({ ...c, break_points_total: v }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-input bg-[var(--bg-dim)] px-4 py-3 flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Ratio winners / erreurs</span>
                  <span className="font-sora font-bold text-[var(--text-main)] tabular-nums">{ratio ?? '—'}</span>
                </div>
                <div className="rounded-input bg-[var(--bg-dim)] px-4 py-3 flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Breaks convertis</span>
                  <span className="font-sora font-bold text-[var(--text-main)] tabular-nums">{breakPercent === null ? '—' : `${breakPercent} %`}</span>
                </div>
              </div>
            </section>

            {/* ---- Notes ---- */}
            <section className="space-y-3">
              <SectionTitle>Notes</SectionTitle>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
                className={`${inputClass} min-h-[100px]`}
                placeholder="Points forts, axes de travail, contexte du match…"
              />
            </section>

            {error && <p className="text-sm text-[var(--accent-secondary-dark)]">{error}</p>}
            {success && <p className="text-sm text-[var(--accent-primary)]">{success}</p>}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-[var(--border-subtle)] pt-4">
              <div className="text-sm text-[var(--text-muted)] space-y-1">
                <div>
                  Complétion : <span className="font-semibold text-[var(--text-main)]">{completion.filled}/{completion.total}</span> champs remplis
                </div>
                {draftRestored && <div>Brouillon local restauré.</div>}
                {!row && draftSavedAt && <div>Brouillon enregistré à {draftSavedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.</div>}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={onClose}>Fermer</Button>
                <Button variant="accent" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
