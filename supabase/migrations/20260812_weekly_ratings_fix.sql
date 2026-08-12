-- ============================================================================
-- CourtSync — Correctif notation hebdomadaire (weekly_ratings)
-- Date : 2026-08-12
--
-- Objet :
--   - Parent : peut enregistrer ET modifier SA note (une note par parent) pour
--     un joueur qui lui est lié — bug « Impossible d'enregistrer » = RLS activée
--     sans policy INSERT effective sur la base réelle.
--   - Coach : lecture de toutes les notes (déjà couvert par wr_coach_all).
--   - Contrainte d'unicité (player_id, week_start, parent_id) requise par l'UPSERT
--     côté front (on conflict) et pour empêcher les doublons.
--
-- Idempotent : ré-exécutable sans risque. À lancer dans Supabase → SQL Editor.
-- Vérification avant/après : supabase/diagnostics/check_rls.sql (requêtes 1 & 2).
--
-- Ce fichier est autonome : il re-déclare les helpers is_coach()/is_parent_of()
-- (create or replace = sans effet s'ils existent déjà via 20260812_rls_policies.sql).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Fonctions d'aide (SECURITY DEFINER pour éviter la récursion RLS sur users)
-- ---------------------------------------------------------------------------
create or replace function public.is_coach()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and role in ('coach', 'coach_admin')
  );
$$;

create or replace function public.is_parent_of(p_player uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.player_parents
    where user_id = auth.uid()
      and player_id = p_player
  );
$$;

grant execute on function public.is_coach() to authenticated, anon;
grant execute on function public.is_parent_of(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- RLS activée sur la table
-- ---------------------------------------------------------------------------
alter table public.weekly_ratings enable row level security;

-- ---------------------------------------------------------------------------
-- Dédoublonnage défensif AVANT la contrainte d'unicité : conserve une seule
-- ligne par (player_id, week_start, parent_id). Le comparateur `is not distinct
-- from` gère un éventuel parent_id NULL (NULL = NULL ne matcherait pas).
-- ---------------------------------------------------------------------------
delete from public.weekly_ratings a
using public.weekly_ratings b
where a.ctid < b.ctid
  and a.player_id = b.player_id
  and a.week_start = b.week_start
  and a.parent_id is not distinct from b.parent_id;

-- ---------------------------------------------------------------------------
-- Contrainte d'unicité (player_id, week_start, parent_id) — cible du ON CONFLICT
-- de l'UPSERT côté front. Ajoutée seulement si absente (idempotent).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.weekly_ratings'::regclass
      and conname = 'weekly_ratings_player_week_parent_key'
  ) then
    alter table public.weekly_ratings
      add constraint weekly_ratings_player_week_parent_key
      unique (player_id, week_start, parent_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Policies (idempotentes) :
--   - coach  : accès complet (lecture de toutes les notes).
--   - parent : lecture + INSERT/UPDATE limités à ses enfants (player_parents)
--     ET à ses propres notes (parent_id = auth.uid()).
-- Note : wr_parent_update est RESSERRÉE (parent_id = auth.uid() dans using ET
-- with check) → un parent ne peut plus modifier la note d'un autre parent.
-- ---------------------------------------------------------------------------
drop policy if exists wr_coach_all      on public.weekly_ratings;
drop policy if exists wr_parent_select  on public.weekly_ratings;
drop policy if exists wr_parent_insert  on public.weekly_ratings;
drop policy if exists wr_parent_update  on public.weekly_ratings;

create policy wr_coach_all on public.weekly_ratings
  for all using (public.is_coach()) with check (public.is_coach());

create policy wr_parent_select on public.weekly_ratings
  for select using (public.is_parent_of(player_id));

create policy wr_parent_insert on public.weekly_ratings
  for insert with check (public.is_parent_of(player_id) and parent_id = auth.uid());

create policy wr_parent_update on public.weekly_ratings
  for update using (public.is_parent_of(player_id) and parent_id = auth.uid())
  with check (public.is_parent_of(player_id) and parent_id = auth.uid());

-- ============================================================================
-- ROLLBACK (manuel, si besoin) :
--
-- alter table public.weekly_ratings
--   drop constraint if exists weekly_ratings_player_week_parent_key;
-- -- (les policies wr_* restent celles de 20260812_rls_policies.sql)
-- ============================================================================
