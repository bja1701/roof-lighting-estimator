import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import AuthPage from './pages/AuthPage';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';
import EstimatorRouteGuard from './components/EstimatorRouteGuard';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import WelcomeModal from './components/WelcomeModal';
import UpgradeModal from './components/UpgradeModal';
import FeedbackButton from './components/FeedbackButton';

function AppRoutes() {
  const { session, loading: authLoading, init } = useAuth();
  const { profile, fetchProfile, loading: profileLoading } = useProfile();
  const [showWelcome, setShowWelcome] = useState(false);
  const [authDone, setAuthDone] = useState(false);

  useEffect(() => {
    init().then(() => setAuthDone(true));
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchProfile(session.user.id);
    }
  }, [session?.user?.id]);

  // Show welcome modal when profile loads and welcome_shown is false
  useEffect(() => {
    if (profile && !profile.welcome_shown) {
      setShowWelcome(true);
    }
  }, [profile?.id]);

  if (!authDone || authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <AuthPage
        onSuccess={() => {}}
        onNewUser={() => setShowWelcome(true)}
      />
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<JobsPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/estimator" element={<EstimatorRouteGuard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
      <FeedbackButton />
      <UpgradeModal />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
