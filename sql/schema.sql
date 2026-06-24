-- ============================================================
-- 3D Keychain Maker v2 — Supabase Schema
-- Run entire file in Supabase SQL Editor
-- Safe to re-run (idempotent)
-- ============================================================

-- Required extension for bcrypt hashing
create extension if not exists pgcrypto;

-- ── Drop & recreate clean ─────────────────────────────────────────────────────
drop table if exists public.availer_logins cascade;

create table public.availer_logins (
  id            uuid        primary key default gen_random_uuid(),
  username      text        not null unique,
  password_hash text        not null,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- Fast lookup on login
create index availer_logins_username_idx on public.availer_logins (username);

-- RLS: block all public access — only service role key can read/write
alter table public.availer_logins enable row level security;

-- ── Seed: create your first user ─────────────────────────────────────────────
-- Change username/password before running
insert into public.availer_logins (username, password_hash, is_active)
values ('admin', crypt('changeme123', gen_salt('bf', 10)), true);

-- ── Verify ───────────────────────────────────────────────────────────────────
select id, username, is_active, created_at from public.availer_logins;
