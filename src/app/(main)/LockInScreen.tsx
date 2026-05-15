import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Text } from '../../components/Text';
import { useThemeColors } from '../../hooks/useThemeColors';
import { cancelRead, initNfc, readTagUid } from '../../services/nfc';
import {
  isPermissionGranted,
  requestPermission,
  startBlocking,
  stopBlocking,
} from '../../services/appBlocking';
import { useModeStore, type Mode } from '../../stores/modeStore';
import { useModeSessionStore } from '../../stores/modeSessionStore';
import { useAlarmLogStore } from '../../stores/alarmLogStore';
import type { RootNavProp } from '../../navigation/types';

const EMERGENCY_LIMIT = 5; // mirrors profiles.emergency_unblocks_limit default

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(total / 3600)).padStart(2, '0');
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatTodayTotal(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function LockInScreen() {
  const navigation = useNavigation<RootNavProp>();
  const { isDark, barStyle, ink, accent, muted } = useThemeColors();

  const modes = useModeStore((s) => s.modes);
  const selectedModeId = useModeStore((s) => s.selectedModeId);
  const fetchModes = useModeStore((s) => s.fetchModes);
  const selectMode = useModeStore((s) => s.selectMode);
  const loadSelectedMode = useModeStore((s) => s.loadSelectedMode);

  const activeSession = useModeSessionStore((s) => s.activeSession);
  const activate = useModeSessionStore((s) => s.activate);
  const deactivateNfc = useModeSessionStore((s) => s.deactivateNfc);
  const deactivateEmergency = useModeSessionStore((s) => s.deactivateEmergency);
  const emergencyUsedFn = useModeSessionStore((s) => s.emergencyUnblocksUsedThisMonth);
  const totalMinutesTodayFn = useModeSessionStore((s) => s.totalMinutesToday);

  const activeAlarmLog = useAlarmLogStore((s) => s.activeLog);

  const selectedMode: Mode | null = useMemo(
    () => modes.find((m) => m.id === selectedModeId) ?? null,
    [modes, selectedModeId],
  );

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [totalToday, setTotalToday] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [emergencyUsed, setEmergencyUsed] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // Initial data fetch + selected mode hydration
  useEffect(() => {
    loadSelectedMode();
    fetchModes();
  }, [fetchModes, loadSelectedMode]);

  // Refresh totals whenever the tab regains focus (covers post-session updates)
  useFocusEffect(
    useCallback(() => {
      totalMinutesTodayFn().then(setTotalToday);
      emergencyUsedFn().then(setEmergencyUsed);
    }, [totalMinutesTodayFn, emergencyUsedFn]),
  );

  // Live elapsed timer while session is active
  useEffect(() => {
    if (!activeSession) {
      setElapsed(0);
      return;
    }
    const start = new Date(activeSession.activated_at).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  // Pulsing ring animation
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!activeSession) return;
    scale.value = withRepeat(
      withTiming(1.25, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [activeSession, opacity, scale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // NFC scan loop — only runs in active state
  const startScan = useCallback(async () => {
    if (!activeSession || cancelledRef.current) return;
    setScanError(null);
    const supported = await initNfc();
    if (!supported) {
      setScanError('NFC not supported on this device.');
      return;
    }
    try {
      const uid = await readTagUid();
      if (cancelledRef.current) return;
      const err = await deactivateNfc(uid);
      if (err === null) {
        await stopBlocking();
        // Refresh today's total since we just closed out a session
        totalMinutesTodayFn().then(setTotalToday);
        return;
      }
      if (err === 'unknown_tag') setScanError("That doesn't look like a Momentum tag.");
      else if (err === 'not_users_tag') setScanError("That tag isn't registered to your account.");
      else setScanError('Could not end the session. Try again.');
      setTimeout(() => { if (!cancelledRef.current) startScan(); }, 1800);
    } catch (e: any) {
      if (cancelledRef.current) return;
      if (!e?.message?.toLowerCase().includes('cancel')) {
        setTimeout(() => { if (!cancelledRef.current) startScan(); }, 600);
      }
    }
  }, [activeSession, deactivateNfc, totalMinutesTodayFn]);

  useEffect(() => {
    cancelledRef.current = false;
    if (activeSession) startScan();
    return () => {
      cancelledRef.current = true;
      cancelRead();
    };
  }, [activeSession, startScan]);

  // ------------------ Activation flow ------------------

  const ensurePermission = async (): Promise<boolean> => {
    const granted = await isPermissionGranted();
    if (granted) return true;
    return new Promise((resolve) => {
      Alert.alert(
        Platform.OS === 'android' ? 'Enable Accessibility' : 'Enable Screen Time',
        Platform.OS === 'android'
          ? 'Momentum needs Accessibility access to block apps during your session. Tap Open Settings, find Momentum, and turn it on.'
          : 'Momentum needs Screen Time access to block apps during your session.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Open Settings',
            onPress: async () => { await requestPermission(); resolve(false); },
          },
        ],
      );
    });
  };

  const handleLockIn = async () => {
    if (!selectedMode) return;

    // Conflict guard: post-alarm block in progress?
    if (activeAlarmLog?.block_ends_at && !activeAlarmLog.block_completed) {
      const end = new Date(activeAlarmLog.block_ends_at);
      const now = new Date();
      if (end > now) {
        const time = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        Alert.alert(
          'Post-alarm block in progress',
          `You're in a post-alarm block until ${time}. Wait for it to end or tap your tag to finish it.`,
        );
        return;
      }
    }

    const ok = await ensurePermission();
    if (!ok) return;

    const err = await activate(selectedMode, 'button');
    if (err) {
      Alert.alert('Could not start session', 'Try again in a moment.');
      return;
    }
    await startBlocking(selectedMode.apps, selectedMode.block_type, selectedMode.label);
  };

  const handleEmergency = () => {
    if (!activeSession) return;
    const remaining = Math.max(0, EMERGENCY_LIMIT - emergencyUsed);
    if (remaining <= 0) {
      Alert.alert('No emergency unblocks remaining', 'You have used all of your emergency unblocks for this month.');
      return;
    }
    Alert.alert(
      'Emergency unblock?',
      `This uses 1 of your ${remaining} remaining emergency unblocks this month.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End session',
          style: 'destructive',
          onPress: async () => {
            cancelledRef.current = true;
            await cancelRead();
            const err = await deactivateEmergency();
            if (err) {
              Alert.alert('Could not end session', 'Try tapping your tag.');
              cancelledRef.current = false;
              startScan();
              return;
            }
            await stopBlocking();
            totalMinutesTodayFn().then(setTotalToday);
            emergencyUsedFn().then(setEmergencyUsed);
          },
        },
      ],
    );
  };

  // ------------------ Render ------------------

  // Active session — darker, locked-down UI
  if (activeSession) {
    const remainingEmergency = Math.max(0, EMERGENCY_LIMIT - emergencyUsed);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000' : '#1A1A1A' }} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View className="flex-1 px-6 pt-4">
          <View className="items-center">
            <Text className="text-sm" style={{ color: '#888' }}>
              Locked in today — {formatTodayTotal(totalToday)}
            </Text>
          </View>

          <View className="items-center mt-6">
            <Text className="text-3xl font-bold" style={{ color: '#fff' }}>
              {selectedMode?.label ?? 'Locked in'}
            </Text>
            <Text className="text-sm mt-1" style={{ color: '#888' }}>
              {selectedMode
                ? selectedMode.block_type === 'blacklist'
                  ? `Blocking ${selectedMode.apps.length} apps`
                  : `${selectedMode.apps.length} apps allowed`
                : ''}
            </Text>
          </View>

          <View className="flex-1 items-center justify-center">
            <Text style={{ color: '#fff', fontSize: 56, fontVariant: ['tabular-nums'], fontWeight: '700' }}>
              {formatElapsed(elapsed)}
            </Text>

            <View className="w-56 h-56 items-center justify-center mt-8">
              <Animated.View
                style={[{
                  position: 'absolute',
                  width: 224,
                  height: 224,
                  borderRadius: 112,
                  borderWidth: 2,
                  borderColor: accent,
                }, ringStyle]}
              />
              <View
                className="w-32 h-32 rounded-full items-center justify-center"
                style={{ backgroundColor: accent + '1A' }}
              >
                <Ionicons name="hardware-chip-outline" size={64} color={accent} />
              </View>
            </View>

            <Text className="text-base mt-8" style={{ color: '#fff' }}>
              Tap your tag to finish
            </Text>
            {scanError && (
              <Text className="text-sm text-red-400 mt-3 text-center">{scanError}</Text>
            )}
          </View>

          <View className="pb-6 items-center">
            <Pressable onPress={handleEmergency} hitSlop={20}>
              <Text className="text-xs" style={{ color: '#666' }}>
                Emergency unblock — {remainingEmergency} remaining
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Default state
  const hasModes = modes.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark" edges={['top']}>
      <StatusBar barStyle={barStyle} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 px-6 pt-4">
          <View className="items-center">
            <Text variant="muted" className="text-sm">
              Locked in today — {formatTodayTotal(totalToday)}
            </Text>
          </View>

          <Pressable
            className="mt-8 self-center flex-row items-center gap-2"
            onPress={() => hasModes ? setDropdownOpen(true) : navigation.navigate('CreateMode', {})}
          >
            <Text variant="heading" className="text-2xl">
              {selectedMode?.label ?? (hasModes ? 'Select a mode' : 'Create a mode')}
            </Text>
            <Ionicons name="chevron-down" size={20} color={ink} />
          </Pressable>
          <Text variant="muted" className="text-center text-sm mt-2">
            {selectedMode
              ? selectedMode.block_type === 'blacklist'
                ? `Blocking ${selectedMode.apps.length} apps`
                : `${selectedMode.apps.length} apps allowed`
              : hasModes
                ? 'Pick a mode to start'
                : 'Create a mode to start'}
          </Text>

          <View className="flex-1 items-center justify-center">
            <View className="w-56 h-56 rounded-full bg-surface dark:bg-surface-dark items-center justify-center">
              <Ionicons name="hardware-chip-outline" size={80} color={muted} />
            </View>
            <Text variant="muted" className="text-xs mt-6 uppercase tracking-wider">
              Tap your tag to lock in
            </Text>
          </View>

          <View className="pb-2">
            <Button
              label="Lock In"
              fullWidth
              disabled={!selectedMode}
              onPress={handleLockIn}
            />
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={dropdownOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDropdownOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onPress={() => setDropdownOpen(false)}
        >
          <Pressable onPress={() => {}} style={{ marginTop: 'auto' }}>
            <SafeAreaView
              edges={['bottom']}
              style={{ backgroundColor: isDark ? '#1A1A1B' : '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
            >
              <View className="px-6 pt-6 pb-4">
                <Text variant="heading" className="text-xl mb-2">Select a mode</Text>
              </View>
              {modes.map((mode) => {
                const active = mode.id === selectedModeId;
                return (
                  <Pressable
                    key={mode.id}
                    onPress={() => { selectMode(mode.id); setDropdownOpen(false); }}
                    className="px-6 py-4 flex-row items-center justify-between active:opacity-50"
                    style={{ borderBottomWidth: 1, borderBottomColor: muted + '20' }}
                  >
                    <View>
                      <Text className="text-base">{mode.label}</Text>
                      <Text variant="muted" className="text-xs mt-0.5">
                        {mode.block_type === 'blacklist'
                          ? `Blocking ${mode.apps.length} apps`
                          : `${mode.apps.length} apps allowed`}
                      </Text>
                    </View>
                    {active && <Ionicons name="checkmark" size={20} color={accent} />}
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => { setDropdownOpen(false); navigation.navigate('CreateMode', {}); }}
                className="px-6 py-5 flex-row items-center gap-3 active:opacity-50"
              >
                <Ionicons name="add-circle-outline" size={22} color={accent} />
                <Text className="text-base" style={{ color: accent }}>Create new mode</Text>
              </Pressable>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
