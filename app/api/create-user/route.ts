import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Generate a random temporary password
function generateTempPassword(): string {
  const length = 12
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}

export async function POST(request: NextRequest) {
  try {
    const { email, name, role, playerId } = await request.json()

    if (!email || !name || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: email, name, role' },
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

    // Generate temporary password
    const tempPassword = generateTempPassword()

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
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
    const { data: userData, error: dbError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email,
          nom: name,
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

    // If parent, link to player
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
        console.error('Warning: Failed to link parent to player:', linkError)
        // Don't fail the whole request, just log warning
      }
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: authData.user.id,
          email,
          nom: name,
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
