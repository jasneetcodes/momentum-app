-- =============================================================================
-- Phase 2: NFC Tag Registration
-- Run this in Supabase SQL Editor (Database → SQL Editor → New query).
-- =============================================================================

-- 1. TRIGGER: Keep valid_tags.is_registered in sync with nfc_tags inserts/deletes
--    This guarantees atomicity — the client just inserts/deletes from nfc_tags,
--    and the trigger flips is_registered automatically (no extra round trip).

create or replace function public.sync_valid_tag_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.valid_tags set is_registered = true where uid = new.uid;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.valid_tags set is_registered = false where uid = old.uid;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists nfc_tags_sync_registration on public.nfc_tags;

create trigger nfc_tags_sync_registration
after insert or delete on public.nfc_tags
for each row execute function public.sync_valid_tag_registration();


-- 2. RLS: nfc_tags — users can only see/insert/delete their own tags
alter table public.nfc_tags enable row level security;

drop policy if exists "Users can read their own nfc tags" on public.nfc_tags;
create policy "Users can read their own nfc tags"
on public.nfc_tags for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own nfc tags" on public.nfc_tags;
create policy "Users can insert their own nfc tags"
on public.nfc_tags for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own nfc tags" on public.nfc_tags;
create policy "Users can delete their own nfc tags"
on public.nfc_tags for delete
using (auth.uid() = user_id);


-- 3. RLS: valid_tags — NO direct client access needed.
--    The FK constraint (nfc_tags.uid → valid_tags.uid) enforces validation
--    at insert time. The trigger above runs as SECURITY DEFINER so it can
--    update valid_tags even when the client cannot.
alter table public.valid_tags enable row level security;
-- (No policies = no client access. Server-side trigger handles all writes.)


-- 4. RLS: mode_sessions — needed so the client can check for active sessions
--    before allowing tag deletion. (Already needed for Phase 5+ regardless.)
alter table public.mode_sessions enable row level security;

drop policy if exists "Users can read their own mode sessions" on public.mode_sessions;
create policy "Users can read their own mode sessions"
on public.mode_sessions for select
using (auth.uid() = user_id);


-- =============================================================================
-- Verification — run these to sanity-check your setup:
-- =============================================================================

-- a) Insert a fake valid_tag for testing (replace UID with a real tag UID later)
-- insert into public.valid_tags (uid) values ('TEST_UID_FROM_REAL_TAG');

-- b) After registering a tag in the app, this should return true:
-- select uid, is_registered from public.valid_tags where uid = 'TEST_UID_FROM_REAL_TAG';

-- c) After deleting in the app, is_registered should flip back to false.
