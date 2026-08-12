import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type ApiCoach = { id: string; role: string }

// Contrôle d'accès côté API : valide le JWT du cookie auth_token puis lit le
// rôle en base (le cookie user_role n'est jamais pris comme source de vérité).
export async function requireCoach(): Promise<ApiCoach | null> {
  const token = cookies().get('auth_token')?.value
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, role')
    .eq('id', data.user.id)
    .single()

  if (!user || !['coach', 'coach_admin'].includes(user.role)) return null
  return user as ApiCoach
}

// Contrôle d'accès réservé aux administrateurs (création de comptes, etc.).
// Réutilise la validation JWT + rôle-en-base de requireCoach, puis exige
// explicitement le rôle coach_admin.
export async function requireCoachAdmin(): Promise<ApiCoach | null> {
  const coach = await requireCoach()
  if (!coach || coach.role !== 'coach_admin') return null
  return coach
}
