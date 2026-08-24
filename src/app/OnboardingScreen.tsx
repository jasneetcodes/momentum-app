import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Text } from '../components/Text';
import { useThemeColors } from '../hooks/useThemeColors';
import { getOnboardingSteps, type OnboardingStep } from '../services/onboarding';
import { useOnboardingStore } from '../stores/onboardingStore';

/**
 * First-run gate between login/signup and the main app. Walks the user
 * through every OS-level permission alarms + blocking depend on, one step
 * at a time. Runs once per install — see onboardingStore for why it's
 * device-local rather than account-level.
 */
export default function OnboardingScreen() {
  const { barStyle, accent, muted } = useThemeColors();
  const complete = useOnboardingStore((s) => s.complete);

  const steps = useRef<OnboardingStep[]>(getOnboardingSteps()).current;
  const [booting, setBooting] = useState(true);
  const [index, setIndex] = useState(0);
  const [granted, setGranted] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  const step = steps[index];

  const checkCurrent = useCallback(async () => {
    try {
      setGranted(await step.check());
    } catch {
      setGranted(false);
    }
  }, [step]);

  // Fast path: if every required step is already granted (e.g. a dev device
  // set up manually before this flow existed), skip onboarding entirely
  // instead of making the user click through steps that are already done.
  useEffect(() => {
    (async () => {
      const results = await Promise.all(steps.map((s) => s.check().catch(() => false)));
      const allRequiredGranted = steps.every((s, i) => !s.required || results[i]);
      if (allRequiredGranted) {
        await complete();
        return;
      }
      setGranted(results[0]);
      setBooting(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (booting) return;
    setAttempted(false);
    checkCurrent();
  }, [booting, index, checkCurrent]);

  // Re-check when the user comes back from Settings.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !booting) checkCurrent();
    });
    return () => sub.remove();
  }, [booting, checkCurrent]);

  const goNext = useCallback(async () => {
    if (index + 1 < steps.length) {
      setIndex((i) => i + 1);
    } else {
      await complete();
    }
  }, [index, steps.length, complete]);

  const handlePrimaryPress = async () => {
    if (granted) {
      await goNext();
      return;
    }
    setBusy(true);
    try {
      await step.request();
      setAttempted(true);
      await checkCurrent();
    } finally {
      setBusy(false);
    }
  };

  if (booting) {
    return (
      <View className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <ActivityIndicator color={accent} size="large" />
      </View>
    );
  }

  const canBypass = attempted && step.required;
  const canSkip = !step.required;

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <StatusBar barStyle={barStyle} />

      <View className="flex-row gap-2 px-8 pt-4">
        {steps.map((s, i) => (
          <View
            key={s.id}
            className="flex-1 h-1 rounded-full"
            style={{ backgroundColor: i <= index ? accent : muted + '30' }}
          />
        ))}
      </View>

      <View className="flex-1 items-center justify-center px-8">
        <View
          className="w-24 h-24 rounded-full items-center justify-center mb-8"
          style={{ backgroundColor: accent + '1A' }}
        >
          <Ionicons name={step.icon} size={44} color={accent} />
        </View>

        <Text variant="heading" className="text-2xl text-center">
          {step.title}
        </Text>
        <Text variant="muted" className="text-base mt-3 text-center leading-6">
          {step.description}
        </Text>

        <View className="flex-row items-center gap-2 mt-6">
          <View
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: granted ? accent : muted }}
          />
          <Text variant="muted" className="text-xs">
            {granted ? 'Enabled' : 'Not enabled yet'}
          </Text>
        </View>
      </View>

      <View className="px-8 pb-8 gap-3">
        <Button
          label={granted ? 'Continue' : step.ctaLabel}
          fullWidth
          loading={busy}
          onPress={handlePrimaryPress}
        />
        {!granted && (canSkip || canBypass) && (
          <Button
            label={canSkip ? 'Skip for now' : "Continue without this — I'll do it later"}
            variant="ghost"
            fullWidth
            onPress={goNext}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
