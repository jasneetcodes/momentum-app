import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { useAlarmLogStore } from './alarmLogStore';
import { useAlarmStore } from './alarmStore';
import { useNfcStore } from './nfcStore';

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  emergency_unblocks_limit: number;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  /**
   * True while a password-recovery session (from a "forgot password" email
   * link) is active. Not persisted — a fresh launch with no pending deep
   * link should never start in recovery mode. Set directly from parsing
   * the recovery URL, not from onAuthStateChange: the implicit-flow tokens
   * this app's Supabase client uses arrive via a plain setSession() call,
   * which emits a generic SIGNED_IN event — Supabase only emits a real
   * PASSWORD_RECOVERY event from verifyOtp()/PKCE, neither of which this
   * flow uses.
   */
  recoveryMode: boolean;
  setRecoveryMode: (v: boolean) => void;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (email: string, password: string, name: string) => Promise<string | null>;
  logout: () => Promise<void>;
  initialize: () => () => void;
  fetchProfile: (userId: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  updateUserPassword: (newPassword: string) => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  loading: false,
  initialized: false,
  recoveryMode: false,

  setRecoveryMode: (v) => set({ recoveryMode: v }),

  fetchProfile: async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) set({ profile: data as Profile });
  },

  login: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false });
    if (error) return error.message;
    set({ user: data.user, session: data.session });
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      if (profile) set({ profile: profile as Profile });
    }
    return null;
  },

  signup: async (email, password, name) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    set({ loading: false });
    if (error) return error.message;
    set({ user: data.user, session: data.session });
    return null;
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null, recoveryMode: false });
    useNfcStore.getState().reset();
    useAlarmStore.getState().reset();
    useAlarmLogStore.getState().clear();
  },

  requestPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'momentum://reset-password',
    });
    return error ? error.message : null;
  },

  updateUserPassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error ? error.message : null;
  },

  initialize: () => {
    supabase.auth.getSession().then(async ({ data }) => {
      set({
        user: data.session?.user ?? null,
        session: data.session,
        initialized: true,
      });
      if (data.session?.user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();
        if (profile) set({ profile: profile as Profile });
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, session });
    });

    return () => listener.subscription.unsubscribe();
  },
}));
