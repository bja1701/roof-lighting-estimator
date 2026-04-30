import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Briefcase, Users, Ruler, Settings, Shield, LogOut, Lock, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { useUpgradeModal } from '../hooks/useUpgradeModal';
import { isFreeTierEstimatorExhausted, hasProAccess } from '../utils/estimatorAccess';

interface Props {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: 'Dashboard', Icon: Briefcase, path: '/' },
  { label: 'Clients',   Icon: Users,     path: '/clients' },
  { label: 'Estimator', Icon: Ruler,     path: '/estimator' },
  { label: 'Settings',  Icon: Settings,  path: '/settings' },
];

export default function SharedLayout({ children }: Props) {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { signOut }      = useAuth();
  const { profile }      = useProfile();
  const { open: openUpgrade } = useUpgradeModal();
  const estimatorLocked  = isFreeTierEstimatorExhausted(profile);
  const isPro            = hasProAccess(profile);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)', color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }}>

      {/* ── Header ── fixed, full-width ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 sm:px-6"
        style={{ background: '#fff', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--color-primary)' }}
          >
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 2L1 9l2 1.5V20h18V10.5L23 9 12 2zm0 2.5L20 10v8H4v-8l8-5.5z" />
              <rect x="9" y="14" width="6" height="6" rx="0.5" />
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em' }}>
            <span style={{ color: 'var(--color-primary)' }}>Eave</span><span style={{ color: 'var(--color-accent)' }}>HQ</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {profile?.role === 'admin' && (
            <button
              onClick={() => navigate('/admin')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all"
              style={isActive('/admin')
                ? { background: 'var(--color-primary)', color: '#fff' }
                : { color: 'var(--color-slate)' }
              }
            >
              <Shield size={14} />
              Admin
            </button>
          )}
          {profile && (
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white"
                style={{ background: 'var(--color-primary)', fontSize: '10px', fontWeight: 700 }}
              >
                {(profile.full_name ?? profile.email ?? '?')[0].toUpperCase()}
              </div>
              <span className="text-sm font-medium max-w-[140px] truncate" style={{ color: 'var(--color-ink)' }}>
                {profile.full_name ?? profile.email ?? 'Account'}
              </span>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--color-slate)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-slate)')}
          >
            <LogOut size={16} />
            <span className="hidden sm:block">Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── Sidebar ── desktop only ── */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-56 pt-14 z-40"
        style={{ background: 'var(--color-primary-dark)' }}
      >
        <nav className="flex-1 px-3 pt-4 space-y-0.5">
          {NAV_ITEMS.map(({ label, Icon, path }) => {
            const locked = path === '/estimator' && estimatorLocked;
            const active = isActive(path);
            return (
              <button
                key={path}
                type="button"
                disabled={locked}
                title={locked ? 'Free estimate limit reached (5/5). Upgrade to continue.' : undefined}
                onClick={() => { if (!locked) navigate(path); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all group"
                style={
                  active  ? { background: 'var(--color-accent)', color: 'var(--color-ink)' }
                  : locked ? { color: 'rgba(255,255,255,0.25)', cursor: 'not-allowed' }
                           : { color: 'rgba(255,255,255,0.65)' }
                }
                onMouseEnter={e => { if (!active && !locked) e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { if (!active && !locked) e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{label}</span>
                {locked && <Lock size={13} className="ml-auto opacity-40" />}
              </button>
            );
          })}
        </nav>

        {/* Plan status widget */}
        {profile && (
          <div className="px-3 pb-5 pt-3 mt-auto">
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {isPro ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Zap size={13} style={{ color: 'var(--color-accent)' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>
                      Pro Plan
                    </span>
                  </div>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {profile.subscription_status === 'canceling' ? 'Cancels at period end' : 'Unlimited estimates · Active'}
                  </p>
                  <button
                    onClick={() => navigate('/settings')}
                    className="mt-2 w-full text-center text-[10px] font-semibold transition-colors"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
                  >
                    Manage plan →
                  </button>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      Free Tier
                    </span>
                    <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.65)' }}>
                      {profile.estimates_used ?? 0} / 5
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ((profile.estimates_used ?? 0) / 5) * 100)}%`,
                        background: 'var(--color-accent)',
                      }}
                    />
                  </div>
                  <button
                    onClick={openUpgrade}
                    className="mt-2.5 w-full text-center text-[10px] font-bold uppercase tracking-wider transition-opacity"
                    style={{ color: 'var(--color-accent)' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    Upgrade →
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 h-16 flex items-center justify-around px-2"
        style={{ background: '#fff', borderTop: '1px solid var(--color-border)' }}
      >
        {NAV_ITEMS.map(({ label, Icon, path }) => {
          const locked = path === '/estimator' && estimatorLocked;
          const active = isActive(path);
          return (
            <button
              key={path}
              type="button"
              onClick={() => locked ? openUpgrade() : navigate(path)}
              className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors min-w-[56px]"
              style={{ color: active ? 'var(--color-primary)' : 'var(--color-slate)' }}
            >
              <div className="relative">
                <Icon size={22} />
                {locked && (
                  <Lock size={10} className="absolute -top-0.5 -right-1.5" style={{ color: 'var(--color-slate)' }} />
                )}
              </div>
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          );
        })}
        {profile?.role === 'admin' && (
          <button
            onClick={() => navigate('/admin')}
            className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors min-w-[56px]"
            style={{ color: isActive('/admin') ? 'var(--color-primary)' : 'var(--color-slate)' }}
          >
            <Shield size={22} />
            <span className="text-[10px] font-semibold">Admin</span>
          </button>
        )}
      </nav>

      {/* ── Main content ── */}
      <main className="lg:ml-56 pt-14 pb-16 lg:pb-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
