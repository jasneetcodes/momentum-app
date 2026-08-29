import { create } from 'zustand';
import { getInstalledApps, type InstalledApp } from '../services/installedApps';

interface InstalledAppsState {
  apps: InstalledApp[];
  loading: boolean;
  loaded: boolean;
  fetchApps: () => Promise<void>;
}

/**
 * In-memory cache for the session — querying installed apps natively is
 * fast (tens of ms even for a few hundred apps), but there's no reason to
 * re-query every time Create Mode / Alarm Setup is opened during one app
 * session. Same shape as modeStore/nfcStore.
 */
export const useInstalledAppsStore = create<InstalledAppsState>((set, get) => ({
  apps: [],
  loading: false,
  loaded: false,

  fetchApps: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    const apps = await getInstalledApps();
    set({ apps, loading: false, loaded: true });
  },
}));
