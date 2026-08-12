-- ============================================================================
-- CourtSync — Activation de Row Level Security (RLS) + policies
-- Date : 2026-08-12
--
-- ⚠️ AVANT D'APPLIQUER :
--   1. Lance d'abord supabase/diagnostics/check_rls.sql (requêtes 1 & 2) pour
--      voir si des policies existent déjà. Ce script ne supprime QUE les
--      policies qu'il crée (noms préfixés) ; d'éventuelles policies existantes
--      d'un autre nom resteront actives (les policies permissives se cumulent
--      en OR — à vérifier).
--   2. Teste sur un environnement de copie/branche AVANT la prod : une policy
--      trop stricte casse l'app (requêtes vides), une trop laxiste = fuite.
--
-- Modèle d'accès :
--   - service_role (routes API serveur : earnings, weather, create-user,
--     auth/session) IGNORE la RLS → ces fonctionnalités ne sont pas impactées.
--   - coach / coach_admin : accès complet (via clé anon + JWT côté client).
--   - parent : lecture seule, limitée aux joueurs qui lui sont liés
--     (player_parents). N'a AUCUN accès à session_coaches (montant_coach).
--
-- Rollback : voir le bloc commenté en fin de fichier.
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
-- Activation de la RLS sur toutes les tables sensibles
-- ---------------------------------------------------------------------------
alter table public.users            enable row level security;
alter table public.players          enable row level security;
alter table public.player_parents   enable row level security;
alter table public.sessions         enable row level security;
alter table public.session_coaches  enable row level security;
alter table public.session_goals    enable row level security;
alter table public.goals            enable row level security;
alter table public.periods          enable row level security;
alter table public.tournaments      enable row level security;
alter table public.matches          enable row level security;
alter table public.weekly_ratings   enable row level security;

-- ---------------------------------------------------------------------------
-- USERS : chacun lit sa propre ligne ; un coach lit tout le monde
-- (nécessaire pour la liste des coachs assignables sur la page séances).
-- Aucune écriture côté client (création via la route admin en service_role).
-- ---------------------------------------------------------------------------
drop policy if exists users_select_self_or_coach on public.users;
create policy users_select_self_or_coach on public.users
  for select using (id = auth.uid() or public.is_coach());

-- ---------------------------------------------------------------------------
-- PLAYERS : coach = tout ; parent = ses enfants (lecture)
-- ---------------------------------------------------------------------------
drop policy if exists players_coach_all    on public.players;
drop policy if exists players_parent_select on public.players;
create policy players_coach_all on public.players
  for all using (public.is_coach()) with check (public.is_coach());
create policy players_parent_select on public.players
  for select using (public.is_parent_of(id));

-- ---------------------------------------------------------------------------
-- PLAYER_PARENTS : chacun lit ses liens ; coach = tout
-- (écriture réelle via route admin en service_role)
-- ---------------------------------------------------------------------------
drop policy if exists pp_coach_all      on public.player_parents;
drop policy if exists pp_parent_select  on public.player_parents;
create policy pp_coach_all on public.player_parents
  for all using (public.is_coach()) with check (public.is_coach());
create policy pp_parent_select on public.player_parents
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- SESSIONS : coach = tout ; parent = séances de ses enfants (lecture)
-- ---------------------------------------------------------------------------
drop policy if exists sessions_coach_all     on public.sessions;
drop policy if exists sessions_parent_select on public.sessions;
create policy sessions_coach_all on public.sessions
  for all using (public.is_coach()) with check (public.is_coach());
create policy sessions_parent_select on public.sessions
  for select using (public.is_parent_of(player_id));

-- ---------------------------------------------------------------------------
-- SESSION_COACHES (montant_coach = donnée sensible) : COACH UNIQUEMENT.
-- Aucune policy parent → les parents ne voient jamais les montants.
-- ---------------------------------------------------------------------------
drop policy if exists sc_coach_all on public.session_coaches;
create policy sc_coach_all on public.session_coaches
  for all using (public.is_coach()) with check (public.is_coach());

-- ---------------------------------------------------------------------------
-- SESSION_GOALS : coach = tout ; parent = liens des séances de ses enfants
-- ---------------------------------------------------------------------------
drop policy if exists sg_coach_all     on public.session_goals;
drop policy if exists sg_parent_select on public.session_goals;
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

-- ---------------------------------------------------------------------------
-- GOALS : coach = tout ; parent = objectifs de ses enfants (lecture)
-- ---------------------------------------------------------------------------
drop policy if exists goals_coach_all     on public.goals;
drop policy if exists goals_parent_select on public.goals;
create policy goals_coach_all on public.goals
  for all using (public.is_coach()) with check (public.is_coach());
create policy goals_parent_select on public.goals
  for select using (public.is_parent_of(player_id));

-- ---------------------------------------------------------------------------
-- PERIODS : coach = tout ; parent = périodes de ses enfants (lecture)
-- ---------------------------------------------------------------------------
drop policy if exists periods_coach_all     on public.periods;
drop policy if exists periods_parent_select on public.periods;
create policy periods_coach_all on public.periods
  for all using (public.is_coach()) with check (public.is_coach());
create policy periods_parent_select on public.periods
  for select using (public.is_parent_of(player_id));

-- ---------------------------------------------------------------------------
-- TOURNAMENTS : coach = tout ; parent = tournois de ses enfants (lecture)
-- ---------------------------------------------------------------------------
drop policy if exists tournaments_coach_all     on public.tournaments;
drop policy if exists tournaments_parent_select on public.tournaments;
create policy tournaments_coach_all on public.tournaments
  for all using (public.is_coach()) with check (public.is_coach());
create policy tournaments_parent_select on public.tournaments
  for select using (public.is_parent_of(player_id));

-- ---------------------------------------------------------------------------
-- MATCHES : coach = tout ; parent = matchs de ses enfants (lecture)
-- ---------------------------------------------------------------------------
drop policy if exists matches_coach_all     on public.matches;
drop policy if exists matches_parent_select on public.matches;
create policy matches_coach_all on public.matches
  for all using (public.is_coach()) with check (public.is_coach());
create policy matches_parent_select on public.matches
  for select using (public.is_parent_of(player_id));

-- ---------------------------------------------------------------------------
-- WEEKLY_RATINGS : coach = lecture (tout) ; parent = lecture + écriture pour
-- ses enfants (et seulement en tant que parent_id = lui-même à l'insertion).
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
  for update using (public.is_parent_of(player_id))
  with check (public.is_parent_of(player_id));

-- ============================================================================
-- ROLLBACK (à exécuter manuellement si l'app casse en test) :
--
-- alter table public.users           disable row level security;
-- alter table public.players         disable row level security;
-- alter table public.player_parents  disable row level security;
-- alter table public.sessions        disable row level security;
-- alter table public.session_coaches disable row level security;
-- alter table public.session_goals   disable row level security;
-- alter table public.goals           disable row level security;
-- alter table public.periods         disable row level security;
-- alter table public.tournaments     disable row level security;
-- alter table public.matches         disable row level security;
-- alter table public.weekly_ratings  disable row level security;
-- ============================================================================
