import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'nexusflow_trial_email';
const STORAGE_COUNT_KEY = 'nexusflow_trial_count';
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

    // Use cached count immediately so the app shows without waiting on Supabase
    const cachedCount = parseInt(localStorage.getItem(STORAGE_COUNT_KEY) ?? '0', 10);
    set({ email: savedEmail, estimatesUsed: cachedCount, isLoading: false, isGated: false });

    // Sync with Supabase in the background to get the authoritative count
    try {
      const { data, error } = await supabase
        .from('trial_users')
        .select('estimates_used')
        .eq('email', savedEmail)
        .single();

      if (error) {
        // Supabase unavailable or table missing — keep the cached count, stay ungated
        return;
      }

      if (!data) {
        // Email not in DB (e.g. DB was reset) — clear and re-gate
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_COUNT_KEY);
        set({ email: null, estimatesUsed: 0, isGated: true });
        return;
      }

      // Sync authoritative count from Supabase
      localStorage.setItem(STORAGE_COUNT_KEY, String(data.estimates_used));
      set({ estimatesUsed: data.estimates_used });
    } catch {
      // Network error — cached count is fine, stay ungated
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

      const count = data?.estimates_used ?? 0;
      localStorage.setItem(STORAGE_KEY, email);
      localStorage.setItem(STORAGE_COUNT_KEY, String(count));
      set({ email, estimatesUsed: count, isLoading: false, isGated: false });
    } catch (err) {
      console.error('[TrialGate] Error submitting email:', err);
      // Optimistic fallback — let them in, log locally
      localStorage.setItem(STORAGE_KEY, email);
      localStorage.setItem(STORAGE_COUNT_KEY, '0');
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
    localStorage.setItem(STORAGE_COUNT_KEY, String(newCount));
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
