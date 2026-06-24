-- ============================================================
-- 3D Keychain Maker v2 — Supabase Schema
-- Run entire file in Supabase SQL Editor
-- ============================================================

create extension if not exists pgcrypto;

drop table if exists public.availer_logins cascade;

create table public.availer_logins (
  id            uuid        primary key default gen_random_uuid(),
  username      text        not null unique,
  password_hash text        not null,
  display_name  text,
  is_active     boolean     not null default true,
  is_admin      boolean     not null default false,
  months        integer     not null default 1,       -- subscription duration in months
  expires_at    timestamptz,                           -- null = never expires
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create index availer_logins_username_idx on public.availer_logins (username);

-- RLS: block all public access — service role only
alter table public.availer_logins enable row level security;

-- ── Seed: admin user (never expires) ─────────────────────────────────────────
insert into public.availer_logins (username, password_hash, display_name, is_active, is_admin, expires_at)
values ('admin', crypt('changeme123', gen_salt('bf', 10)), 'Administrator', true, true, null);

-- ── Verify ───────────────────────────────────────────────────────────────────
select id, username, display_name, is_admin, is_active, expires_at, created_at from public.availer_logins;
