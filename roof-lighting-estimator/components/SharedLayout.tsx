import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { useUpgradeModal } from '../hooks/useUpgradeModal';
import { isFreeTierEstimatorExhausted } from '../utils/estimatorAccess';

interface Props {
  children: React.ReactNode;
}

// SVG icons — no font loading dependency
const Icons = {
  jobs: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  estimator: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  admin: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  signOut: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  ),
};

const navItems = [
  { label: 'Jobs', icon: Icons.jobs, path: '/' },
  { label: 'Estimator', icon: Icons.estimator, path: '/estimator' },
  { label: 'Settings', icon: Icons.settings, path: '/settings' },
];

export default function SharedLayout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const { open: openUpgrade } = useUpgradeModal();
  const estimatorLocked = isFreeTierEstimatorExhausted(profile);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">

      {/* ── Top Nav ── fixed, full-width, z-50 ── */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 sm:px-6 gap-4">
        <div className="flex items-center gap-3 min-w-0 text-on-surface">
          <div className="w-9 h-9 amber-gradient rounded-lg shadow-md flex items-center justify-center flex-shrink-0">
            <svg className="w-[18px] h-[18px] text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 2L1 9l2 1.5V20h18V10.5L23 9 12 2zm0 2.5L20 10v8H4v-8l8-5.5z" />
              <rect x="9" y="14" width="6" height="6" rx="0.5" />
            </svg>
          </div>
          <span className="font-headline font-extrabold text-on-surface tracking-tight text-base sm:text-[1.0625rem] leading-none truncate">
            EaveHQ
          </span>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          {profile?.role === 'admin' && (
            <button
              onClick={() => navigate('/admin')}
              className={`hidden sm:flex items-center gap-1.5 text-[11px] font-label font-bold uppercase tracking-wider transition-colors px-2 py-1 rounded ${
                isActive('/admin')
                  ? 'text-primary bg-primary-container/10'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {Icons.admin}
              Admin
            </button>
          )}
          {/* User name/email pill */}
          {profile && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low">
              <div className="w-6 h-6 rounded-full amber-gradient flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[10px] font-bold">
                  {(profile.full_name ?? profile.email ?? '?')[0].toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium text-on-surface max-w-[140px] truncate">
                {profile.full_name ?? profile.email ?? 'Account'}
              </span>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all"
          >
            {Icons.signOut}
            <span className="text-sm font-medium hidden sm:block">Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── Sidebar ── fixed, left edge, desktop only ── */}
      {/* pt-16 matches h-16 header so nav starts immediately below it */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-slate-50 border-r border-slate-200/60 pt-16 z-40">
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(item => {
            const locked = item.path === '/estimator' && estimatorLocked;
            return (
              <button
                key={item.path}
                type="button"
                disabled={locked}
                title={
                  locked
                    ? 'Free estimate limit reached (5/5). Upgrade to use the estimator.'
                    : undefined
                }
                onClick={() => {
                  if (locked) return;
                  navigate(item.path);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150 text-left group ${
                  locked
                    ? 'cursor-not-allowed text-on-surface-variant/45 opacity-60'
                    : isActive(item.path)
                      ? 'bg-white shadow-sm text-primary font-semibold'
                      : 'text-on-surface-variant hover:bg-white/70 hover:text-on-surface'
                }`}
              >
                <span
                  className={
                    locked
                      ? 'text-on-surface-variant/40'
                      : isActive(item.path)
                        ? 'text-primary'
                        : 'text-on-surface-variant group-hover:text-on-surface'
                  }
                >
                  {item.icon}
                </span>
                <span className="font-medium text-sm">{item.label}</span>
                {locked && (
                  <span className="material-symbols-outlined ml-auto text-base text-on-surface-variant/50" aria-hidden>
                    lock
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: plan status */}
        {profile && (
          <div className="px-4 pb-6 pt-4 border-t border-slate-200/60 mt-auto">
            {profile.subscription_status === 'active' ? (
              <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg,#1e2d45,#0f1729)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-amber-400 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                  <span className="text-[10px] font-label uppercase tracking-wider text-amber-400 font-bold">Pro Plan</span>
                </div>
                <p className="text-[10px] text-slate-400">Unlimited estimates · Active</p>
                <button
                  onClick={() => navigate('/settings')}
                  className="mt-2 w-full text-center text-[10px] font-bold text-slate-500 hover:text-slate-400 transition-colors"
                >
                  Manage plan →
                </button>
              </div>
            ) : (
              <div className="bg-surface-container rounded-xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-label uppercase tracking-wider text-secondary font-bold">Free Tier</span>
                  <span className="text-xs font-bold text-on-surface">{profile.estimates_used ?? 0} / 5</span>
                </div>
                <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                  <div
                    className="amber-gradient h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((profile.estimates_used ?? 0) / 5) * 100)}%` }}
                  />
                </div>
                <button
                  onClick={openUpgrade}
                  className="mt-3 w-full text-center text-[10px] font-bold text-amber-500 hover:text-amber-400 transition-colors uppercase tracking-wider"
                >
                  Upgrade →
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ── Main content ── pt-16 clears the fixed header ── */}
      <main className="lg:ml-64 pt-16 min-h-screen">
        {children}
      </main>
    </div>
  );
}
