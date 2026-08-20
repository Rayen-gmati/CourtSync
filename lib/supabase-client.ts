import { createLazySupabaseClient } from '@/lib/create-lazy-supabase'

// Client anon côté navigateur (alias historique de lib/supabase).
// Paresseux : l'erreur de configuration n'apparaît qu'au premier usage.
export const supabase = createLazySupabaseClient(
  () => ({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }),
  'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env variables',
  undefined,
  { url: 'NEXT_PUBLIC_SUPABASE_URL', key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY' }
)
