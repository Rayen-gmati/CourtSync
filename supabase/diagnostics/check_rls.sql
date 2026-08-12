-- ============================================================================
-- CourtSync — Diagnostic RLS (LECTURE SEULE, ne modifie rien)
-- À exécuter dans Supabase → SQL Editor. Colle le résultat des 3 requêtes.
-- ============================================================================

-- 1) RLS activée ou non, table par table (schéma public)
SELECT
  c.relname                         AS table_name,
  c.relrowsecurity                  AS rls_enabled,
  c.relforcerowsecurity             AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- 2) Policies existantes (s'il y en a)
SELECT
  schemaname,
  tablename,
  policyname,
  cmd            AS command,
  roles,
  qual           AS using_expression,
  with_check     AS check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3) Colonnes réelles des tables sensibles (pour caler les policies)
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'users','players','player_parents','sessions','session_coaches',
    'session_goals','goals','periods','tournaments','matches','weekly_ratings'
  )
ORDER BY table_name, ordinal_position;
