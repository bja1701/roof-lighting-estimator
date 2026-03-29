import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'nexusflow_trial_email';
const MAX_FREE_ESTIMATES = 5;

interface TrialState {
  email: string | null;
  estimatesUsed: number;
  isLoading: boolean;
  isGated: boolean; // true = email gate is showing
  lastAddress: string | null;

  loadSession: () => Promise<void>;
  submitEmail: (email: string) => Promise<void>;
  useEstimate: (address: string) => Promise<void>;
}

export const useTrialStore = create<TrialState>((set, get) => ({
  email: null,
  estimatesUsed: 0,
  isLoading: true,
  isGated: false,
  lastAddress: null,

  loadSession: async () => {
    const savedEmail = localStorage.getItem(STORAGE_KEY);

    if (!savedEmail) {
      set({ isLoading: false, isGated: true });
      return;
    }

    // Fetch current count from Supabase (source of truth on load)
    try {
      const { data, error } = await supabase
        .from('trial_users')
        .select('estimates_used')
        .eq('email', savedEmail)
        .single();

      if (error || !data) {
        // Row missing (e.g., DB was reset) — show gate again
        localStorage.removeItem(STORAGE_KEY);
        set({ isLoading: false, isGated: true });
        return;
      }

      set({
        email: savedEmail,
        estimatesUsed: data.estimates_used,
        isLoading: false,
        isGated: false,
      });
    } catch {
      // Network error — use localStorage cache, allow access
      set({ email: savedEmail, estimatesUsed: 0, isLoading: false, isGated: false });
    }
  },

  submitEmail: async (email: string) => {
    set({ isLoading: true });

    try {
      const { data, error } = await supabase
        .from('trial_users')
        .upsert({ email, last_used_at: new Date().toISOString() }, { onConflict: 'email' })
        .select('estimates_used')
        .single();

      if (error) throw error;

      localStorage.setItem(STORAGE_KEY, email);
      set({
        email,
        estimatesUsed: data?.estimates_used ?? 0,
        isLoading: false,
        isGated: false,
      });
    } catch (err) {
      console.error('[TrialGate] Error submitting email:', err);
      // Optimistic fallback — let them in, log locally
      localStorage.setItem(STORAGE_KEY, email);
      set({ email, estimatesUsed: 0, isLoading: false, isGated: false });
    }
  },

  useEstimate: async (address: string) => {
    const { email, estimatesUsed, lastAddress } = get();

    if (!email) return;
    // Don't count the same address twice in a row
    if (address === lastAddress) return;
    // Already at limit
    if (estimatesUsed >= MAX_FREE_ESTIMATES) return;

    const newCount = estimatesUsed + 1;
    set({ estimatesUsed: newCount, lastAddress: address });

    try {
      await supabase
        .from('trial_users')
        .update({ estimates_used: newCount, last_used_at: new Date().toISOString() })
        .eq('email', email);
    } catch (err) {
      console.error('[TrialGate] Error incrementing estimate count:', err);
    }
  },
}));

export const MAX_ESTIMATES = MAX_FREE_ESTIMATES;
