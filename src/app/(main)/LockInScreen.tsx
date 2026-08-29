import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StatusBar, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Display } from '../../components/Display';
import { MonoLabel } from '../../components/MonoLabel';
import { Slab } from '../../components/Slab';
import { SlabButton } from '../../components/SlabButton';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useBlink } from '../../hooks/useBlink';
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
import { useAuthStore } from '../../stores/authStore';
import type { RootNavProp } from '../../navigation/types';

const DEFAULT_EMERGENCY_LIMIT = 5; // mirrors profiles.emergency_unblocks_limit default

function formatHms(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(total / 3600);
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatTodayTotal(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function LockInScreen() {
  const navigation = useNavigation<RootNavProp>();
  const { barStyle, bg, ink, accent, muted, faint, border, surface } = useThemeColors();

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
  const profile = useAuthStore((s) => s.profile);
  const emergencyLimit = profile?.emergency_unblocks_limit ?? DEFAULT_EMERGENCY_LIMIT;

  const selectedMode: Mode | null = useMemo(
    () => modes.find((m) => m.id === selectedModeId) ?? null,
    [modes, selectedModeId],
  );

  const [totalToday, setTotalToday] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [emergencyUsed, setEmergencyUsed] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [bestToday, setBestToday] = useState(0);
  const cancelledRef = useRef(false);
  const armTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkStyle = useBlink();

  const ARM_TIMEOUT_MS = 20000;

  // Initial data fetch + selected mode hydration
  useEffect(() => {
    loadSelectedMode();
    fetchModes();
  }, [fetchModes, loadSelectedMode]);

  // Refresh totals whenever the tab regains focus (covers post-session updates)
  useFocusEffect(
    useCallback(() => {
      totalMinutesTodayFn().then((m) => { setTotalToday(m); setBestToday((prev) => Math.max(prev, m)); });
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

  // NFC scan loop — only runs while user has tapped the ring to arm scanning.
  // Bounded by ARM_TIMEOUT_MS so we don't hold the NFC stack open indefinitely;
  // an always-on loop here was competing with the AccessibilityService for the
  // main thread and contributing to the blocked-app ANR.
  const disarm = useCallback(() => {
    if (armTimeoutRef.current) {
      clearTimeout(armTimeoutRef.current);
      armTimeoutRef.current = null;
    }
    cancelledRef.current = true;
    cancelRead();
    setArmed(false);
  }, []);

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
        totalMinutesTodayFn().then(setTotalToday);
        if (armTimeoutRef.current) {
          clearTimeout(armTimeoutRef.current);
          armTimeoutRef.current = null;
        }
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
    if (!activeSession || !armed) return;
    cancelledRef.current = false;
    setScanError(null);
    startScan();
    armTimeoutRef.current = setTimeout(() => {
      cancelledRef.current = true;
      cancelRead();
      setArmed(false);
      setScanError('No tag detected — tap to try again.');
    }, ARM_TIMEOUT_MS);
    return () => {
      cancelledRef.current = true;
      cancelRead();
      if (armTimeoutRef.current) {
        clearTimeout(armTimeoutRef.current);
        armTimeoutRef.current = null;
      }
    };
  }, [activeSession, armed, startScan]);

  // Reset armed state whenever the session ends/changes so the next session
  // starts in idle.
  useEffect(() => {
    if (!activeSession) setArmed(false);
  }, [activeSession]);

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
    const remaining = Math.max(0, emergencyLimit - emergencyUsed);
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

  // ------------------ Render: session running ------------------

  if (activeSession) {
    const tappedInAt = new Date(activeSession.activated_at);
    const blockedApps = selectedMode?.apps.slice(0, 4) ?? [];

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }}>
          <View style={{ paddingHorizontal: 24, alignItems: 'center', paddingTop: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Animated.View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent }, blinkStyle]} />
              <MonoLabel color={accent} size={13} letterSpacing={13 * 0.3}>
                Locked in · {(selectedMode?.label ?? 'Session').toUpperCase()}
              </MonoLabel>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 26 }}>
              <Display size={80} weight="black" color={ink} lineHeight={72}>{formatHms(elapsed).slice(0, -3)}</Display>
              <Display size={38} weight="black" color={accent}>{formatHms(elapsed).slice(-3)}</Display>
            </View>
            <MonoLabel color={muted} size={13} letterSpacing={13 * 0.18} style={{ marginTop: 12 }}>Elapsed · running up</MonoLabel>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', borderTopWidth: 1, borderTopColor: border, paddingTop: 14, marginTop: 24 }}>
              <MonoLabel color={faint} size={12} letterSpacing={12 * 0.14}>Tapped in {formatClock(tappedInAt)}</MonoLabel>
              <MonoLabel color={faint} size={12} letterSpacing={12 * 0.14}>Best today {formatTodayTotal(bestToday)}</MonoLabel>
            </View>

            <View style={{ flexDirection: 'row', gap: 2, width: '100%', marginTop: 28 }}>
              <Slab style={{ flex: 1, padding: 18 }}>
                <MonoLabel color={muted} size={10} letterSpacing={10 * 0.16}>Today</MonoLabel>
                <Display size={26} weight="black" color={ink} style={{ marginTop: 10 }}>{formatTodayTotal(totalToday)}</Display>
              </Slab>
              <Slab style={{ flex: 1, padding: 18 }}>
                <MonoLabel color={muted} size={10} letterSpacing={10 * 0.16}>Mode</MonoLabel>
                <Display size={26} weight="black" color={ink} style={{ marginTop: 10 }}>{selectedMode?.label ?? '—'}</Display>
              </Slab>
            </View>
          </View>

          <View style={{ marginTop: 24 }}>
            <MonoLabel color={muted} size={12} letterSpacing={12 * 0.22} style={{ paddingHorizontal: 24, marginBottom: 12 }}>
              Blocked while locked in · {selectedMode?.apps.length ?? 0}
            </MonoLabel>
            <View style={{ gap: 2 }}>
              {blockedApps.map((appId) => (
                <View key={appId} style={{ backgroundColor: surface, paddingHorizontal: 24, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Display size={18} weight="semibold" color={faint} style={{ textDecorationLine: 'line-through' }}>{appId}</Display>
                  <Ionicons name="lock-closed" size={20} color={accent} />
                </View>
              ))}
            </View>

            <View style={{ padding: 20, alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => { if (!armed) setArmed(true); }}
                disabled={armed}
                style={{ width: '100%', borderWidth: 1.5, borderColor: armed ? accent : border, paddingVertical: 20.5, alignItems: 'center' }}
              >
                <Display size={19} weight="extrabold" color={ink} uppercase letterSpacing={19 * 0.06}>
                  {armed ? 'Hold your tag to the phone…' : 'Tap tag to end session'}
                </Display>
              </Pressable>
              <MonoLabel color={faint} size={12} letterSpacing={12 * 0.1} uppercase={false}>
                Time is logged when you tap out
              </MonoLabel>
              {armed && (
                <Pressable onPress={disarm} hitSlop={12}>
                  <MonoLabel color={muted} size={12}>Cancel</MonoLabel>
                </Pressable>
              )}
              {scanError && (
                <MonoLabel color="#EF4444" size={12} uppercase={false}>{scanError}</MonoLabel>
              )}
              <Pressable onPress={handleEmergency} hitSlop={16} style={{ marginTop: 8 }}>
                <MonoLabel color={faint} size={11}>
                  Emergency unblock · {Math.max(0, emergencyLimit - emergencyUsed)} left
                </MonoLabel>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ------------------ Render: idle ------------------

  const hasModes = modes.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      <StatusBar barStyle={barStyle} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
          <MonoLabel color={muted} size={12} letterSpacing={12 * 0.22} style={{ textAlign: 'center' }}>
            Locked in today · {formatTodayTotal(totalToday)}
          </MonoLabel>

          {hasModes && (
            <View style={{ flexDirection: 'row', gap: 2, marginTop: 18 }}>
              {modes.slice(0, 3).map((mode) => {
                const active = mode.id === selectedModeId;
                return (
                  <Pressable
                    key={mode.id}
                    onPress={() => selectMode(mode.id)}
                    onLongPress={() => navigation.navigate('CreateMode', { modeId: mode.id })}
                    style={{ flex: 1 }}
                  >
                    <Slab background={active ? accent : surface} style={{ padding: 16 }}>
                      <MonoLabel color={active ? 'rgba(14,14,15,.6)' : muted} size={10} letterSpacing={10 * 0.14}>Mode</MonoLabel>
                      <Display size={20} weight="black" color={active ? bg : muted} uppercase style={{ marginTop: 8 }} numberOfLines={1}>
                        {mode.label}
                      </Display>
                    </Slab>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 248, height: 248, borderRadius: 124, borderWidth: 1.5, borderStyle: 'dashed', borderColor: border, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 184, height: 184, borderRadius: 92, backgroundColor: surface, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Ionicons name="hardware-chip-outline" size={76} color={accent} />
              <MonoLabel color={muted} size={11} letterSpacing={11 * 0.18}>
                {selectedMode?.label ?? (hasModes ? 'Select a mode' : 'No modes yet')}
              </MonoLabel>
            </View>
          </View>
          <Pressable onPress={() => (hasModes ? undefined : navigation.navigate('CreateMode', {}))}>
            <Display size={26} weight="black" color={ink} uppercase style={{ textAlign: 'center', lineHeight: 30, marginTop: 34 }}>
              {hasModes ? 'Tap in. The clock\nruns till you tap out.' : 'Create a mode\nto get started.'}
            </Display>
          </Pressable>
          {hasModes && (
            <Pressable onPress={() => navigation.navigate('CreateMode', {})} style={{ marginTop: 16 }}>
              <MonoLabel color={accent} size={12} letterSpacing={12 * 0.1}>+ New mode</MonoLabel>
            </Pressable>
          )}
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <SlabButton
            label="Lock in"
            fullWidth
            disabled={!selectedMode}
            onPress={handleLockIn}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
