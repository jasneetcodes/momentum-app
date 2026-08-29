import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Display } from '../../components/Display';
import { MonoLabel } from '../../components/MonoLabel';
import { Slab } from '../../components/Slab';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  alarmEfficiency,
  focusTimeSummary,
  sessionHistory,
  streakSummary,
  type AlarmEfficiency,
  type AnalyticsRange,
  type FocusTimeSummary,
  type SessionHistoryEntry,
  type StreakSummary,
} from '../../services/analytics';
import { emergencyUnblocksUsedThisMonth } from '../../services/emergencyUnblocks';
import { useAuthStore } from '../../stores/authStore';
import { useModeStore } from '../../stores/modeStore';

const RANGES: Array<{ id: AnalyticsRange; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'thisWeek', label: 'This Week' },
  { id: 'lastWeek', label: 'Last Week' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'lastYear', label: 'Last Year' },
];

const DEFAULT_EMERGENCY_LIMIT = 5; // mirrors profiles.emergency_unblocks_limit default

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, today)) return 'TODAY';
  if (isSameDay(d, yesterday)) return 'YESTERDAY';
  return d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
}

export default function AnalyticsScreen() {
  const { barStyle, bg, ink, muted, faint, border, accent, surface } = useThemeColors();
  const profile = useAuthStore((s) => s.profile);
  const modes = useModeStore((s) => s.modes);
  const modeById = useMemo(() => new Map(modes.map((m) => [m.id, m])), [modes]);

  const [range, setRange] = useState<AnalyticsRange>('thisWeek');
  const [focus, setFocus] = useState<FocusTimeSummary>({ totalMinutes: 0, previousTotalMinutes: 0, byMode: [] });
  const [streaks, setStreaks] = useState<StreakSummary>({ current: 0, longest: 0, totalSessions: 0 });
  const [alarmStats, setAlarmStats] = useState<AlarmEfficiency>({
    totalAlarms: 0,
    dismissedCount: 0,
    dismissalRate: 0,
    avgReactionSeconds: null,
    previousAvgReactionSeconds: null,
  });
  const [history, setHistory] = useState<SessionHistoryEntry[]>([]);
  const [emergencyUsed, setEmergencyUsed] = useState(0);

  useFocusEffect(
    useCallback(() => {
      focusTimeSummary(range).then(setFocus);
      alarmEfficiency(range).then(setAlarmStats);
      sessionHistory(range).then(setHistory);
      streakSummary().then(setStreaks);
      emergencyUnblocksUsedThisMonth().then(setEmergencyUsed);
    }, [range]),
  );

  const emergencyLimit = profile?.emergency_unblocks_limit ?? DEFAULT_EMERGENCY_LIMIT;
  const emergencyRemaining = Math.max(0, emergencyLimit - emergencyUsed);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      <StatusBar barStyle={barStyle} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
          <Display size={40} weight="black" color={ink} uppercase letterSpacing={-40 * 0.035}>Stats</Display>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled style={{ marginTop: 20, marginHorizontal: -24, paddingHorizontal: 24 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {RANGES.map((r) => {
                const active = r.id === range;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setRange(r.id)}
                    style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: active ? accent : 'transparent', borderWidth: 1, borderColor: active ? accent : border }}
                  >
                    <MonoLabel color={active ? bg : ink} size={12} letterSpacing={12 * 0.08} numberOfLines={1}>{r.label}</MonoLabel>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={{ marginTop: 28 }}>
            <MonoLabel color={accent} size={12} letterSpacing={12 * 0.22}>Focus · this range</MonoLabel>
            <Display size={56} weight="black" color={ink} lineHeight={52} style={{ marginTop: 6 }}>{formatMinutes(focus.totalMinutes)}</Display>
          </View>

          {focus.byMode.length > 0 && (
            <View style={{ marginTop: 24, gap: 2 }}>
              {focus.byMode.map((entry) => {
                const mode = modeById.get(entry.modeId);
                const pct = focus.totalMinutes > 0 ? (entry.minutes / focus.totalMinutes) * 100 : 0;
                return (
                  <View key={entry.modeId} style={{ backgroundColor: surface, padding: 16 }}>
                    <MonoLabel color={faint} size={10} letterSpacing={10 * 0.14}>Mode</MonoLabel>
                    <Display size={18} weight="black" color={ink} uppercase style={{ marginTop: 8 }} numberOfLines={1}>
                      {mode?.label ?? 'Deleted mode'}
                    </Display>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                      <View style={{ flex: 1, height: 4, backgroundColor: border, marginRight: 10 }}>
                        <View style={{ width: `${pct}%`, height: 4, backgroundColor: accent }} />
                      </View>
                      <MonoLabel color={muted} size={11}>{formatMinutes(entry.minutes)}</MonoLabel>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 2, marginTop: 26 }}>
            <Slab style={{ flex: 1, padding: 16 }}>
              <MonoLabel color={muted} size={10} letterSpacing={10 * 0.14}>Streak</MonoLabel>
              <Display size={26} weight="black" color={ink} style={{ marginTop: 10 }}>{streaks.current}</Display>
            </Slab>
            <Slab style={{ flex: 1, padding: 16 }}>
              <MonoLabel color={muted} size={10} letterSpacing={10 * 0.14}>Record</MonoLabel>
              <Display size={26} weight="black" color={ink} style={{ marginTop: 10 }}>{streaks.longest}</Display>
            </Slab>
            <Slab style={{ flex: 1, padding: 16 }}>
              <MonoLabel color={muted} size={10} letterSpacing={10 * 0.14}>Sessions</MonoLabel>
              <Display size={26} weight="black" color={ink} style={{ marginTop: 10 }}>{streaks.totalSessions}</Display>
            </Slab>
          </View>

          <View style={{ marginTop: 28 }}>
            <MonoLabel color={muted} size={12} letterSpacing={12 * 0.22} style={{ marginBottom: 12 }}>Wakeup habit</MonoLabel>
            {alarmStats.totalAlarms === 0 ? (
              <Slab style={{ padding: 20, alignItems: 'center' }}>
                <MonoLabel color={muted} size={12} uppercase={false}>No alarms in this range</MonoLabel>
              </Slab>
            ) : (
              <Slab style={{ padding: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <MonoLabel color={muted} size={10} letterSpacing={10 * 0.14}>Dismissal rate</MonoLabel>
                    <Display size={24} weight="black" color={ink} style={{ marginTop: 6 }}>{formatPercent(alarmStats.dismissalRate)}</Display>
                  </View>
                  {alarmStats.avgReactionSeconds !== null && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <MonoLabel color={muted} size={10} letterSpacing={10 * 0.14}>Reaction</MonoLabel>
                      <Display size={24} weight="black" color={accent} style={{ marginTop: 6 }}>{formatSeconds(alarmStats.avgReactionSeconds)}</Display>
                    </View>
                  )}
                </View>
                <MonoLabel color={faint} size={11} letterSpacing={11 * 0.08} uppercase={false} style={{ marginTop: 16 }}>
                  {alarmStats.dismissedCount} of {alarmStats.totalAlarms} alarms dismissed
                </MonoLabel>
              </Slab>
            )}
          </View>

          <View style={{ marginTop: 26 }}>
            <Slab style={{ padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <MonoLabel color={ink} size={13} letterSpacing={0} uppercase={false}>Emergency unblocks this month</MonoLabel>
              <MonoLabel color={muted} size={13}>{emergencyRemaining} LEFT</MonoLabel>
            </Slab>
          </View>

          <View style={{ marginTop: 28 }}>
            <MonoLabel color={muted} size={12} letterSpacing={12 * 0.22} style={{ marginBottom: 12 }}>History</MonoLabel>
            {history.length === 0 ? (
              <MonoLabel color={muted} size={12} uppercase={false} style={{ textAlign: 'center', paddingVertical: 20 }}>
                Your sessions will appear here
              </MonoLabel>
            ) : (
              <View>
                {history.map((entry, i) => {
                  const mode = modeById.get(entry.modeId);
                  return (
                    <View
                      key={entry.id}
                      style={{ paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: i === 0 ? 0 : 1, borderTopColor: border }}
                    >
                      <Display size={17} weight="semibold" color={ink} numberOfLines={1} style={{ flex: 1 }}>{mode?.label ?? 'Deleted mode'}</Display>
                      <MonoLabel color={muted} size={13}>
                        {entry.durationMinutes !== null ? formatMinutes(entry.durationMinutes) : '—'} · {formatSessionDate(entry.activatedAt)}
                      </MonoLabel>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
