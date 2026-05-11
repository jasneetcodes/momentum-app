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

interface AlarmLogState {
  activeLog: AlarmLog | null;
  fire: (alarmId: string) => Promise<AlarmLog | null>;
  dismissNfc: (alarm: Alarm, uid: string) => Promise<DismissError | null>;
  dismissEmergency: (alarm: Alarm) => Promise<DismissError | null>;
  completeBlock: () => Promise<void>;
  clear: () => void;
}

export const useAlarmLogStore = create<AlarmLogState>((set, get) => ({
  activeLog: null,

  fire: async (alarmId) => {
    const log = await triggerAlarm(alarmId);
    if (log) set({ activeLog: log });
    return log;
  },

  dismissNfc: async (alarm, uid) => {
    const log = get().activeLog;
    if (!log) return 'no_active_log';
    const { log: updated, error } = await dismissAlarmViaNfc(log.id, alarm, uid);
    if (updated) set({ activeLog: updated });
    return error;
  },

  dismissEmergency: async (alarm) => {
    const log = get().activeLog;
    if (!log) return 'no_active_log';
    const { log: updated, error } = await dismissAlarmViaEmergency(log.id, alarm);
    if (updated) set({ activeLog: updated });
    return error;
  },

  completeBlock: async () => {
    const log = get().activeLog;
    if (!log) return;
    await markBlockComplete(log.id);
    set({ activeLog: null });
  },

  clear: () => set({ activeLog: null }),
}));
