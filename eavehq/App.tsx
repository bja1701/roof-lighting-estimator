import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import EstimatorRouteGuard from './components/EstimatorRouteGuard';
import FeedbackButton from './components/FeedbackButton';
import UpgradeModal from './components/UpgradeModal';
import WelcomeModal from './components/WelcomeModal';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { ToastProvider } from './hooks/useToast';
import AdminPage from './pages/AdminPage';
import AuthPage from './pages/AuthPage';
import ClientDetailPage from './pages/ClientDetailPage';
import ClientPortalFinalSuccessPage from './pages/ClientPortalFinalSuccessPage';
import ClientPortalPage from './pages/ClientPortalPage';
import ClientPortalSuccessPage from './pages/ClientPortalSuccessPage';
import ClientsPage from './pages/ClientsPage';
import DashboardPage from './pages/DashboardPage';
import FoundersPage from './pages/FoundersPage';
import InvoicePage from './pages/InvoicePage';
import JobDetailPage from './pages/JobDetailPage';
import JobsPage from './pages/JobsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SettingsPage from './pages/SettingsPage';

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

	// Public portal routes — no auth required, token is the access control
	const pathname = window.location.pathname;
	if (
		pathname.startsWith('/quote/') ||
		pathname.startsWith('/invoice/') ||
		pathname === '/founders'
	) {
		return (
			<Routes>
				<Route path="/quote/:token" element={<ClientPortalPage />} />
				<Route
					path="/quote/:token/success"
					element={<ClientPortalSuccessPage />}
				/>
				<Route
					path="/quote/:token/final-success"
					element={<ClientPortalFinalSuccessPage />}
				/>
				<Route path="/invoice/:token" element={<InvoicePage />} />
				<Route path="/founders" element={<FoundersPage />} />
			</Routes>
		);
	}

	if (!authDone || authLoading) {
		return (
			<div
				className="min-h-screen flex items-center justify-center"
				style={{ background: 'var(--color-primary-dark)' }}
			>
				<div
					className="w-6 h-6 rounded-full animate-spin"
					style={{
						border: '2px solid rgba(255,255,255,0.15)',
						borderTopColor: 'var(--color-accent)',
					}}
				/>
			</div>
		);
	}

	if (!session) {
		// Allow reset-password page without a session (Supabase sets session from URL hash)
		if (window.location.pathname === '/auth/reset-password') {
			return <ResetPasswordPage />;
		}
		return (
			<AuthPage onSuccess={() => {}} onNewUser={() => setShowWelcome(true)} />
		);
	}

	return (
		<>
			<Routes>
				<Route path="/" element={<DashboardPage />} />
				<Route path="/jobs" element={<JobsPage />} />
				<Route path="/jobs/:id" element={<JobDetailPage />} />
				<Route path="/clients" element={<ClientsPage />} />
				<Route path="/clients/:id" element={<ClientDetailPage />} />
				<Route path="/estimator" element={<EstimatorRouteGuard />} />
				<Route path="/settings" element={<SettingsPage />} />
				<Route path="/admin" element={<AdminPage />} />
				<Route path="/auth/reset-password" element={<ResetPasswordPage />} />
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
		<ToastProvider>
			<BrowserRouter>
				<AppRoutes />
			</BrowserRouter>
		</ToastProvider>
	);
}
