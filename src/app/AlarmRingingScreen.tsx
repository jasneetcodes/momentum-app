import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Display } from '../components/Display';
import { HazardStripes } from '../components/HazardStripes';
import { MonoLabel } from '../components/MonoLabel';
import { PulsingRing } from '../components/PulsingRing';
import { useThemeColors } from '../hooks/useThemeColors';
import { useBlink } from '../hooks/useBlink';
import Animated from 'react-native-reanimated';
import { cancelRead, initNfc, readTagUid } from '../services/nfc';
import { playAlarmSound, stopAlarmSound } from '../services/sound';
import { isKeyguardSecure, requestKeyguardDismiss, startNativeAlarmAudio, stopNativeAlarmAudio } from '../services/alarmAudio';
import { scheduleAlarm } from '../services/scheduler';
import * as AlarmKit from 'momentum-alarm-kit';
import notifee from '@notifee/react-native';
import { emergencyUnblocksUsedThisMonth } from '../services/emergencyUnblocks';
import { useAlarmStore } from '../stores/alarmStore';
import { useAlarmLogStore } from '../stores/alarmLogStore';
import { useAuthStore } from '../stores/authStore';
import { useModeSessionStore } from '../stores/modeSessionStore';
import type { MainStackParamList, RootNavProp } from '../navigation/types';

const DEFAULT_EMERGENCY_LIMIT = 5; // mirrors profiles.emergency_unblocks_limit default

type RouteProps = RouteProp<MainStackParamList, 'AlarmRinging'>;

function formatTimeDisplay(time: string): { hhmm: string; period: string } {
  const [hh, mm] = time.split(':').map(Number);
  const period = hh >= 12 ? 'PM' : 'AM';
  const displayHours = hh % 12 || 12;
  return { hhmm: `${displayHours}:${String(mm).padStart(2, '0')}`, period };
}

