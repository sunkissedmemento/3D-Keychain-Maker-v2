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
    .select('id, username, password, is_active')
    .eq('username', username)
    .single()

  if (error || !user || !user.is_active) {
    return NextResponse.json({ ok: false, error: 'Invalid username or password' }, { status: 401 })
  }

  const passwordMatch = await bcrypt.compare(password, user.password)

  if (!passwordMatch) {
    return NextResponse.json({ ok: false, error: 'Invalid username or password' }, { status: 401 })
  }

  // Update last_login_at if column exists
  await supabaseAdmin
    .from('availer_logins')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id)

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, username: user.username },
  })

  response.cookies.set('availer_session', user.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  return response
}
