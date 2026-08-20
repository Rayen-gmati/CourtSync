-- ============================================================================
-- CourtSync — Durcissement RLS global (remplace les policies temporaires)
-- Date : 2026-08-18
--
-- CONSTAT : `temp_allow_authenticated` (cmd = ALL) était posée sur 11 tables :
--   goals, matches, periods, player_parents, players, session_coaches,
--   session_goals, sessions, tournaments, users, weekly_ratings.
-- Conséquence : tout utilisateur authentifié pouvait lire/modifier/supprimer
-- TOUTES les données (séances d'autres joueurs, montants coachs, notations
-- d'autres parents…). Les tables `reclamations` (policies propres) et
-- `match_details` (non créée) ne sont pas concernées.
--
-- Cette migration, idempotente :
--   1. crée les fonctions d'aide SECURITY DEFINER ;
--   2. supprime `temp_allow_authenticated` sur les 11 tables ;
--   3. pose les vraies policies scopées par rôle :
--        - coach / coach_admin : accès complet ;
--        - parent : lecture limitée aux joueurs liés (player_parents) ;
--        - session_coaches : COACH UNIQUEMENT (montants sensibles) ;
--        - weekly_ratings : parent = lecture + écriture pour SES enfants,
--          strictement en son nom (parent_id = auth.uid()) ;
--        - users : lecture scopée, update anti-escalade, aucun insert/delete
--          côté client (via /api/create-user en service_role).
--
-- Rend optionnel 20260818_users_rls_restrictive.sql (tout y est inclus).
-- Modèle : service_role (routes API) ignore la RLS → earnings/météo/création
-- de comptes non impactés.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fonctions d'aide (SECURITY DEFINER : évite la récursion RLS sur users)
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

create or replace function public.is_coach_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and role = 'coach_admin'
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

-- Valeurs actuelles de l'appelant, lues hors RLS : garde-fou anti-escalade
-- (impossible de changer son propre rôle / email via PostgREST).
create or replace function public.own_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.own_email()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select email from public.users where id = auth.uid()
$$;

grant execute on function public.is_coach()       to authenticated, anon;
grant execute on function public.is_coach_admin() to authenticated, anon;
grant execute on function public.is_parent_of(uuid) to authenticated, anon;
grant execute on function public.own_role()       to authenticated, anon;
grant execute on function public.own_email()      to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. RLS activée + suppression des policies temporaires et préfixées
-- ---------------------------------------------------------------------------
alter table public.users           enable row level security;
alter table public.players         enable row level security;
alter table public.player_parents  enable row level security;
alter table public.sessions        enable row level security;
alter table public.session_coaches enable row level security;
alter table public.session_goals   enable row level security;
alter table public.goals           enable row level security;
alter table public.periods         enable row level security;
alter table public.tournaments     enable row level security;
alter table public.matches         enable row level security;
alter table public.weekly_ratings  enable row level security;

drop policy if exists temp_allow_authenticated on public.users;
drop policy if exists temp_allow_authenticated on public.players;
drop policy if exists temp_allow_authenticated on public.player_parents;
drop policy if exists temp_allow_authenticated on public.sessions;
drop policy if exists temp_allow_authenticated on public.session_coaches;
drop policy if exists temp_allow_authenticated on public.session_goals;
drop policy if exists temp_allow_authenticated on public.goals;
drop policy if exists temp_allow_authenticated on public.periods;
drop policy if exists temp_allow_authenticated on public.tournaments;
drop policy if exists temp_allow_authenticated on public.matches;
drop policy if exists temp_allow_authenticated on public.weekly_ratings;

-- Anciennes policies préfixées (au cas où une exécution antérieure aurait eu lieu)
drop policy if exists users_select_self_or_coach on public.users;
drop policy if exists users_select               on public.users;
drop policy if exists users_update_self_or_admin on public.users;
drop policy if exists players_coach_all      on public.players;
drop policy if exists players_parent_select  on public.players;
drop policy if exists pp_coach_all           on public.player_parents;
drop policy if exists pp_parent_select       on public.player_parents;
drop policy if exists sessions_coach_all     on public.sessions;
drop policy if exists sessions_parent_select on public.sessions;
drop policy if exists sc_coach_all           on public.session_coaches;
drop policy if exists sg_coach_all           on public.session_goals;
drop policy if exists sg_parent_select       on public.session_goals;
drop policy if exists goals_coach_all        on public.goals;
drop policy if exists goals_parent_select    on public.goals;
drop policy if exists periods_coach_all      on public.periods;
drop policy if exists periods_parent_select  on public.periods;
drop policy if exists tournaments_coach_all     on public.tournaments;
drop policy if exists tournaments_parent_select on public.tournaments;
drop policy if exists matches_coach_all      on public.matches;
drop policy if exists matches_parent_select  on public.matches;
drop policy if exists wr_coach_all       on public.weekly_ratings;
drop policy if exists wr_parent_select   on public.weekly_ratings;
drop policy if exists wr_parent_insert   on public.weekly_ratings;
drop policy if exists wr_parent_update   on public.weekly_ratings;

-- ---------------------------------------------------------------------------
-- 3. Policies scopées
-- ---------------------------------------------------------------------------

-- USERS : lecture = soi-même / coachs = tout / parents = lignes coachs
-- (destinataires réclamations). Update = soi-même sans changer rôle+email,
-- ou coach_admin. Aucun insert/delete côté client.
create policy users_select on public.users
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_coach()
    or (
      role in ('coach', 'coach_admin')
      and exists (select 1 from public.player_parents pp where pp.user_id = auth.uid())
    )
  );

