import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Display } from '../../components/Display';
import { MonoLabel } from '../../components/MonoLabel';
import { Slab } from '../../components/Slab';
import { useThemeColors } from '../../hooks/useThemeColors';
import { getNextAlarmOccurrence } from '../../services/alarm';
import { focusTimeSummary, streakSummary, weeklyActivity } from '../../services/analytics';
import { getDailyQuote, type Quote } from '../../services/quotes';
import { useAlarmStore } from '../../stores/alarmStore';
import { useAuthStore } from '../../stores/authStore';
import { useModeSessionStore } from '../../stores/modeSessionStore';
import { useModeStore } from '../../stores/modeStore';
import { useNfcStore } from '../../stores/nfcStore';
import type { HomeNavProp } from '../../navigation/types';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(total / 3600)).padStart(2, '0');
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function formatTimeDisplay(time: string): { hhmm: string; period: string } {
  const [hh, mm] = time.split(':').map(Number);
  const period = hh >= 12 ? 'PM' : 'AM';
  const displayHours = hh % 12 || 12;
  return { hhmm: `${displayHours}:${String(mm).padStart(2, '0')}`, period };
}

function formatCountdown(msUntil: number): string {
  const totalMin = Math.max(0, Math.round(msUntil / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}H ${m}M`;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatRelativeDay(fireAt: Date): string {
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(fireAt, now)) return 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(fireAt, tomorrow)) return 'Tomorrow';
  return WEEKDAY_NAMES[fireAt.getDay()];
}

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const { barStyle, bg, ink, muted, faint, border, accent, surface } = useThemeColors();
  const profile = useAuthStore((s) => s.profile);

  const activeSession = useModeSessionStore((s) => s.activeSession);
  const modes = useModeStore((s) => s.modes);
  const activeMode = useMemo(
    () => (activeSession ? modes.find((m) => m.id === activeSession.mode_id) ?? null : null),
    [activeSession, modes],
  );

  const alarms = useAlarmStore((s) => s.alarms);
  const fetchAlarms = useAlarmStore((s) => s.fetchAlarms);
  const nfcTags = useNfcStore((s) => s.tags);
  const fetchTags = useNfcStore((s) => s.fetchTags);

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!activeSession) { setElapsed(0); return; }
    const start = new Date(activeSession.activated_at).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [weekActive, setWeekActive] = useState<boolean[]>(new Array(7).fill(false));
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      fetchAlarms();
      fetchTags();
      streakSummary().then((s) => { setCurrentStreak(s.current); setLongestStreak(s.longest); });
      weeklyActivity().then(setWeekActive);
      focusTimeSummary('today').then((f) => setTodayMinutes(f.totalMinutes));
    }, [fetchAlarms, fetchTags]),
  );

  useEffect(() => {
    getDailyQuote().then(setQuote);
  }, []);

  // Live "IN 8H 49M" countdown to the next alarm.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const nextAlarm = useMemo(() => getNextAlarmOccurrence(alarms), [alarms]);
  const firstName = profile?.name?.split(' ')[0] ?? '';
  const showBuyTagCard = nfcTags.length === 0;

  const handleBuyTag = () => {
    Alert.alert('Coming soon', 'Momentum tags will be available to order here soon.');
  };

  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase() + ' · ' + now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      <StatusBar barStyle={barStyle} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <MonoLabel color={muted} size={12} letterSpacing={12 * 0.24}>{dateLabel}</MonoLabel>
              <Display size={26} weight="extrabold" color={ink} letterSpacing={-26 * 0.02} lineHeight={29} style={{ marginTop: 8 }}>
                Morning, {firstName}.
              </Display>
            </View>
            <Pressable
              onPress={() => navigation.navigate('Settings')}
              hitSlop={12}
              style={{ width: 48, height: 48, borderWidth: 1.5, borderColor: border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="settings-outline" size={24} color={ink} />
            </Pressable>
          </View>

          {activeSession && (
            <Pressable onPress={() => navigation.jumpTo('LockIn')} style={{ marginTop: 24 }}>
              <Slab style={{ padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={{ width: 40, height: 40, backgroundColor: accent + '1A', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="lock-closed" size={18} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <MonoLabel color={accent} size={13} letterSpacing={13 * 0.16}>
                      LOCKED IN · {(activeMode?.label ?? 'SESSION').toUpperCase()}
                    </MonoLabel>
                    <Display size={20} weight="bold" color={ink} style={{ marginTop: 4 }}>{formatElapsed(elapsed)}</Display>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={ink} />
              </Slab>
            </Pressable>
          )}

          {/* Streak */}
          <View style={{ marginTop: 32 }}>
            <MonoLabel color={accent} size={12} letterSpacing={12 * 0.22}>Current streak</MonoLabel>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 4 }}>
              <Display size={100} weight="black" color={ink} lineHeight={90}>{currentStreak}</Display>
              <MonoLabel color={muted} size={14} letterSpacing={14 * 0.1} style={{ paddingBottom: 12, lineHeight: 18 }}>
                days{'\n'}clean
              </MonoLabel>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 20, alignItems: 'flex-end', height: 56 }}>
              {DAY_LABELS.map((day, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                  {weekActive[i] ? (
                    <View style={{ width: '100%', height: 40, backgroundColor: accent }} />
                  ) : (
                    <View style={{ width: '100%', height: 40, borderWidth: 1.5, borderColor: border }} />
                  )}
                  <MonoLabel color={weekActive[i] ? accent : muted} size={11}>{day}</MonoLabel>
                </View>
              ))}
            </View>
          </View>

          {/* Quote — right below streaks */}
          {quote && (
            <View style={{ marginTop: 32 }}>
              <Slab style={{ padding: 20 }}>
                <Display size={17} weight="medium" color={ink} lineHeight={24} style={{ fontStyle: 'italic' }}>
                  "{quote.text}"
                </Display>
                <MonoLabel color={muted} size={12} style={{ marginTop: 12 }} uppercase={false}>— {quote.author}</MonoLabel>
              </Slab>
            </View>
          )}

          {/* Next alarm */}
          <View style={{ marginTop: 32 }}>
            <Slab background={accent} style={{ padding: 22, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              {nextAlarm ? (
                <>
                  <View>
                    <MonoLabel color="rgba(14,14,15,.6)" size={12} letterSpacing={12 * 0.22}>
                      NEXT ALARM{nextAlarm.alarm.label ? ` · ${nextAlarm.alarm.label.toUpperCase()}` : ''}
                    </MonoLabel>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8 }}>
                      <Display size={44} weight="black" color={bg} lineHeight={40}>
                        {formatTimeDisplay(nextAlarm.alarm.time).hhmm}
                      </Display>
                      <Display size={18} weight="extrabold" color={bg} letterSpacing={0} style={{ marginLeft: 4 }}>
                        {formatTimeDisplay(nextAlarm.alarm.time).period}
                      </Display>
                    </View>
                  </View>
                  <MonoLabel color="rgba(14,14,15,.7)" size={13} style={{ textAlign: 'right', lineHeight: 18 }}>
                    IN{'\n'}{formatCountdown(nextAlarm.fireAt.getTime() - now.getTime())}
                  </MonoLabel>
                </>
              ) : (
                <View>
                  <Display size={40} weight="black" color={bg}>--:--</Display>
                  <MonoLabel color="rgba(14,14,15,.6)" size={13} style={{ marginTop: 6 }}>No alarms set</MonoLabel>
                </View>
              )}
            </Slab>
          </View>

          <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
            <Slab style={{ flex: 1, padding: 18 }}>
              <MonoLabel color={muted} size={11} letterSpacing={11 * 0.18}>Focus today</MonoLabel>
              <Display size={28} weight="black" color={ink} style={{ marginTop: 10 }}>{formatMinutes(todayMinutes)}</Display>
            </Slab>
            <Slab style={{ flex: 1, padding: 18 }}>
              <MonoLabel color={muted} size={11} letterSpacing={11 * 0.18}>Record</MonoLabel>
              <Display size={28} weight="black" color={ink} style={{ marginTop: 10 }}>{longestStreak}</Display>
            </Slab>
          </View>

          {showBuyTagCard && (
            <Pressable onPress={handleBuyTag} style={{ marginTop: 24 }}>
              <Slab style={{ padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={{ width: 40, height: 40, backgroundColor: accent + '1A', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="hardware-chip-outline" size={18} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Display size={17} weight="bold" color={ink}>Get your Momentum tag</Display>
                    <MonoLabel color={muted} size={11} style={{ marginTop: 4 }} uppercase={false}>
                      You'll need a physical tag to use alarms and Lock In
                    </MonoLabel>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={ink} />
              </Slab>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
