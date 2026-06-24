import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

async function requireAdmin() {
  const cookieStore = await cookies()
  const session = cookieStore.get('availer_session')
  if (!session) return null
  const { data } = await supabaseAdmin
    .from('availer_logins')
    .select('id, is_admin')
    .eq('id', session.value)
    .single()
  return data?.is_admin ? data : null
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('availer_logins')
    .select('id, username, display_name, is_active, is_admin, months, expires_at, created_at, last_login_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, users: data })
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 })

  const { username, password, display_name, months } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: 'Username and password required' }, { status: 400 })
  }

  const m = parseInt(months) || 1
  const expires_at = new Date()
  expires_at.setMonth(expires_at.getMonth() + m)

  const password_hash = await bcrypt.hash(password, 10)

  const { data, error } = await supabaseAdmin
    .from('availer_logins')
    .insert({ username, password_hash, display_name: display_name || null, months: m, expires_at: expires_at.toISOString(), is_active: true, is_admin: false })
    .select('id, username, display_name, is_active, months, expires_at, created_at')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, user: data })
}
