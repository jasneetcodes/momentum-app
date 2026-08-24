import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/**
 * Tracks whether the device has completed the permission-onboarding flow.
 * Deliberately device-local (not a `profiles` column) — the permissions it
 * covers are OS-level grants that don't survive a reinstall or carry over to
 * a new device, so onboarding should run again in those cases even for an
 * existing account.
 */
const COMPLETE_KEY = '@momentum/onboardingComplete';

interface OnboardingState {
  completed: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  complete: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  completed: false,
  hydrated: false,

  hydrate: async () => {
    let completed = false;
    try {
      completed = (await AsyncStorage.getItem(COMPLETE_KEY)) === 'true';
    } catch {}
    set({ completed, hydrated: true });
  },

  complete: async () => {
    set({ completed: true });
    try {
      await AsyncStorage.setItem(COMPLETE_KEY, 'true');
    } catch {}
  },
}));
