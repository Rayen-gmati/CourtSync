import { createLazySupabaseClient } from '@/lib/create-lazy-supabase'

// Client service_role (côté serveur UNIQUEMENT : routes /api/*, lib serveur).
// Paresseux : le build ne casse plus si le secret est absent de l'environnement
// de build ; l'erreur n'apparaît qu'au premier usage runtime.
export const supabaseAdmin = createLazySupabaseClient(
  () => ({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }),
  'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables',
  { auth: { autoRefreshToken: false, persistSession: false } },
  { url: 'NEXT_PUBLIC_SUPABASE_URL', key: 'SUPABASE_SERVICE_ROLE_KEY' }
)
