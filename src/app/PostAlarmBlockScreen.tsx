import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Text } from '../components/Text';
import { SOCIAL_MEDIA_APPS } from '../constants/apps';
import { useThemeColors } from '../hooks/useThemeColors';
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

  const { barStyle, accent } = useThemeColors();
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
        completeBlock();
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockEndsAt]);

  // Block hardware back on Android — block must complete
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  if (!alarm || !blockEndsAt) {
    return (
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark items-center justify-center">
        <Text variant="muted">Block info unavailable.</Text>
      </SafeAreaView>
    );
  }

  const blockedApps = alarm.apps
    .map((bundleId) => ({ bundleId, name: appNameFromBundleId(bundleId) }))
    .filter((a) => a.name !== a.bundleId || alarm.apps.length <= 8);

  const headerLabel =
    alarm.block_type === 'blacklist' ? 'Apps blocked' : 'Apps allowed';

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <StatusBar barStyle={barStyle} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 }}
      >
        <View className="flex-1 items-center justify-center pt-12">
          <Text variant="muted" className="text-sm uppercase tracking-wider">
            Time remaining
          </Text>
          <Text
            className="text-ink dark:text-ink-dark font-bold mt-3"
            style={{ fontSize: 96, fontVariant: ['tabular-nums'] }}
          >
            {formatCountdown(remaining)}
          </Text>
          <Text variant="muted" className="text-base mt-4 text-center">
            {motivationalLine}
          </Text>
        </View>

        <View className="pb-6">
          <Text variant="label" className="mb-3">{headerLabel}</Text>
          <Card className="p-0">
            {blockedApps.length === 0 ? (
              <View className="px-5 py-4">
                <Text variant="muted" className="text-sm">No apps configured.</Text>
              </View>
            ) : (
              blockedApps.map((app, i) => (
                <View
                  key={app.bundleId}
                  className="px-5 py-3 flex-row items-center justify-between"
                  style={{
                    borderBottomWidth: i < blockedApps.length - 1 ? 1 : 0,
                    borderBottomColor: accent + '14',
                  }}
                >
                  <Text className="text-base">{app.name}</Text>
                </View>
              ))
            )}
          </Card>
          <Text variant="muted" className="text-xs text-center mt-4">
            {Platform.OS === 'web'
              ? 'App blocking is enforced on iOS / Android.'
              : "You can't skip this. Timer must complete."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
