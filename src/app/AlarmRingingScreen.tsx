import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, StatusBar, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Text';
import { useThemeColors } from '../hooks/useThemeColors';
import { cancelRead, initNfc, readTagUid } from '../services/nfc';
import { playAlarmSound, stopAlarmSound } from '../services/sound';
import { isKeyguardSecure, requestKeyguardDismiss, startNativeAlarmAudio, stopNativeAlarmAudio } from '../services/alarmAudio';
import { scheduleAlarm } from '../services/scheduler';
import * as AlarmKit from 'momentum-alarm-kit';
import notifee from '@notifee/react-native';
import { useAlarmStore } from '../stores/alarmStore';
import { useAlarmLogStore } from '../stores/alarmLogStore';
import { useModeSessionStore } from '../stores/modeSessionStore';
import type { MainStackParamList, RootNavProp } from '../navigation/types';

type RouteProps = RouteProp<MainStackParamList, 'AlarmRinging'>;

function formatTimeDisplay(time: string): { hhmm: string; period: string } {
  const [hh, mm] = time.split(':').map(Number);
  const period = hh >= 12 ? 'PM' : 'AM';
  const displayHours = hh % 12 || 12;
  return {
    hhmm: `${displayHours}:${String(mm).padStart(2, '0')}`,
    period,
  };
}

export default function AlarmRingingScreen() {
  const navigation = useNavigation<RootNavProp>();
  const route = useRoute<RouteProps>();
  const { alarmId } = route.params;

  const { accent } = useThemeColors();
  const alarms = useAlarmStore((s) => s.alarms);
  const fetchAlarms = useAlarmStore((s) => s.fetchAlarms);
  const activeLog = useAlarmLogStore((s) => s.activeLog);
  const fire = useAlarmLogStore((s) => s.fire);
  const dismissNfc = useAlarmLogStore((s) => s.dismissNfc);
  const dismissEmergency = useAlarmLogStore((s) => s.dismissEmergency);
  // If a mode session is already active, the user is already in a blocking
  // state. We skip the post-alarm block screen entirely (mode takes priority).
  const activeModeSession = useModeSessionStore((s) => s.activeSession);

  const alarm = useMemo(() => alarms.find((a) => a.id === alarmId), [alarms, alarmId]);

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

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.4, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity, scale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

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
    Alert.alert(
      'Emergency unblock?',
      'You will dismiss this alarm without your tag. The block will still apply.',
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
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark items-center justify-center">
        <Text variant="muted">Alarm not found.</Text>
      </SafeAreaView>
    );
  }

  const { hhmm, period } = formatTimeDisplay(alarm.time);

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <StatusBar hidden />
      <View className="flex-1 px-6 items-center justify-between pt-12 pb-4">
        <View className="items-center">
          <View className="flex-row items-baseline">
            <Text className="text-ink dark:text-ink-dark font-bold" style={{ fontSize: 96, lineHeight: 108 }}>
              {hhmm}
            </Text>
            <Text variant="muted" className="text-2xl ml-2">{period}</Text>
          </View>
          {alarm.label && (
            <Text variant="muted" className="text-base mt-3">{alarm.label}</Text>
          )}
        </View>

        <Pressable className="items-center" onPress={() => requestKeyguardDismiss()}>
          <View className="w-40 h-40 items-center justify-center mb-8">
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  borderWidth: 2,
                  borderColor: accent,
                },
                ringStyle,
              ]}
            />
            <View
              className="w-20 h-20 rounded-full items-center justify-center"
              style={{ backgroundColor: accent + '1A' }}
            >
              <View
                className="w-12 h-12 rounded-full"
                style={{ backgroundColor: accent }}
              />
            </View>
          </View>
          <Text variant="heading" className="text-xl text-center">Tap your Momentum tag</Text>
          {scanError && (
            <Text className="text-sm text-red-500 mt-3 text-center">{scanError}</Text>
          )}
        </Pressable>

        <Pressable onPress={handleEmergency} hitSlop={20}>
          <Text variant="muted" className="text-[10px] opacity-50">Emergency unblock</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
