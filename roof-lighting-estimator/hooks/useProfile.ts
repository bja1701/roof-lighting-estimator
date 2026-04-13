import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { ensureProfileRowExists } from '../utils/ensureProfile';

export interface Profile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  brand_color: string;
  price_per_foot: number;
  controller_fee: number;
  include_controller: boolean;
  subscription_tier: 'free' | 'retainer' | 'paid';
  subscription_status: 'free' | 'active' | 'canceled';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  estimates_used: number;
  welcome_shown: boolean;
  role: 'user' | 'admin';
}

interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  incrementEstimates: () => Promise<void>;
  markWelcomeShown: () => Promise<void>;
}

export const useProfile = create<ProfileState>((set, get) => ({
  profile: null,
  loading: true,

  fetchProfile: async (userId) => {
    set({ loading: true });
    let { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      const { data: sessionData } = await supabase.auth.getSession();
      const u = sessionData.session?.user;
      if (u?.id === userId) {
        const ensured = await ensureProfileRowExists(u);
        if (ensured.ok) {
          const retry = await supabase.from('profiles').select('*').eq('id', userId).single();
          data = retry.data;
          error = retry.error;
        }
      }
    }

    if (!error && data) {
      set({ profile: data as Profile, loading: false });
    } else {
      set({ profile: null, loading: false });
    }
  },

  updateProfile: async (updates) => {
    const { profile } = get();
    if (!profile) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id);

    if (!error) {
      set({ profile: { ...profile, ...updates } });
    }
    return { error: error?.message ?? null };
  },

  incrementEstimates: async () => {
    const { profile, updateProfile } = get();
    if (!profile) return;
    await updateProfile({ estimates_used: profile.estimates_used + 1 });
  },

  markWelcomeShown: async () => {
    const { updateProfile } = get();
    await updateProfile({ welcome_shown: true });
  },
}));
