-- =============================================================================
-- Phase 3: Alarms — RLS policies
-- Run this in Supabase SQL Editor (Database → SQL Editor → New query).
-- =============================================================================

alter table public.alarms enable row level security;

drop policy if exists "Users can read their own alarms" on public.alarms;
create policy "Users can read their own alarms"
on public.alarms for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own alarms" on public.alarms;
create policy "Users can insert their own alarms"
on public.alarms for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own alarms" on public.alarms;
create policy "Users can update their own alarms"
on public.alarms for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own alarms" on public.alarms;
create policy "Users can delete their own alarms"
on public.alarms for delete
using (auth.uid() = user_id);


-- =============================================================================
-- Verification — run after creating an alarm in the app:
-- =============================================================================
-- select id, label, time, days_of_week, block_type, block_duration_minutes, sound, is_active
-- from public.alarms
-- where user_id = auth.uid()
-- order by time;
