import React, { useEffect } from 'react';
import { useProfile } from '../hooks/useProfile';
import { useUpgradeModal } from '../hooks/useUpgradeModal';
import { isFreeTierEstimatorExhausted } from '../utils/estimatorAccess';
import EstimatorPage from '../pages/EstimatorPage';

export default function EstimatorRouteGuard() {
  const { profile, loading } = useProfile();
  const { open } = useUpgradeModal();
  const exhausted = isFreeTierEstimatorExhausted(profile);

  useEffect(() => {
    if (!loading && exhausted) {
      open();
    }
  }, [loading, exhausted]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-container border-t-transparent" />
      </div>
    );
  }

  return <EstimatorPage />;
}
