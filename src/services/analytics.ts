import { supabase } from './supabase';

export type AnalyticsRange = 'today' | 'thisWeek' | 'lastWeek' | 'lastMonth' | 'lastYear';

interface DateRange {
  start: Date;
  end: Date; // exclusive
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Monday of the week containing `d` — matches the M T W T F S S day-pill order used elsewhere. */
function startOfWeek(d: Date): Date {
  const copy = startOfDay(d);
  const day = copy.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // days back to Monday
  return addDays(copy, diff);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

/**
 * Bounds for the selected range plus the immediately preceding equivalent
 * period, for period-over-period trend comparisons. All calendar-aligned —
 * "Last Month" is the full previous calendar month, not a trailing 30 days.
 */
function getRangeBounds(range: AnalyticsRange): { current: DateRange; previous: DateRange } {
  const now = new Date();

  switch (range) {
    case 'today': {
      const start = startOfDay(now);
      const end = addDays(start, 1);
      const prevStart = addDays(start, -1);
      return { current: { start, end }, previous: { start: prevStart, end: start } };
    }
    case 'thisWeek': {
      const start = startOfWeek(now);
      const end = addDays(start, 7);
      const prevStart = addDays(start, -7);
      return { current: { start, end }, previous: { start: prevStart, end: start } };
    }
    case 'lastWeek': {
      const thisWeekStart = startOfWeek(now);
      const start = addDays(thisWeekStart, -7);
      const end = thisWeekStart;
      const prevStart = addDays(start, -7);
      return { current: { start, end }, previous: { start: prevStart, end: start } };
    }
    case 'lastMonth': {
      const thisMonthStart = startOfMonth(now);
      const start = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth() - 1, 1);
      const end = thisMonthStart;
      const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
      return { current: { start, end }, previous: { start: prevStart, end: start } };
    }
    case 'lastYear': {
      const thisYearStart = startOfYear(now);
      const start = new Date(thisYearStart.getFullYear() - 1, 0, 1);
      const end = thisYearStart;
      const prevStart = new Date(start.getFullYear() - 1, 0, 1);
      return { current: { start, end }, previous: { start: prevStart, end: start } };
    }
  }
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export interface FocusTimeSummary {
  totalMinutes: number;
  previousTotalMinutes: number;
  byMode: Array<{ modeId: string; minutes: number }>;
}

/**
 * Focus time for the selected range, broken down by mode. Returns raw
 * modeId → minutes pairs — the screen maps modeId to label/colour via
 * useModeStore.modes (already fetched app-wide), keeping this a pure data
 * function with no UI concerns.
 */
export async function focusTimeSummary(range: AnalyticsRange): Promise<FocusTimeSummary> {
  const userId = await currentUserId();
  if (!userId) return { totalMinutes: 0, previousTotalMinutes: 0, byMode: [] };

  const { current, previous } = getRangeBounds(range);

  const [currentRes, previousRes] = await Promise.all([
    supabase
      .from('mode_sessions')
      .select('mode_id, duration_minutes')
      .eq('user_id', userId)
      .not('duration_minutes', 'is', null)
      .gte('activated_at', current.start.toISOString())
      .lt('activated_at', current.end.toISOString()),
    supabase
      .from('mode_sessions')
      .select('duration_minutes')
      .eq('user_id', userId)
      .not('duration_minutes', 'is', null)
      .gte('activated_at', previous.start.toISOString())
      .lt('activated_at', previous.end.toISOString()),
  ]);

  const byModeMap = new Map<string, number>();
  let totalMinutes = 0;
  for (const row of (currentRes.data ?? []) as Array<{ mode_id: string; duration_minutes: number }>) {
    totalMinutes += row.duration_minutes;
    byModeMap.set(row.mode_id, (byModeMap.get(row.mode_id) ?? 0) + row.duration_minutes);
  }

  const previousTotalMinutes = ((previousRes.data ?? []) as Array<{ duration_minutes: number }>)
    .reduce((sum, row) => sum + row.duration_minutes, 0);

  const byMode = Array.from(byModeMap, ([modeId, minutes]) => ({ modeId, minutes }))
    .sort((a, b) => b.minutes - a.minutes);

  return { totalMinutes, previousTotalMinutes, byMode };
}

export interface StreakSummary {
  current: number;
  longest: number;
  totalSessions: number;
}

/**
 * Not range-dependent — always reflects current state. A day "counts" if it
 * has at least one completed session. Bounded lookback (~400 days) to avoid
 * an unbounded query on long-lived accounts.
 */
export async function streakSummary(): Promise<StreakSummary> {
  const userId = await currentUserId();
  if (!userId) return { current: 0, longest: 0, totalSessions: 0 };

  const lookbackStart = addDays(startOfDay(new Date()), -400);

  const { data, count } = await supabase
    .from('mode_sessions')
    .select('activated_at', { count: 'exact' })
    .eq('user_id', userId)
    .not('deactivated_at', 'is', null)
    .gte('activated_at', lookbackStart.toISOString());

  const rows = (data ?? []) as Array<{ activated_at: string }>;
  const activeDays = new Set(
    rows.map((r) => startOfDay(new Date(r.activated_at)).getTime()),
  );

  // Longest streak: scan every active day, only starting a run count where
  // the previous day isn't in the set (so each run is counted exactly once).
  let longest = 0;
  for (const t of activeDays) {
    const prevDay = t - 86_400_000;
    if (activeDays.has(prevDay)) continue;
    let run = 1;
    let cursor = t + 86_400_000;
    while (activeDays.has(cursor)) {
      run += 1;
      cursor += 86_400_000;
    }
    longest = Math.max(longest, run);
  }

  // Current streak: walk backward from today. Today is allowed to be empty
  // without breaking the streak (the day isn't over yet).
  let currentStreak = 0;
  let cursor = startOfDay(new Date()).getTime();
  if (!activeDays.has(cursor)) cursor -= 86_400_000;
  while (activeDays.has(cursor)) {
    currentStreak += 1;
    cursor -= 86_400_000;
  }

  return { current: currentStreak, longest, totalSessions: count ?? 0 };
}

export interface AlarmEfficiency {
  totalAlarms: number;
  dismissedCount: number;
  dismissalRate: number; // 0..1
  avgReactionSeconds: number | null;
  previousAvgReactionSeconds: number | null;
}

/**
 * Dismissal rate = dismissed (any method) / triggered, for the selected
 * range. Reaction time = avg(dismissed_at - triggered_at) in seconds, only
 * over dismissed_via = 'nfc' rows — an emergency dismiss never involved
 * tapping a tag, so it isn't a "reaction time" data point.
 */
export async function alarmEfficiency(range: AnalyticsRange): Promise<AlarmEfficiency> {
  const userId = await currentUserId();
  if (!userId) {
    return { totalAlarms: 0, dismissedCount: 0, dismissalRate: 0, avgReactionSeconds: null, previousAvgReactionSeconds: null };
  }

  const { current, previous } = getRangeBounds(range);

  const select = (start: Date, end: Date) =>
    supabase
      .from('alarm_logs')
      .select('triggered_at, dismissed_at, dismissed_via')
      .eq('user_id', userId)
      .gte('triggered_at', start.toISOString())
      .lt('triggered_at', end.toISOString());

  const [currentRes, previousRes] = await Promise.all([
    select(current.start, current.end),
    select(previous.start, previous.end),
  ]);

  type Row = { triggered_at: string; dismissed_at: string | null; dismissed_via: 'nfc' | 'emergency' | null };
  const currentRows = (currentRes.data ?? []) as Row[];
  const previousRows = (previousRes.data ?? []) as Row[];

  const avgNfcReactionSeconds = (rows: Row[]): number | null => {
    const secs = rows
      .filter((r) => r.dismissed_via === 'nfc' && r.dismissed_at)
      .map((r) => (new Date(r.dismissed_at!).getTime() - new Date(r.triggered_at).getTime()) / 1000);
    if (!secs.length) return null;
    return secs.reduce((a, b) => a + b, 0) / secs.length;
  };

  const dismissedCount = currentRows.filter((r) => r.dismissed_at !== null).length;
  const totalAlarms = currentRows.length;

  return {
    totalAlarms,
    dismissedCount,
    dismissalRate: totalAlarms > 0 ? dismissedCount / totalAlarms : 0,
    avgReactionSeconds: avgNfcReactionSeconds(currentRows),
    previousAvgReactionSeconds: avgNfcReactionSeconds(previousRows),
  };
}

export interface SessionHistoryEntry {
  id: string;
  modeId: string;
  activatedAt: string;
  durationMinutes: number | null;
  endedVia: 'nfc' | 'emergency' | null;
}

/** Session history for the selected range, most recent first. */
export async function sessionHistory(range: AnalyticsRange): Promise<SessionHistoryEntry[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const { current } = getRangeBounds(range);

  const { data } = await supabase
    .from('mode_sessions')
    .select('id, mode_id, activated_at, duration_minutes, deactivated_via')
    .eq('user_id', userId)
    .gte('activated_at', current.start.toISOString())
    .lt('activated_at', current.end.toISOString())
    .order('activated_at', { ascending: false });

  return ((data ?? []) as Array<{
    id: string;
    mode_id: string;
    activated_at: string;
    duration_minutes: number | null;
    deactivated_via: 'nfc' | 'emergency' | null;
  }>).map((r) => ({
    id: r.id,
    modeId: r.mode_id,
    activatedAt: r.activated_at,
    durationMinutes: r.duration_minutes,
    endedVia: r.deactivated_via,
  }));
}

/**
 * 7 booleans, Monday through Sunday, for the current calendar week — true if
 * that day has at least one completed session. Same "completed only" rule
 * as streakSummary(), so an in-progress session doesn't light up today's
 * dot until it ends. Powers the Home screen's weekly dot track.
 */
export async function weeklyActivity(): Promise<boolean[]> {
  const userId = await currentUserId();
  if (!userId) return new Array(7).fill(false);

  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 7);

  const { data } = await supabase
    .from('mode_sessions')
    .select('activated_at')
    .eq('user_id', userId)
    .not('deactivated_at', 'is', null)
    .gte('activated_at', weekStart.toISOString())
    .lt('activated_at', weekEnd.toISOString());

  const activeDays = new Set(
    ((data ?? []) as Array<{ activated_at: string }>).map(
      (r) => startOfDay(new Date(r.activated_at)).getTime(),
    ),
  );

  return Array.from({ length: 7 }, (_, i) => activeDays.has(addDays(weekStart, i).getTime()));
}
