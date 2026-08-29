import { supabase } from './supabase';
import type { Alarm } from '../stores/alarmStore';

export interface AlarmLog {
  id: string;
  user_id: string;
  alarm_id: string | null;
  triggered_at: string;
  dismissed_at: string | null;
  dismissed_via: 'nfc' | 'emergency' | null;
  dismissed_via_uid: string | null;
  dismissed_via_nfc_tag_id: string | null;
  block_started_at: string | null;
  block_ends_at: string | null;
  block_completed: boolean;
}

export type DismissError =
  | 'unknown_tag'
  | 'not_users_tag'
  | 'no_active_log'
  | 'unknown';

export async function triggerAlarm(alarmId: string): Promise<AlarmLog | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from('alarm_logs')
    .insert({
      user_id: auth.user.id,
      alarm_id: alarmId,
      triggered_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) return null;
  return data as AlarmLog;
}

export async function dismissAlarmViaNfc(
  logId: string,
  alarm: Alarm,
  uid: string,
): Promise<{ log: AlarmLog | null; error: DismissError | null }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { log: null, error: 'unknown' };

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
    return { log: null, error: anyTag ? 'not_users_tag' : 'unknown_tag' };
  }

  const now = new Date();
  const blockEnds = new Date(now.getTime() + alarm.block_duration_minutes * 60_000);

  const { data, error } = await supabase
    .from('alarm_logs')
    .update({
      dismissed_at: now.toISOString(),
      dismissed_via: 'nfc',
      dismissed_via_uid: uid,
      dismissed_via_nfc_tag_id: tag.id,
      block_started_at: now.toISOString(),
      block_ends_at: blockEnds.toISOString(),
    })
    .eq('id', logId)
    .select()
    .single();

  if (error || !data) return { log: null, error: 'unknown' };
  return { log: data as AlarmLog, error: null };
}

export async function dismissAlarmViaEmergency(
  logId: string,
  alarm: Alarm,
): Promise<{ log: AlarmLog | null; error: DismissError | null }> {
  const now = new Date();
  const blockEnds = new Date(now.getTime() + alarm.block_duration_minutes * 60_000);

  const { data, error } = await supabase
    .from('alarm_logs')
    .update({
      dismissed_at: now.toISOString(),
      dismissed_via: 'emergency',
      block_started_at: now.toISOString(),
      block_ends_at: blockEnds.toISOString(),
    })
    .eq('id', logId)
    .select()
    .single();

  if (error || !data) return { log: null, error: 'unknown' };
  return { log: data as AlarmLog, error: null };
}

export async function markBlockComplete(logId: string): Promise<void> {
  await supabase
    .from('alarm_logs')
    .update({ block_completed: true })
    .eq('id', logId);
}

function nextFireForAlarm(alarm: Alarm, now: Date): Date {
  const [hh, mm] = alarm.time.split(':').map(Number);
  const fireToday = new Date(now);
  fireToday.setHours(hh, mm, 0, 0);

  if (alarm.days_of_week.length === 0) {
    // One-off: today if still ahead, else tomorrow.
    if (fireToday.getTime() > now.getTime()) return fireToday;
    const tomorrow = new Date(fireToday);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  // days_of_week uses the same 0=Sunday..6=Saturday convention as Date.getDay().
  for (let d = 0; d <= 7; d++) {
    const candidate = new Date(fireToday);
    candidate.setDate(candidate.getDate() + d);
    if (!alarm.days_of_week.includes(candidate.getDay())) continue;
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  // Unreachable in practice (the d=7 pass always revisits today's weekday
  // a week out), but keeps the function total.
  return fireToday;
}

/**
 * Soonest upcoming fire time across all active alarms — display-only, pure
 * client-side computation over already-loaded alarms (no Supabase call).
 * Not used for scheduling; the native scheduler (scheduler/android.ts,
 * scheduler/ios.ts) computes its own occurrences independently.
 */
export function getNextAlarmOccurrence(alarms: Alarm[]): { alarm: Alarm; fireAt: Date } | null {
  const now = new Date();
  let best: { alarm: Alarm; fireAt: Date } | null = null;

  for (const alarm of alarms) {
    if (!alarm.is_active) continue;
    const fireAt = nextFireForAlarm(alarm, now);
    if (!best || fireAt.getTime() < best.fireAt.getTime()) best = { alarm, fireAt };
  }

  return best;
}
