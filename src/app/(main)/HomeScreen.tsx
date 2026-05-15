import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuthStore } from '../../stores/authStore';
import { useModeSessionStore } from '../../stores/modeSessionStore';
import { useModeStore } from '../../stores/modeStore';
import type { HomeNavProp } from '../../navigation/types';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(total / 3600)).padStart(2, '0');
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const { barStyle, ink, accent } = useThemeColors();
  const profile = useAuthStore((s) => s.profile);

  const activeSession = useModeSessionStore((s) => s.activeSession);
  const modes = useModeStore((s) => s.modes);
  const activeMode = useMemo(
    () => (activeSession ? modes.find((m) => m.id === activeSession.mode_id) ?? null : null),
    [activeSession, modes],
  );

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!activeSession) { setElapsed(0); return; }
    const start = new Date(activeSession.activated_at).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  const firstName = profile?.name?.split(' ')[0] ?? ' ';

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark" edges={['top']}>
      <StatusBar barStyle={barStyle} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-6 pt-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text variant="muted" className="text-sm">Good morning,</Text>
              <Text variant="heading" className="text-2xl mt-1 capitalize">{firstName}</Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('Settings')}
              hitSlop={12}
              className="p-2"
            >
              <Ionicons name="settings-outline" size={24} color={ink} />
            </Pressable>
          </View>

          {activeSession && (
            <Pressable
              onPress={() => navigation.jumpTo('LockIn')}
              className="mt-6 active:opacity-70"
            >
              <Card>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3 flex-1">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: accent + '1A' }}
                    >
                      <Ionicons name="lock-closed" size={18} color={accent} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold">
                        {activeMode?.label ?? 'Locked in'}
                      </Text>
                      <Text variant="muted" className="text-xs mt-0.5" style={{ fontVariant: ['tabular-nums'] }}>
                        {formatElapsed(elapsed)}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={ink} />
                </View>
              </Card>
            </Pressable>
          )}

          <View className="mt-10">
            <View className="flex-row items-baseline">
              <Text className="text-6xl font-bold text-ink dark:text-ink-dark">0</Text>
              <Text variant="muted" className="text-base ml-2">day streak</Text>
            </View>
            <View className="flex-row gap-2 mt-4">
              {DAY_LABELS.map((day, i) => (
                <View key={i} className="flex-1 items-center gap-2">
                  <View className="w-2.5 h-2.5 rounded-full bg-muted/30 dark:bg-muted-dark/30" />
                  <Text variant="muted" className="text-xs">{day}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className="mt-10">
            <Text variant="label" className="mb-3">Next alarm</Text>
            <Card>
              <Text className="text-5xl font-bold text-ink dark:text-ink-dark">--:--</Text>
              <Text variant="muted" className="text-sm mt-2">No alarms set</Text>
            </Card>
          </View>

          <View className="mt-8 flex-row gap-3">
            <Card className="flex-1">
              <Text variant="muted" className="text-xs">Today's focus</Text>
              <Text className="text-2xl font-bold text-ink dark:text-ink-dark mt-2">0h 0m</Text>
            </Card>
            <Card className="flex-1">
              <Text variant="muted" className="text-xs">All-time streak</Text>
              <Text className="text-2xl font-bold text-ink dark:text-ink-dark mt-2">0</Text>
            </Card>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
