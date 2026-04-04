import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';

interface Props {
  children: React.ReactNode;
}

const navItems = [
  { label: 'Jobs', icon: 'work', path: '/' },
  { label: 'Estimator', icon: 'calculate', path: '/estimator' },
  { label: 'Settings', icon: 'settings', path: '/settings' },
];

export default function SharedLayout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { profile } = useProfile();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* Top Nav */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6 md:pl-72">
        <div className="flex items-center gap-2 md:hidden">
          <span className="material-symbols-outlined text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>roofing</span>
          <span className="font-headline font-extrabold text-on-surface tracking-tight">Roof Estimator</span>
        </div>
        <div className="hidden md:block" />
        <div className="flex items-center gap-4">
          {profile?.role === 'admin' && (
            <button
              onClick={() => navigate('/admin')}
              className={`text-[11px] font-label font-bold uppercase tracking-wider transition-colors ${isActive('/admin') ? 'text-primary border-b-2 border-primary-container pb-0.5' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Admin
            </button>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-container-low transition-all cursor-pointer" onClick={signOut}>
            <span className="material-symbols-outlined text-on-surface-variant text-xl">account_circle</span>
            <span className="text-sm font-medium text-on-surface-variant hidden sm:block">Sign Out</span>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-slate-50 border-r border-slate-200/50 pt-5 z-40">
        {/* Brand */}
        <div className="px-6 mb-8">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 amber-gradient rounded-lg shadow-md flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-base" style={{ fontVariationSettings: "'FILL' 1" }}>architecture</span>
            </div>
            <span className="font-headline font-extrabold text-on-surface tracking-tight">Roof Estimator</span>
          </div>
          <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant pl-10">
            {profile?.subscription_tier === 'free' ? 'Free Plan' : profile?.subscription_tier === 'retainer' ? 'Retainer' : 'Pro Plan'}
          </p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150 text-left ${
                isActive(item.path)
                  ? 'bg-white shadow-sm text-primary font-semibold translate-x-0.5'
                  : 'text-on-surface-variant hover:bg-white/60 hover:translate-x-0.5'
              }`}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom CTA */}
        <div className="px-4 pb-6 space-y-3">
          {profile?.subscription_tier === 'free' && (
            <div className="bg-surface-container rounded-xl p-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-label uppercase tracking-wider text-secondary">Usage</span>
                <span className="text-xs font-bold text-on-surface">{profile.estimates_used ?? 0} / 5</span>
              </div>
              <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                <div
                  className="amber-gradient h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((profile.estimates_used ?? 0) / 5) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <button
            onClick={() => navigate('/estimator')}
            className="w-full amber-gradient text-white font-headline font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            New Estimate
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 pt-16 min-h-screen">
        {children}
      </main>
    </div>
  );
}
