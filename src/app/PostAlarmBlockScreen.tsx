import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Display } from '../components/Display';
import { HazardStripes } from '../components/HazardStripes';
import { MonoLabel } from '../components/MonoLabel';
import { SOCIAL_MEDIA_APPS } from '../constants/apps';
import { useThemeColors } from '../hooks/useThemeColors';
import { startBlocking, stopBlocking } from '../services/appBlocking';
import { useAlarmStore } from '../stores/alarmStore';
import { useAlarmLogStore } from '../stores/alarmLogStore';
import type { MainStackParamList, RootNavProp } from '../navigation/types';

type RouteProps = RouteProp<MainStackParamList, 'PostAlarmBlock'>;

const MOTIVATIONAL_LINES = [
  "You're up. Make it count.",
  'No second chances today.',
  'The day starts now.',
  'Earn the rest of your morning.',
];

function formatCountdown(secondsLeft: number): string {
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function appNameFromBundleId(bundleId: string): string {
  const match = SOCIAL_MEDIA_APPS.find(
    (a) => a.ios === bundleId || a.android === bundleId,
  );
  return match?.name ?? bundleId;
}

export default function PostAlarmBlockScreen() {
  const navigation = useNavigation<RootNavProp>();
  const route = useRoute<RouteProps>();
  const { alarmId } = route.params;

  const { barStyle, bg, ink, muted, faint, accent, surface } = useThemeColors();
  const alarms = useAlarmStore((s) => s.alarms);
  const activeLog = useAlarmLogStore((s) => s.activeLog);
  const completeBlock = useAlarmLogStore((s) => s.completeBlock);

  const alarm = useMemo(() => alarms.find((a) => a.id === alarmId), [alarms, alarmId]);

  const motivationalLine = useMemo(
    () => MOTIVATIONAL_LINES[Math.floor(Math.random() * MOTIVATIONAL_LINES.length)],
    [],
  );

  const blockEndsAt = activeLog?.block_ends_at
    ? new Date(activeLog.block_ends_at).getTime()
    : null;
  const blockStartedAt = activeLog?.block_started_at
    ? new Date(activeLog.block_started_at).getTime()
    : null;
  const totalSeconds = alarm ? alarm.block_duration_minutes * 60 : 0;

  const computeRemaining = () => {
    if (!blockEndsAt) return 0;
    return Math.max(0, Math.ceil((blockEndsAt - Date.now()) / 1000));
  };

  const [remaining, setRemaining] = useState<number>(computeRemaining);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!blockEndsAt) return;
    const tick = () => {
      const r = computeRemaining();
      setRemaining(r);
      if (r === 0 && !completedRef.current) {
        completedRef.current = true;
        stopBlocking().catch(() => {});
        completeBlock();
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockEndsAt]);

  // Activate native app blocking for the duration of the post-alarm window.
  // Safe no-op if AccessibilityService is not enabled (Android) or on iOS
  // pre-Phase-5B.
  useEffect(() => {
    if (!alarm || !blockEndsAt) return;
    startBlocking(alarm.apps, alarm.block_type, alarm.label || 'Post-alarm block').catch(() => {});
    return () => {
      // If the screen unmounts before the timer naturally completes, also stop.
      stopBlocking().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarm, blockEndsAt]);

  // Block hardware back on Android — block must complete
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  if (!alarm || !blockEndsAt) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <MonoLabel color={muted} size={13} uppercase={false}>Block info unavailable.</MonoLabel>
      </SafeAreaView>
    );
  }

  const blockedApps = alarm.apps
    .map((bundleId) => ({ bundleId, name: appNameFromBundleId(bundleId) }))
    .filter((a) => a.name !== a.bundleId || alarm.apps.length <= 8);

  const elapsedSeconds = totalSeconds - remaining;
  const pctDone = totalSeconds > 0 ? Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100)) : 0;
  const minutesDone = Math.floor(elapsedSeconds / 60);
  const headerLabel = alarm.block_type === 'blacklist' ? 'Blocked' : 'Allowed';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={barStyle} />
      <HazardStripes color="#EF4444" background={bg} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }}>
        <View style={{ paddingHorizontal: 24, alignItems: 'center', paddingTop: 20 }}>
          <MonoLabel color={muted} size={13} letterSpacing={13 * 0.28}>Locked · Cannot skip</MonoLabel>
          <Display size={110} weight="black" color={ink} lineHeight={100} style={{ marginTop: 22 }}>
            {formatCountdown(remaining)}
          </Display>
          <View style={{ width: '100%', height: 8, backgroundColor: surface, marginTop: 26 }}>
            <View style={{ width: `${pctDone}%`, height: 8, backgroundColor: accent }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10 }}>
            <MonoLabel color={faint} size={12} letterSpacing={12 * 0.14}>{minutesDone} MIN DONE</MonoLabel>
            <MonoLabel color={faint} size={12} letterSpacing={12 * 0.14}>{alarm.block_duration_minutes} MIN TOTAL</MonoLabel>
          </View>
          <Display size={26} weight="black" color={ink} uppercase style={{ textAlign: 'center', lineHeight: 30, marginTop: 34 }}>
            {motivationalLine}
          </Display>
        </View>

        <View>
          <MonoLabel color={muted} size={12} letterSpacing={12 * 0.22} style={{ paddingHorizontal: 24, marginBottom: 14 }}>
            Apps {headerLabel.toLowerCase()} · {blockedApps.length}
          </MonoLabel>
          {blockedApps.length === 0 ? (
            <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
              <MonoLabel color={muted} size={13} uppercase={false}>No apps configured.</MonoLabel>
            </View>
          ) : (
            <View style={{ gap: 2 }}>
              {blockedApps.slice(0, 4).map((app) => (
                <View
                  key={app.bundleId}
                  style={{ backgroundColor: surface, paddingHorizontal: 24, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Display size={18} weight="semibold" color={faint} style={{ textDecorationLine: 'line-through' }}>{app.name}</Display>
                  <View style={{ width: 20, height: 20, backgroundColor: '#EF4444' }} />
                </View>
              ))}
              {blockedApps.length > 4 && (
                <MonoLabel color={faint} size={12} letterSpacing={12 * 0.1} style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
                  + {blockedApps.length - 4} more
                </MonoLabel>
              )}
            </View>
          )}
          <HazardStripes color="#EF4444" background={bg} reverse />
          {Platform.OS === 'web' && (
            <MonoLabel color={muted} size={12} uppercase={false} style={{ textAlign: 'center', paddingVertical: 12 }}>
              App blocking is enforced on iOS / Android.
            </MonoLabel>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
