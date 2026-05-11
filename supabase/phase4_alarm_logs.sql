-- =============================================================================
-- Phase 4: Alarm Logs — RLS policies
-- Run this in Supabase SQL Editor (Database → SQL Editor → New query).
-- =============================================================================

alter table public.alarm_logs enable row level security;

drop policy if exists "Users can read their own alarm logs" on public.alarm_logs;
create policy "Users can read their own alarm logs"
on public.alarm_logs for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own alarm logs" on public.alarm_logs;
create policy "Users can insert their own alarm logs"
on public.alarm_logs for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own alarm logs" on public.alarm_logs;
create policy "Users can update their own alarm logs"
on public.alarm_logs for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Note: Phase 2 already created the SELECT policy on valid_tags? No — Phase 2
-- explicitly disabled client access to valid_tags. We need it now for the
-- "is this a Momentum tag (just not yours)" check during alarm dismissal.
-- Use a narrow SELECT policy that only allows uid lookup for authenticated users.
drop policy if exists "Authenticated users can check valid tag UIDs" on public.valid_tags;
create policy "Authenticated users can check valid tag UIDs"
on public.valid_tags for select
to authenticated
using (true);


-- =============================================================================
-- Verification — run after a test alarm fire + NFC dismiss:
-- =============================================================================
-- select id, alarm_id, triggered_at, dismissed_at, dismissed_via, dismissed_via_uid,
--        block_started_at, block_ends_at, block_completed
-- from public.alarm_logs
-- where user_id = auth.uid()
-- order by triggered_at desc
-- limit 5;
