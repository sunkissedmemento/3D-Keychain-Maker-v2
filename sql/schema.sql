-- ============================================================
-- 3D Keychain Maker v2 — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable pgcrypto for password hashing (available by default in Supabase)
create extension if not exists pgcrypto;

-- ── availer_logins ────────────────────────────────────────────────────────────
-- Custom username/password auth table (NOT Supabase Auth)
-- Passwords are hashed with bcrypt via bcryptjs on the server

create table if not exists public.availer_logins (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,          -- bcrypt hash, generated server-side
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- Index for fast username lookup on login
create index if not exists availer_logins_username_idx on public.availer_logins (username);

-- RLS: table should NOT be exposed to anon/public — only service role
alter table public.availer_logins enable row level security;

-- No public policies — all access goes through service role key (supabaseAdmin)
-- This means anon key cannot read/write this table at all

-- ── Helper: create a user (run manually in SQL editor) ────────────────────────
-- Usage: call create_availer_user('yourname', 'yourpassword');
-- NOTE: This uses pgcrypto's crypt() with bf (blowfish/bcrypt).
--       The bcryptjs library on the server is compatible with this format.

create or replace function public.create_availer_user(
  p_username text,
  p_password text
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.availer_logins (username, password_hash)
  values (p_username, crypt(p_password, gen_salt('bf', 10)));
end;
$$;

-- ── Example: seed a default admin user ───────────────────────────────────────
-- Uncomment and run once to create your first user:
-- select public.create_availer_user('admin', 'change_me_123');

-- ── Optional: update last_login_at on successful login ───────────────────────
-- Call this from /api/login after successful auth:
-- UPDATE availer_logins SET last_login_at = now() WHERE id = $1

-- ============================================================
-- Verification queries
-- ============================================================
-- select id, username, is_active, created_at from public.availer_logins;
