import React from 'react';
import { Navigate } from 'react-router-dom';
import { useProfile } from '../hooks/useProfile';
import { isFreeTierEstimatorExhausted } from '../utils/estimatorAccess';
import EstimatorPage from '../pages/EstimatorPage';

export default function EstimatorRouteGuard() {
  const { profile, loading } = useProfile();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-container border-t-transparent" />
      </div>
    );
  }

  if (isFreeTierEstimatorExhausted(profile)) {
    return <Navigate to="/" replace state={{ reason: 'estimate_limit' }} />;
  }

  return <EstimatorPage />;
}
