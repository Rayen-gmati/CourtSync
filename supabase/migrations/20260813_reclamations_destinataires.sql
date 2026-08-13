-- Réclamations : le parent choisit le(s) coach(s) destinataire(s).
-- coach_ids vide = envoyée à tous les coachs (compatibilité avec les lignes existantes).

alter table public.reclamations add column if not exists coach_ids uuid[] not null default '{}';

-- Un coach ne voit / ne traite que les réclamations qui lui sont adressées
-- (ou envoyées à tous les coachs).
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
