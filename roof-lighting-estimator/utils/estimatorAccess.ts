import type { Profile } from '../hooks/useProfile';

/**
 * Returns true when the user cannot start a new estimate:
 * they are not on an active paid subscription AND have used all 5 free estimates.
 */
export function isFreeTierEstimatorExhausted(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.subscription_status === 'active') return false;
  return (profile.estimates_used ?? 0) >= 5;
}
