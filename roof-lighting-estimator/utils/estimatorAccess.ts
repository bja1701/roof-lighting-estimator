import type { Profile } from '../hooks/useProfile';

/** Free tier users who have saved 5 estimates cannot use the estimator (map, pricing, saves). */
export function isFreeTierEstimatorExhausted(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return profile.subscription_tier === 'free' && (profile.estimates_used ?? 0) >= 5;
}
