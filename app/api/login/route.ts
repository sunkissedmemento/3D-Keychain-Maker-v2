import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: 'Missing credentials' }, { status: 400 })
  }

  const { data: user, error } = await supabaseAdmin
    .from('availer_logins')
    .select('id, username, password_hash, is_active, is_admin, expires_at')
    .eq('username', username)
    .single()

  if (error || !user) {
    return NextResponse.json({ ok: false, error: 'Invalid username or password' }, { status: 401 })
  }

  if (!user.is_active) {
    return NextResponse.json({ ok: false, error: 'Account is disabled' }, { status: 401 })
  }

  // Check expiry (null = never expires)
  if (user.expires_at && new Date(user.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: 'Account has expired' }, { status: 401 })
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatch) {
    return NextResponse.json({ ok: false, error: 'Invalid username or password' }, { status: 401 })
  }

  await supabaseAdmin
    .from('availer_logins')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id)

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, username: user.username, is_admin: user.is_admin },
  })

  response.cookies.set('availer_session', user.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  // Separate admin flag cookie (not httpOnly so client can read)
  response.cookies.set('availer_is_admin', user.is_admin ? '1' : '0', {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  return response
}
