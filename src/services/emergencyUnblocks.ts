import { supabase } from './supabase';

/**
 * Emergency unblocks are a single shared monthly pool (profiles.emergency_unblocks_limit)
 * spent from either place a user can hit "Emergency unblock": the alarm-ringing
 * screen (dismisses without NFC) or an active Lock In session (ends without NFC).
 * Counts both — a count scoped to only one source would let the other source
 * bypass the limit entirely.
 */
export async function emergencyUnblocksUsedThisMonth(): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 0;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const sinceIso = startOfMonth.toISOString();

  const [modeResult, alarmResult] = await Promise.all([
    supabase
      .from('mode_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .eq('deactivated_via', 'emergency')
      .gte('activated_at', sinceIso),
    supabase
      .from('alarm_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .eq('dismissed_via', 'emergency')
      .gte('triggered_at', sinceIso),
  ]);

  return (modeResult.count ?? 0) + (alarmResult.count ?? 0);
}