export default function AlarmRingingScreen() {
  const navigation = useNavigation<RootNavProp>();
  const route = useRoute<RouteProps>();
  const { alarmId } = route.params;

  const { bg, ink, muted, accent } = useThemeColors();
  const alarms = useAlarmStore((s) => s.alarms);
  const fetchAlarms = useAlarmStore((s) => s.fetchAlarms);
  const activeLog = useAlarmLogStore((s) => s.activeLog);
  const fire = useAlarmLogStore((s) => s.fire);
  const dismissNfc = useAlarmLogStore((s) => s.dismissNfc);
  const dismissEmergency = useAlarmLogStore((s) => s.dismissEmergency);
  // If a mode session is already active, the user is already in a blocking
  // state. We skip the post-alarm block screen entirely (mode takes priority).
  const activeModeSession = useModeSessionStore((s) => s.activeSession);
  const profile = useAuthStore((s) => s.profile);

  const alarm = useMemo(() => alarms.find((a) => a.id === alarmId), [alarms, alarmId]);

  const emergencyLimit = profile?.emergency_unblocks_limit ?? DEFAULT_EMERGENCY_LIMIT;
  const [emergencyUsed, setEmergencyUsed] = useState(0);
  useEffect(() => {
    emergencyUnblocksUsedThisMonth().then(setEmergencyUsed);
  }, []);

  // If the screen was opened by a notification with no log in memory, fire one
  useEffect(() => {
    if (!alarms.length) fetchAlarms();
  }, [alarms.length, fetchAlarms]);

  useEffect(() => {
    if (alarm && (!activeLog || activeLog.alarm_id !== alarmId)) {
      fire(alarmId);
    }
  }, [alarm, activeLog, alarmId, fire]);

  const [scanError, setScanError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // On devices with no PIN/swipe lock, dismiss the keyguard immediately so
  // the NFC reader is active as soon as the alarm screen appears. On secure
  // devices (PIN/biometric) we wait for the user to tap the ring instead.
  useEffect(() => {
    isKeyguardSecure().then((secure) => {
      if (!secure) requestKeyguardDismiss();
    });
  }, []);

  const blinkStyle = useBlink();

  const startScan = useCallback(async () => {
    if (!alarm || cancelledRef.current) return;
    setScanError(null);
    const supported = await initNfc();
    if (!supported) {
      setScanError('NFC not supported on this device.');
      return;
    }

    try {
      const uid = await readTagUid();
      if (cancelledRef.current) return;

      const err = await dismissNfc(alarm, uid);
      if (err === null) {
        await stopAlarmSound();
        await stopNativeAlarmAudio();
        await AlarmKit.stopAlarm(alarm.id);
        if (activeModeSession) {
          // Mode is already blocking apps — no need for a second post-alarm
          // block on top. Go straight to Home.
          navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
        } else {
          navigation.replace('PostAlarmBlock', { alarmId: alarm.id });
        }
        return;
      }
      if (err === 'unknown_tag') {
        setScanError("That doesn't look like a Momentum tag.");
      } else if (err === 'not_users_tag') {
        setScanError("That tag isn't registered to your account.");
      } else {
        setScanError('Could not dismiss alarm. Try again.');
      }
      // Brief delay then restart scan
      setTimeout(() => {
        if (!cancelledRef.current) startScan();
      }, 1800);
    } catch (e: any) {
      if (cancelledRef.current) return;
      if (!e?.message?.toLowerCase().includes('cancel')) {
        setTimeout(() => {
          if (!cancelledRef.current) startScan();
        }, 600);
      }
    }
  }, [alarm, dismissNfc, navigation]);

  useEffect(() => {
    cancelledRef.current = false;
    startScan();
    return () => {
      cancelledRef.current = true;
      cancelRead();
    };
  }, [startScan]);

  useEffect(() => {
    if (!alarm) return;
    // The Notifee background handler in index.js already started the native
    // foreground alarm-stream audio the instant the trigger fired. We re-call
    // it here only as a defensive no-op for paths that bypass the trigger
    // (e.g. someone navigates here manually). Native start is idempotent.
    startNativeAlarmAudio(alarm.sound, alarm.id);
    playAlarmSound(alarm.sound);
    // Dismiss the triggering notification so it doesn't linger in the shade
    notifee.cancelDisplayedNotifications().catch(() => {});
    // Re-schedule next occurrence (Notifee's TIMESTAMP trigger is one-shot)
    if (alarm.is_active && alarm.days_of_week.length > 0) {
      scheduleAlarm(alarm).catch(() => {});
    }
    return () => {
      stopAlarmSound();
      stopNativeAlarmAudio();
    };
  }, [alarm]);

  // Block hardware back on Android
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const handleEmergency = () => {
    if (!alarm) return;
    const remaining = Math.max(0, emergencyLimit - emergencyUsed);
    if (remaining <= 0) {
      Alert.alert('No emergency unblocks remaining', 'You have used all of your emergency unblocks for this month.');
      return;
    }
    Alert.alert(
      'Emergency unblock?',
      `This uses 1 of your ${remaining} remaining emergency unblocks this month. You will dismiss this alarm without your tag — the block will still apply.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss alarm',
          style: 'destructive',
          onPress: async () => {
            cancelledRef.current = true;
            await cancelRead();
            const err = await dismissEmergency(alarm);
            if (err) {
              Alert.alert('Could not dismiss', 'Try tapping your tag.');
              cancelledRef.current = false;
              startScan();
              return;
            }
            await stopAlarmSound();
            await stopNativeAlarmAudio();
            await AlarmKit.stopAlarm(alarm.id);
            if (activeModeSession) {
              navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
            } else {
              navigation.replace('PostAlarmBlock', { alarmId: alarm.id });
            }
          },
        },
      ],
    );
  };

  if (!alarm) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <MonoLabel color={muted} size={13} uppercase={false}>Alarm not found.</MonoLabel>
      </SafeAreaView>
    );
  }

  const { hhmm, period } = formatTimeDisplay(alarm.time);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar hidden />
      <HazardStripes color={accent} background={bg} />
      <View style={{ flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'space-between', paddingTop: 36, paddingBottom: 24 }}>
        <View style={{ alignItems: 'center' }}>
          <Animated.View style={blinkStyle}>
            <MonoLabel color={accent} size={13} letterSpacing={13 * 0.3}>Alarm active</MonoLabel>
          </Animated.View>
          <Display size={128} weight="black" color={ink} lineHeight={108} style={{ marginTop: 26 }}>{hhmm}</Display>
          <MonoLabel color={muted} size={22} weight="bold" letterSpacing={22 * 0.18} style={{ marginTop: 14 }}>
            {period}{alarm.label ? ` · ${alarm.label.toUpperCase()}` : ''}
          </MonoLabel>
        </View>

        <View style={{ alignItems: 'center' }}>
          <Pressable onPress={() => requestKeyguardDismiss()}>
            <PulsingRing size={200} color={accent} rings={2}>
              <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: bg }} />
              </View>
            </PulsingRing>
          </Pressable>
          <Display size={34} weight="black" color={ink} uppercase style={{ textAlign: 'center', lineHeight: 36, marginTop: 34 }}>
            Tap your tag{'\n'}to kill it
          </Display>
          {scanError && (
            <MonoLabel color="#EF4444" size={13} uppercase={false} style={{ textAlign: 'center', marginTop: 16 }}>{scanError}</MonoLabel>
          )}
        </View>

        <Pressable onPress={handleEmergency} hitSlop={20}>
          <MonoLabel color={muted} size={13} letterSpacing={13 * 0.16} style={{ borderBottomWidth: 1, borderBottomColor: muted, paddingBottom: 4 }}>
            Emergency unblock · {Math.max(0, emergencyLimit - emergencyUsed)} left
          </MonoLabel>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
