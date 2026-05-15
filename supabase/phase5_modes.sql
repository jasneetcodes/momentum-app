-- =============================================================================
-- Phase 5: Brick Mode (Lock In)
-- Creates the `modes` table and tightens `mode_sessions` RLS so the client
-- can create/update sessions (read policy already exists from phase2_nfc.sql).
-- Run this in Supabase SQL Editor.
-- =============================================================================

-- 1. modes table
create table if not exists public.modes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  icon text,
  colour text,
  block_type text not null default 'blacklist' check (block_type in ('blacklist','whitelist')),
  apps text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists modes_user_id_idx on public.modes(user_id);


-- 2. RLS for modes (user-scoped CRUD)
alter table public.modes enable row level security;

drop policy if exists "Users read own modes" on public.modes;
create policy "Users read own modes"
on public.modes for select using (auth.uid() = user_id);

drop policy if exists "Users insert own modes" on public.modes;
create policy "Users insert own modes"
on public.modes for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own modes" on public.modes;
create policy "Users update own modes"
on public.modes for update using (auth.uid() = user_id);

drop policy if exists "Users delete own modes" on public.modes;
create policy "Users delete own modes"
on public.modes for delete using (auth.uid() = user_id);


-- 3. mode_sessions — add INSERT + UPDATE policies (SELECT already in phase2_nfc.sql)
drop policy if exists "Users insert own mode sessions" on public.mode_sessions;
create policy "Users insert own mode sessions"
on public.mode_sessions for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own mode sessions" on public.mode_sessions;
create policy "Users update own mode sessions"
on public.mode_sessions for update using (auth.uid() = user_id);


-- =============================================================================
-- Verification:
--   select * from public.modes where user_id = auth.uid();
--   select * from public.mode_sessions where user_id = auth.uid() order by activated_at desc;
-- =============================================================================
