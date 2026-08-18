-- Fiche match professionnelle : statistiques détaillées liées à une séance de type « match ».
-- Saisie par le coach OU le parent du joueur concerné (last write wins).

create table if not exists public.match_details (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  adversaire text not null default '',
  tournament_name text,
  round text,
  surface text,
  -- [{ "player": 6, "opponent": 4 }, ...] un élément par set (1 à 5)
  sets jsonb not null default '[]'::jsonb,
  -- Override manuel du résultat déduit des sets (abandon, non joué)
  result_override text check (result_override in ('abandon', 'non_joue')),
  aces integer not null default 0,
  double_faults integer not null default 0,
  first_serve_percent integer check (first_serve_percent is null or first_serve_percent between 0 and 100),
  winners integer not null default 0,
  direct_errors integer not null default 0,
  break_points_won integer not null default 0,
  break_points_total integer not null default 0,
  notes text,
  last_edited_by uuid references public.users(id) on delete set null,
  last_edited_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists match_details_player_idx on public.match_details (player_id, created_at desc);

alter table public.match_details enable row level security;

-- Lecture : coachs (tous) + parent lié au joueur.
drop policy if exists match_details_select on public.match_details;
create policy match_details_select on public.match_details
  for select to authenticated
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('coach', 'coach_admin'))
    or exists (select 1 from public.player_parents pp where pp.user_id = auth.uid() and pp.player_id = match_details.player_id)
  );

-- Création / modification : coach OU parent du joueur lié (jamais un autre joueur).
drop policy if exists match_details_insert on public.match_details;
create policy match_details_insert on public.match_details
  for insert to authenticated
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('coach', 'coach_admin'))
    or exists (select 1 from public.player_parents pp where pp.user_id = auth.uid() and pp.player_id = match_details.player_id)
  );

drop policy if exists match_details_update on public.match_details;
create policy match_details_update on public.match_details
  for update to authenticated
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('coach', 'coach_admin'))
    or exists (select 1 from public.player_parents pp where pp.user_id = auth.uid() and pp.player_id = match_details.player_id)
  );

-- Suppression réservée aux coachs.
drop policy if exists match_details_delete on public.match_details;
create policy match_details_delete on public.match_details
  for delete to authenticated
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('coach', 'coach_admin'))
  );
