import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Cookies d'authentification posés côté serveur en HttpOnly : le JWT n'est
// plus lisible par du JavaScript (protection contre le vol de session par XSS).
// Secure est activé en production ; SameSite=Lax limite l'exposition CSRF.
const COOKIE_NAMES = ['auth_token', 'user_role', 'user_name'] as const

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  }
}

// POST : établit la session. Le client envoie l'access_token Supabase obtenu
// après signInWithPassword ; on le vérifie et on relit le rôle en base (source
// de vérité) avant de poser les cookies. Renvoie le rôle pour la redirection.
export async function POST(request: NextRequest) {
  let accessToken: string | undefined
  try {
    const body = await request.json()
    accessToken = body?.accessToken
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  if (!accessToken) {
    return NextResponse.json({ error: 'Token manquant.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
  if (error || !data.user) {
    return NextResponse.json({ error: 'Token invalide.' }, { status: 401 })
  }

  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('role, nom')
    .eq('id', data.user.id)
    .single()

  if (userError || !userData) {
    return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 403 })
  }

  const response = NextResponse.json({ role: userData.role, nom: userData.nom })
  response.cookies.set('auth_token', accessToken, baseCookieOptions())
  response.cookies.set('user_role', userData.role, baseCookieOptions())
  response.cookies.set('user_name', userData.nom ?? '', baseCookieOptions())
  return response
}

// DELETE : déconnexion — efface les trois cookies.
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  for (const name of COOKIE_NAMES) {
    response.cookies.set(name, '', { ...baseCookieOptions(), maxAge: 0 })
  }
  return response
}
