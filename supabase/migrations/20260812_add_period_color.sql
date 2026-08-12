-- CourtSync : couleur stable par période pour l'overlay du calendrier.
-- Assignée une seule fois à la création (hash déterministe), stockée en base
-- pour garantir la stabilité visuelle dans le temps.
--
-- À exécuter dans l'éditeur SQL Supabase (le DDL n'est pas possible via l'API REST).

alter table if exists public.periods
  add column if not exists color text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'periods_color_format') then
    alter table public.periods
      add constraint periods_color_format
      check (color is null or color ~ '^#[0-9a-fA-F]{6}$');
  end if;
end $$;

comment on column public.periods.color is
  'Couleur hex attribuée à la création pour l''overlay du calendrier (stable dans le temps).';
