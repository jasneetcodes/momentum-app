import { Platform } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';
import {
  canScheduleExactAlarms,
  canUseFullScreenIntent,
  isIgnoringBatteryOptimizations,
  openExactAlarmSettings,
  openFullScreenIntentSettings,
  requestIgnoreBatteryOptimizations,
} from './alarmAudio';
import { isPermissionGranted as isBlockingPermissionGranted, requestPermission as requestBlockingPermission } from './appBlocking';
import { isNfcEnabled, openNfcSettings } from './nfc';
import { checkNotificationPermissions, requestNotificationPermissions } from './scheduler';

export type IconName = keyof typeof Ionicons.glyphMap;

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  /** Required steps block "Continue" until granted (or explicitly bypassed). Optional steps show a Skip link. */
  required: boolean;
  ctaLabel: string;
  /** Read-only — does not prompt. Used to render current status and to fast-path already-set-up devices. */
  check: () => Promise<boolean>;
  /** Triggers the system permission dialog or opens the relevant Settings page. */
  request: () => Promise<void>;
}

const ALL_STEPS: OnboardingStep[] = [
  {
    id: 'notifications',
    title: 'Turn on notifications',
    description:
      'Momentum needs notification access so your alarm can reach you and your Lock In session can stay visible.',
    icon: 'notifications-outline',
    required: true,
    ctaLabel: 'Enable notifications',
    check: checkNotificationPermissions,
    request: async () => {
      await requestNotificationPermissions();
    },
  },
  {
    id: 'fullScreenIntent',
    title: 'Allow full-screen alerts',
    description:
      'Without this, your alarm rings as a flat notification instead of taking over the screen. Turn on "Full screen notifications" for Momentum.',
    icon: 'expand-outline',
    required: true,
    ctaLabel: 'Open settings',
    check: canUseFullScreenIntent,
    request: async () => {
      await openFullScreenIntentSettings();
    },
  },
  {
    id: 'exactAlarms',
    title: 'Allow exact alarms',
    description:
      'Turn on "Alarms & reminders" for Momentum so your alarm fires at the exact time you set — not whenever the system gets around to it.',
    icon: 'alarm-outline',
    required: true,
    ctaLabel: 'Open settings',
    check: canScheduleExactAlarms,
    request: async () => {
      await openExactAlarmSettings();
    },
  },
  {
    id: 'accessibility',
    title: 'Enable Accessibility access',
    description:
      'This is what makes Lock In and post-alarm blocking actually work. Find "Momentum App Blocking" in Accessibility settings and turn it on.',
    icon: 'lock-closed-outline',
    required: true,
    ctaLabel: 'Open settings',
    check: isBlockingPermissionGranted,
    request: requestBlockingPermission,
  },
  {
    id: 'nfc',
    title: 'Turn on NFC',
    description:
      "You'll dismiss alarms and end Lock In sessions by tapping your Momentum tag. Make sure your phone's NFC radio is switched on.",
    icon: 'hardware-chip-outline',
    required: true,
    ctaLabel: 'Open settings',
    check: isNfcEnabled,
    request: openNfcSettings,
  },
  {
    id: 'batteryOptimization',
    title: 'Skip battery optimization',
    description:
      'Recommended, not required. Some phones aggressively kill background apps, which can stop alarms and blocking from surviving in the background.',
    icon: 'battery-charging-outline',
    required: false,
    ctaLabel: 'Open settings',
    check: isIgnoringBatteryOptimizations,
    request: async () => {
      await requestIgnoreBatteryOptimizations();
    },
  },
];

/**
 * iOS currently only supports the notification-permission step (Phase A
 * alarm fallback). Full-screen intent, exact alarms, Accessibility-based
 * blocking, and NFC-enabled are Android-specific mechanisms — Phase 5B
 * (Screen Time blocking) isn't built yet, so there's nothing real to onboard
 * toward on iOS beyond notifications.
 */
export function getOnboardingSteps(): OnboardingStep[] {
  if (Platform.OS === 'android') return ALL_STEPS;
  return ALL_STEPS.filter((s) => s.id === 'notifications');
}
