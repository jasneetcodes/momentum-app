import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '../services/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  initialize: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: false,
  initialized: false,

  login: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false });
    if (error) return error.message;
    set({ user: data.user, session: data.session });
    return null;
  },

  signup: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signUp({ email, password });
    set({ loading: false });
    if (error) return error.message;
    // Session is null until email is confirmed; user is set immediately.
    set({ user: data.user, session: data.session });
    return null;
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },

  // Call once at app startup. Returns the unsubscribe function.
  initialize: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({
        user: data.session?.user ?? null,
        session: data.session,
        initialized: true,
      });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, session });
    });

    return () => listener.subscription.unsubscribe();
  },
}));