create policy users_update_self_or_admin on public.users
  for update to authenticated
  using (id = auth.uid() or public.is_coach_admin())
  with check (
    public.is_coach_admin()
    or (id = auth.uid() and role = public.own_role() and email = public.own_email())
  );

-- PLAYERS : coach = tout ; parent = lecture de ses enfants.
create policy players_coach_all on public.players
  for all using (public.is_coach()) with check (public.is_coach());
create policy players_parent_select on public.players
  for select using (public.is_parent_of(id));

-- PLAYER_PARENTS : coach = tout ; chacun lit ses propres liens.
create policy pp_coach_all on public.player_parents
  for all using (public.is_coach()) with check (public.is_coach());
create policy pp_parent_select on public.player_parents
  for select using (user_id = auth.uid());

-- SESSIONS : coach = tout ; parent = lecture des séances de ses enfants.
create policy sessions_coach_all on public.sessions
  for all using (public.is_coach()) with check (public.is_coach());
create policy sessions_parent_select on public.sessions
  for select using (public.is_parent_of(player_id));

-- SESSION_COACHES (montant_coach sensible) : COACH UNIQUEMENT.
-- Aucune policy parent → les montants ne sont jamais exposés aux parents.
create policy sc_coach_all on public.session_coaches
  for all using (public.is_coach()) with check (public.is_coach());

-- SESSION_GOALS : coach = tout ; parent = liens des séances de ses enfants.
create policy sg_coach_all on public.session_goals
  for all using (public.is_coach()) with check (public.is_coach());
create policy sg_parent_select on public.session_goals
  for select using (
    exists (
      select 1 from public.sessions s
      where s.id = session_goals.session_id
        and public.is_parent_of(s.player_id)
    )
  );

-- GOALS : coach = tout ; parent = lecture des objectifs de ses enfants.
create policy goals_coach_all on public.goals
  for all using (public.is_coach()) with check (public.is_coach());
create policy goals_parent_select on public.goals
  for select using (public.is_parent_of(player_id));

-- PERIODS : coach = tout ; parent = lecture des périodes de ses enfants.
create policy periods_coach_all on public.periods
  for all using (public.is_coach()) with check (public.is_coach());
create policy periods_parent_select on public.periods
  for select using (public.is_parent_of(player_id));

-- TOURNAMENTS : coach = tout ; parent = lecture des tournois de ses enfants.
create policy tournaments_coach_all on public.tournaments
  for all using (public.is_coach()) with check (public.is_coach());
create policy tournaments_parent_select on public.tournaments
  for select using (public.is_parent_of(player_id));

-- MATCHES (table historique) : coach = tout ; parent = lecture de ses enfants.
create policy matches_coach_all on public.matches
  for all using (public.is_coach()) with check (public.is_coach());
create policy matches_parent_select on public.matches
  for select using (public.is_parent_of(player_id));

-- WEEKLY_RATINGS : coach = tout ; parent = lecture + écriture pour ses
-- enfants, strictement en son nom (parent_id = auth.uid() sur insert ET
-- update : un parent ne peut pas modifier la note posée par l'autre parent).
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
-- VÉRIFICATIONS POST-APPLICATION (éditeur SQL) :
--
--   -- 1. Plus aucune policy temporaire :
--   select count(*) from pg_policies where policyname like 'temp_%';
--   -- attendu : 0
--
--   -- 2. Inventaire complet des policies :
--   select tablename, policyname, cmd from pg_policies order by 1, 2;
--
--   -- 3. Test négatif en condition réelle : connectez-vous avec un compte
--   -- PARENT puis, dans l'app, vérifiez qu'il ne voit que son enfant
--   -- (calendrier, historique, notations) et que le sélecteur de
--   -- destinataires des réclamations liste bien les coachs.
--
-- ROLLBACK D'URGENCE (si l'app casse en test) : recréer temporairement
--   create policy temp_allow_authenticated on public.<table>
--     for all to authenticated using (true);
-- ============================================================================
