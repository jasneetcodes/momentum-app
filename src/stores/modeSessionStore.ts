import { create } from 'zustand';
import {
  activateModeSession,
  deactivateModeSessionViaEmergency,
  deactivateModeSessionViaNfc,
  findActiveSession,
  totalMinutesToday as totalMinutesTodayRemote,
  type DeactivateError,
  type ModeSession,
} from '../services/mode';
import { emergencyUnblocksUsedThisMonth } from '../services/emergencyUnblocks';
import type { Mode } from './modeStore';

interface ModeSessionState {
  activeSession: ModeSession | null;
  loading: boolean;
  /** Find any open session left from a prior run (FGS may have kept blocking
   * alive on Android while the JS bundle was dead). Called once on app launch. */
  hydrate: () => Promise<void>;
  activate: (mode: Mode, via: 'nfc' | 'button') => Promise<string | null>;
  deactivateNfc: (uid: string) => Promise<DeactivateError | null>;
  deactivateEmergency: () => Promise<DeactivateError | null>;
  totalMinutesToday: () => Promise<number>;
  emergencyUnblocksUsedThisMonth: () => Promise<number>;
  reset: () => void;
}

export const useModeSessionStore = create<ModeSessionState>((set, get) => ({
  activeSession: null,
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    const session = await findActiveSession();
    set({ activeSession: session, loading: false });
  },

  activate: async (mode, via) => {
    if (get().activeSession) return 'already_active';
    const session = await activateModeSession(mode.id, via);
    if (!session) return 'unknown';
    set({ activeSession: session });
    return null;
  },

  deactivateNfc: async (uid) => {
    const current = get().activeSession;
    if (!current) return 'no_active_session';
    const { session, error } = await deactivateModeSessionViaNfc(current.id, uid);
    if (session) set({ activeSession: null });
    return error;
  },

  deactivateEmergency: async () => {
    const current = get().activeSession;
    if (!current) return 'no_active_session';
    const { session, error } = await deactivateModeSessionViaEmergency(current.id);
    if (session) set({ activeSession: null });
    return error;
  },

  totalMinutesToday: () => totalMinutesTodayRemote(),
  emergencyUnblocksUsedThisMonth: () => emergencyUnblocksUsedThisMonth(),

  reset: () => set({ activeSession: null, loading: false }),
}));
