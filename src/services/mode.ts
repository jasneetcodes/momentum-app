import { supabase } from './supabase';
import type { Mode } from '../stores/modeStore';

export interface ModeSession {
  id: string;
  user_id: string;
  mode_id: string;
  activated_at: string;
  activated_via: 'nfc' | 'button';
  deactivated_at: string | null;
  deactivated_via: 'nfc' | 'emergency' | null;
  deactivated_via_uid: string | null;
  deactivated_via_nfc_tag_id: string | null;
  duration_minutes: number | null;
  created_at: string;
}

export type DeactivateError =
  | 'unknown_tag'
  | 'not_users_tag'
  | 'no_active_session'
  | 'unknown';

/**
 * Finds the user's currently-open mode session, if any. Used on app launch
 * to restore the active state (FGS may have kept blocking alive on Android
 * even while the JS bundle was dead).
 */
export async function findActiveSession(): Promise<ModeSession | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from('mode_sessions')
    .select('*')
    .eq('user_id', auth.user.id)
    .is('deactivated_at', null)
    .order('activated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ModeSession) ?? null;
}

export async function activateModeSession(
  modeId: string,
  via: 'nfc' | 'button',
): Promise<ModeSession | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from('mode_sessions')
    .insert({
      user_id: auth.user.id,
      mode_id: modeId,
      activated_at: new Date().toISOString(),
      activated_via: via,
    })
    .select()
    .single();

  if (error || !data) return null;
  return data as ModeSession;
}

export async function deactivateModeSessionViaNfc(
  sessionId: string,
  uid: string,
): Promise<{ session: ModeSession | null; error: DeactivateError | null }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { session: null, error: 'unknown' };

  const { data: tag } = await supabase
    .from('nfc_tags')
    .select('id, uid')
    .eq('uid', uid)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (!tag) {
    const { data: anyTag } = await supabase
      .from('valid_tags')
      .select('uid')
      .eq('uid', uid)
      .maybeSingle();
    return { session: null, error: anyTag ? 'not_users_tag' : 'unknown_tag' };
  }

  const session = await readSession(sessionId);
  if (!session) return { session: null, error: 'no_active_session' };

  const now = new Date();
  const activated = new Date(session.activated_at);
  const durationMinutes = Math.max(0, Math.round((now.getTime() - activated.getTime()) / 60_000));

  const { data, error } = await supabase
    .from('mode_sessions')
    .update({
      deactivated_at: now.toISOString(),
      deactivated_via: 'nfc',
      deactivated_via_uid: uid,
      deactivated_via_nfc_tag_id: tag.id,
      duration_minutes: durationMinutes,
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error || !data) return { session: null, error: 'unknown' };
  return { session: data as ModeSession, error: null };
}

export async function deactivateModeSessionViaEmergency(
  sessionId: string,
): Promise<{ session: ModeSession | null; error: DeactivateError | null }> {
  const session = await readSession(sessionId);
  if (!session) return { session: null, error: 'no_active_session' };

  const now = new Date();
  const activated = new Date(session.activated_at);
  const durationMinutes = Math.max(0, Math.round((now.getTime() - activated.getTime()) / 60_000));

  const { data, error } = await supabase
    .from('mode_sessions')
    .update({
      deactivated_at: now.toISOString(),
      deactivated_via: 'emergency',
      duration_minutes: durationMinutes,
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error || !data) return { session: null, error: 'unknown' };
  return { session: data as ModeSession, error: null };
}

async function readSession(sessionId: string): Promise<ModeSession | null> {
  const { data } = await supabase
    .from('mode_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  return (data as ModeSession) ?? null;
}

/**
 * Total focus minutes today (across all completed mode sessions). Used by
 * the "Locked in today — Xh Ym" header on LockInScreen.
 */
export async function totalMinutesToday(): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 0;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('mode_sessions')
    .select('activated_at, deactivated_at, duration_minutes')
    .eq('user_id', auth.user.id)
    .gte('activated_at', startOfDay.toISOString());

  if (!data) return 0;

  let totalMs = 0;
  const now = Date.now();
  for (const row of data as Array<Pick<ModeSession, 'activated_at' | 'deactivated_at' | 'duration_minutes'>>) {
    const start = new Date(row.activated_at).getTime();
    const end = row.deactivated_at ? new Date(row.deactivated_at).getTime() : now;
    totalMs += Math.max(0, end - start);
  }
  return Math.floor(totalMs / 60_000);
}

/**
 * Counts emergency unblocks used in the current calendar month. Drives the
 * "Emergency unblock — X remaining" copy.
 */
export async function emergencyUnblocksUsedThisMonth(): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 0;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('mode_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.user.id)
    .eq('deactivated_via', 'emergency')
    .gte('activated_at', startOfMonth.toISOString());

  return count ?? 0;
}

export async function fetchModes(): Promise<Mode[]> {
  const { data } = await supabase
    .from('modes')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  return (data as Mode[]) ?? [];
}
