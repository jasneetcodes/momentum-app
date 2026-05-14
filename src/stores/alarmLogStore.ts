import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  dismissAlarmViaEmergency,
  dismissAlarmViaNfc,
  markBlockComplete,
  triggerAlarm,
  type AlarmLog,
  type DismissError,
} from '../services/alarm';
import type { Alarm } from './alarmStore';

const ACTIVE_ALARM_KEY = '@momentum/activeAlarmId';

interface AlarmLogState {
  activeLog: AlarmLog | null;
  /** Set the instant an alarm fires (set from the Notifee background handler).
   * Cleared when the user successfully dismisses (NFC or emergency).
   * Persisted so it survives JS bundle teardown / cold launches. */
  activeAlarmId: string | null;
  setActiveAlarmId: (id: string | null) => Promise<void>;
  loadActiveAlarmId: () => Promise<string | null>;
  fire: (alarmId: string) => Promise<AlarmLog | null>;
  dismissNfc: (alarm: Alarm, uid: string) => Promise<DismissError | null>;
  dismissEmergency: (alarm: Alarm) => Promise<DismissError | null>;
  completeBlock: () => Promise<void>;
  clear: () => void;
}

export const useAlarmLogStore = create<AlarmLogState>((set, get) => ({
  activeLog: null,
  activeAlarmId: null,

  setActiveAlarmId: async (id) => {
    set({ activeAlarmId: id });
    try {
      if (id) await AsyncStorage.setItem(ACTIVE_ALARM_KEY, id);
      else await AsyncStorage.removeItem(ACTIVE_ALARM_KEY);
    } catch {}
  },

  loadActiveAlarmId: async () => {
    try {
      const id = await AsyncStorage.getItem(ACTIVE_ALARM_KEY);
      set({ activeAlarmId: id });
      return id;
    } catch {
      return null;
    }
  },

  fire: async (alarmId) => {
    const log = await triggerAlarm(alarmId);
    if (log) set({ activeLog: log });
    return log;
  },

  dismissNfc: async (alarm, uid) => {
    const log = get().activeLog;
    if (!log) return 'no_active_log';
    const { log: updated, error } = await dismissAlarmViaNfc(log.id, alarm, uid);
    if (updated) {
      set({ activeLog: updated });
      await get().setActiveAlarmId(null);
    }
    return error;
  },

  dismissEmergency: async (alarm) => {
    const log = get().activeLog;
    if (!log) return 'no_active_log';
    const { log: updated, error } = await dismissAlarmViaEmergency(log.id, alarm);
    if (updated) {
      set({ activeLog: updated });
      await get().setActiveAlarmId(null);
    }
    return error;
  },

  completeBlock: async () => {
    const log = get().activeLog;
    if (!log) return;
    await markBlockComplete(log.id);
    set({ activeLog: null });
  },

  clear: () => set({ activeLog: null, activeAlarmId: null }),
}));
