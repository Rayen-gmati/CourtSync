import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireCoachAdmin } from '@/lib/api-auth'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Génère un mot de passe temporaire avec un générateur cryptographiquement
// sûr (256 % 64 = 0 : aucun biais de distribution sur le charset).
function generateTempPassword(): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const bytes = randomBytes(12)
  let password = ''
  for (const byte of bytes) {
    password += charset.charAt(byte % charset.length)
  }
  return password
}

export async function POST(request: NextRequest) {
  try {
    // Contrôle d'accès serveur : la création de comptes est réservée aux
    // administrateurs (le rôle est validé en base, pas via le cookie).
    const admin = await requireCoachAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs.' },
        { status: 403 }
      )
    }

    const { email, name, role, playerId } = await request.json()

    if (!email || !name || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: email, name, role' },
        { status: 400 }
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Adresse email invalide.' },
        { status: 400 }
      )
    }

    const trimmedName = String(name).trim()
    if (trimmedName.length < 2 || trimmedName.length > 120) {
      return NextResponse.json(
        { error: 'Le nom doit contenir entre 2 et 120 caractères.' },
        { status: 400 }
      )
    }

    if (!['coach', 'parent'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "coach" or "parent"' },
        { status: 400 }
      )
    }

    if (role === 'parent' && !playerId) {
      return NextResponse.json(
        { error: 'playerId is required for parent role' },
        { status: 400 }
      )
    }

    // Pour un parent, on vérifie que le joueur associé existe réellement afin
    // de ne pas créer de compte parent orphelin (lien silencieusement perdu).
    if (role === 'parent' && playerId) {
      const { data: playerRow, error: playerError } = await supabaseAdmin
        .from('players')
        .select('id')
        .eq('id', playerId)
        .maybeSingle()

      if (playerError || !playerRow) {
        return NextResponse.json(
          { error: 'Joueur associé introuvable.' },
          { status: 400 }
        )
      }
    }

    // Generate temporary password
    const tempPassword = generateTempPassword()

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: `Failed to create auth user: ${authError?.message}` },
        { status: 500 }
      )
    }

    // Insert into users table
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email: normalizedEmail,
          nom: trimmedName,
          role,
        },
      ])

    if (dbError) {
      // Clean up: delete the created auth user if DB insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `Failed to insert user into database: ${dbError.message}` },
        { status: 500 }
      )
    }

    // If parent, link to player. En cas d'échec du lien, on annule tout
    // (suppression du compte auth + ligne users) pour éviter un parent orphelin.
    if (role === 'parent' && playerId) {
      const { error: linkError } = await supabaseAdmin
        .from('player_parents')
        .insert([
          {
            player_id: playerId,
            user_id: authData.user.id,
          },
        ])

      if (linkError) {
        console.error('Failed to link parent to player, rolling back:', linkError)
        await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json(
          { error: `Failed to link parent to player: ${linkError.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: authData.user.id,
          email: normalizedEmail,
          nom: trimmedName,
          role,
        },
        tempPassword,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in create-user API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
