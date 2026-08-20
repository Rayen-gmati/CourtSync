-- ============================================================================
-- CourtSync — Sécurisation RLS de la table `users`
-- Date : 2026-08-18
--
-- PROBLÈME : la policy temporaire `temp_allow_authenticated` (cmd = ALL)
-- donnait lecture/écriture/suppression complète sur `users` à TOUT
-- utilisateur authentifié (escalade de rôle possible, données exposées).
--
-- Cette migration :
--   1. supprime `temp_allow_authenticated` sur `users` ;
--   2. met en place des policies restrictives :
--      - SELECT : sa propre ligne ; un coach voit tout le monde ; un parent
--        peut lister les coachs (destinataires des réclamations) ;
--      - UPDATE : sa propre ligne UNIQUEMENT, sans pouvoir changer son rôle
--        ni son email (anti-escalade) ; coach_admin = gestion des comptes ;
--      - INSERT / DELETE : AUCUNE policy côté client — la création et la
--        suppression de comptes passent par /api/create-user (service_role).
--
-- Idempotente : réutilisable telle quelle.
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

-- Rôle / email actuels de l'appelant, lus hors RLS : servent de garde-fou
-- dans WITH CHECK pour empêcher un utilisateur de modifier son propre rôle
-- (escalade de privilèges) ou son email (désync avec auth.users).
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
grant execute on function public.own_role()       to authenticated, anon;
grant execute on function public.own_email()      to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Nettoyage : policy temporaire + anciennes policies préfixées
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;

drop policy if exists temp_allow_authenticated   on public.users;
drop policy if exists users_select_self_or_coach on public.users;
drop policy if exists users_select               on public.users;
drop policy if exists users_update               on public.users;
drop policy if exists users_update_self_or_admin on public.users;
drop policy if exists users_insert               on public.users;
drop policy if exists users_delete               on public.users;

-- ---------------------------------------------------------------------------
-- SELECT :
--   - chacun lit sa propre ligne ;
--   - un coach / coach_admin lit tout le monde (listes de l'espace coach) ;
--   - un parent (lié via player_parents) lit les lignes des coachs,
--     nécessaire au choix des destinataires des réclamations.
-- ---------------------------------------------------------------------------
create policy users_select on public.users
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_coach()
    or (
      role in ('coach', 'coach_admin')
      and exists (
        select 1 from public.player_parents pp
        where pp.user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- UPDATE :
--   - utilisateur lambda : uniquement sa propre ligne, et WITH CHECK impose
--     que `role` et `email` restent inchangés (impossible de s'auto-promouvoir
--     coach_admin ou de changer son email côté PostgREST) ;
--   - coach_admin : peut gérer n'importe quel compte.
-- ---------------------------------------------------------------------------
create policy users_update_self_or_admin on public.users
  for update to authenticated
  using (
    id = auth.uid()
    or public.is_coach_admin()
  )
  with check (
    public.is_coach_admin()
    or (
      id = auth.uid()
      and role  = public.own_role()
      and email = public.own_email()
    )
  );

-- ---------------------------------------------------------------------------
-- INSERT / DELETE : volontairement AUCUNE policy.
-- La création et la suppression de comptes passent exclusivement par la
-- route serveur /api/create-user (clé service_role, réservée coach_admin),
-- qui contourne la RLS de façon contrôlée.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- VÉRIFICATION POST-APPLICATION (à lancer dans l'éditeur SQL) :
--
--   select policyname, cmd
--   from pg_policies
--   where tablename = 'users'
--   order by policyname;
--
-- Résultat attendu :
--   users_select             | SELECT
--   users_update_self_or_admin | UPDATE
--
-- IMPORTANT — vérifier si la policy temporaire existe aussi sur d'autres
-- tables (si oui, me le signaler : je fournis la migration de durcissement
-- complète pour les remplacer par les vraies policies) :
--
--   select tablename, policyname, cmd
--   from pg_policies
--   where policyname like 'temp_%'
--   order by tablename;
-- ---------------------------------------------------------------------------
