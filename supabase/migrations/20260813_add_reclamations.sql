-- Rubrique « Réclamations » pour les parents :
-- un parent crée ses réclamations (liées ou non à un joueur),
-- il ne voit que les siennes ; les coachs lisent et mettent à jour le statut.

create table if not exists public.reclamations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.users(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  sujet text not null check (char_length(sujet) between 1 and 200),
  message text not null check (char_length(message) between 1 and 2000),
  statut text not null default 'nouvelle' check (statut in ('nouvelle', 'en_cours', 'traitee')),
  coach_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists reclamations_parent_idx on public.reclamations (parent_id, created_at desc);

alter table public.reclamations enable row level security;

-- Parent : lecture + création de ses propres réclamations uniquement.
drop policy if exists reclamations_parent_select on public.reclamations;
create policy reclamations_parent_select on public.reclamations
  for select to authenticated
  using (auth.uid() = parent_id);

drop policy if exists reclamations_parent_insert on public.reclamations;
create policy reclamations_parent_insert on public.reclamations
  for insert to authenticated
  with check (auth.uid() = parent_id);

-- Coach / coach_admin : lecture et mise à jour des réclamations qui lui sont
-- adressées (coach_ids vide = envoyée à tous les coachs).
drop policy if exists reclamations_coach_select on public.reclamations;
create policy reclamations_coach_select on public.reclamations
  for select to authenticated
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('coach', 'coach_admin'))
    and (cardinality(coach_ids) = 0 or auth.uid() = any(coach_ids))
  );

drop policy if exists reclamations_coach_update on public.reclamations;
create policy reclamations_coach_update on public.reclamations
  for update to authenticated
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('coach', 'coach_admin'))
    and (cardinality(coach_ids) = 0 or auth.uid() = any(coach_ids))
  );
