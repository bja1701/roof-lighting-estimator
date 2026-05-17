import type { Profile } from '../hooks/useProfile';

/**
 * Returns true when the user cannot start a new estimate:
 * they are not on an active paid subscription AND have used all 5 free estimates.
 */
/** Statuses that grant full Pro access. */
const PRO_STATUSES: Profile['subscription_status'][] = ['active', 'canceling'];

/**
 * Returns true when the user cannot start a new estimate:
 * they are not on an active paid subscription AND have used all 5 free estimates.
 */
export function isFreeTierEstimatorExhausted(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (PRO_STATUSES.includes(profile.subscription_status)) return false;
  return (profile.estimates_used ?? 0) >= 5;
}

/** Returns true when the user has Pro access (active or within a canceling period). */
export function hasProAccess(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return PRO_STATUSES.includes(profile.subscription_status);
}
