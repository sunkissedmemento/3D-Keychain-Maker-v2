import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  const { username, password } = await req.json()

  const { data: user, error } = await supabaseAdmin
    .from('availer_logins')
    .select('id, username, password_hash, is_active')
    .eq('username', username)
    .single()

  console.log('LOGIN DEBUG:', {
    username,
    hasPassword: !!password,
    user,
    error,
  })

  if (error || !user || !user.is_active) {
    return NextResponse.json(
      { ok: false, error: 'User not found or inactive' },
      { status: 401 }
    )
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash)

  console.log('PASSWORD MATCH:', passwordMatch)

  if (!passwordMatch) {
    return NextResponse.json(
      { ok: false, error: 'Password does not match' },
      { status: 401 }
    )
  }

  const response = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
    },
  })

  response.cookies.set('availer_session', user.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
  })

  return response
}