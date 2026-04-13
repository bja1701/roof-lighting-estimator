import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';

interface Props {
  onSuccess: () => void;
  onNewUser: () => void;
}

export default function AuthPage({ onSuccess, onNewUser }: Props) {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [mode, setMode] = useState<'auth' | 'forgot' | 'forgot-sent'>('auth');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    setMode('forgot-sent');
  };

  const { signIn, signUp } = useAuth();
  const { fetchProfile } = useProfile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (tab === 'login') {
      const { error: err } = await signIn(email, password);
      if (err) { setError(err); setSubmitting(false); return; }
      const { data } = await supabase.auth.getUser();
      if (data?.user) await fetchProfile(data.user.id);
      onSuccess();
    } else {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const { error: err } = await signUp(email, password, fullName);
      if (err) { setError(err); setSubmitting(false); return; }
      setSubmitting(false);
      setCheckEmail(true);
    }
  };

  const inputCls = 'w-full pl-10 pr-4 py-3 bg-surface-container-low border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-sm placeholder:text-outline/50 transition-all';
  const inputNoPrefixCls = 'w-full px-4 py-3 bg-surface-container-low border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-sm placeholder:text-outline/50 transition-all';
  const labelCls = 'block text-[11px] font-label font-bold uppercase tracking-wider text-on-surface-variant mb-1.5';

  // ── Forgot password: sent screen ─────────────────────────────────────────
  if (mode === 'forgot-sent') {
    return (
      <div className="fixed inset-0 bg-inverse-surface flex items-center justify-center z-50 px-4 overflow-hidden">
        <div className="w-full max-w-sm text-center relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 amber-gradient rounded-xl shadow-xl flex items-center justify-center mb-4 border border-white/10">
              <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>lock_reset</span>
            </div>
            <h1 className="font-headline font-extrabold text-3xl tracking-tight text-white mb-1">Check your email</h1>
            <p className="text-surface-variant font-label uppercase tracking-[0.2em] text-[10px]">Password Reset</p>
          </div>
          <div className="bg-surface-container-lowest rounded-xl shadow-2xl p-8">
            <p className="text-on-surface-variant text-sm mb-1">We sent a reset link to</p>
            <p className="text-on-surface font-semibold text-sm mb-4">{email}</p>
            <p className="text-on-surface-variant text-xs mb-6 leading-relaxed">
              Click the link in that email to choose a new password. Check your spam folder if you don't see it.
            </p>
            <button
              onClick={() => { setMode('auth'); setTab('login'); }}
              className="w-full py-3 bg-surface-container-low text-primary font-headline font-bold rounded-lg hover:bg-surface-container transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Forgot password: email entry screen ───────────────────────────────────
  if (mode === 'forgot') {
    return (
      <div className="fixed inset-0 bg-inverse-surface flex items-center justify-center z-50 px-4 overflow-hidden">
        <div className="relative z-10 w-full max-w-lg">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 amber-gradient rounded-xl shadow-xl flex items-center justify-center mb-4 border border-white/10">
              <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2L1 9l2 1.5V20h18V10.5L23 9 12 2zm0 2.5L20 10v8H4v-8l8-5.5z" />
                <rect x="9" y="14" width="6" height="6" rx="0.5" />
              </svg>
            </div>
            <h1 className="font-headline font-extrabold text-3xl tracking-tight text-white mb-2">Reset password</h1>
            <p className="text-surface-variant font-label uppercase tracking-[0.2em] text-[10px]">We'll send you a link</p>
          </div>
          <div className="bg-surface-container-lowest rounded-xl shadow-2xl overflow-hidden border border-white/5">
            <div className="px-8 py-8">
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className={labelCls} htmlFor="reset-email">Email Address</label>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <input id="reset-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="john@contractor.com" className={inputCls} />
                  </div>
                </div>
                {error && (
                  <div className="bg-error-container/30 border-l-4 border-error p-3 rounded-r-lg">
                    <p className="text-sm text-error font-medium">{error}</p>
                  </div>
                )}
                <button type="submit" disabled={submitting} className="w-full amber-gradient text-white font-headline font-bold py-4 rounded-lg shadow-lg disabled:opacity-60">
                  {submitting ? 'Sending…' : 'Send reset link'}
                </button>
                <button type="button" onClick={() => { setMode('auth'); setError(''); }} className="w-full text-sm text-on-surface-variant hover:text-on-surface transition-colors">
                  ← Back to Sign In
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Sign-up "check email" screen ──────────────────────────────────────────
  if (checkEmail) {
    return (
      <div className="fixed inset-0 bg-inverse-surface flex items-center justify-center z-50 px-4 overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-10 right-10 w-64 h-64 border-t border-r border-white/20"></div>
          <div className="absolute bottom-10 left-10 w-96 h-96 border-b border-l border-white/20"></div>
        </div>
        <div className="w-full max-w-sm text-center relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 amber-gradient rounded-xl shadow-xl flex items-center justify-center mb-4 border border-white/10">
              <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>mark_email_read</span>
            </div>
            <h1 className="font-headline font-extrabold text-3xl tracking-tight text-white mb-1">Check your email</h1>
            <p className="text-surface-variant font-label uppercase tracking-[0.2em] text-[10px]">Verification Required</p>
          </div>
          <div className="bg-surface-container-lowest rounded-xl shadow-2xl p-8">
            <p className="text-on-surface-variant text-sm mb-1">We sent a confirmation link to</p>
            <p className="text-on-surface font-semibold text-sm mb-4">{email}</p>
            <p className="text-on-surface-variant text-xs mb-6 leading-relaxed">
              Click the link in that email to activate your account. If this email is already registered, use Sign In or reset your password instead.
            </p>
            <button
              onClick={() => { setCheckEmail(false); setTab('login'); }}
              className="w-full py-3 bg-surface-container-low text-primary font-headline font-bold rounded-lg hover:bg-surface-container transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-inverse-surface flex items-center justify-center z-50 px-4 overflow-hidden">
      {/* Blueprint decoration lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 right-10 w-64 h-64 border-t border-r border-white/5 opacity-20 hidden md:block"></div>
        <div className="absolute bottom-10 left-10 w-96 h-96 border-b border-l border-white/5 opacity-20 hidden md:block"></div>
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* App Identity */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 amber-gradient rounded-xl shadow-xl flex items-center justify-center mb-4 border border-white/10">
            <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 2L1 9l2 1.5V20h18V10.5L23 9 12 2zm0 2.5L20 10v8H4v-8l8-5.5z" />
              <rect x="9" y="14" width="6" height="6" rx="0.5" />
            </svg>
          </div>
          <h1 className="font-headline font-extrabold text-3xl tracking-tight text-white mb-2">Roof Estimator</h1>
          <p className="text-surface-variant font-label uppercase tracking-[0.2em] text-[10px]">Precision Built for Contractors</p>
        </div>

        {/* Auth Card */}
        <div className="bg-surface-container-lowest rounded-xl shadow-2xl overflow-hidden border border-white/5">
          {/* Tab toggle */}
          <div className="flex bg-surface-container-low p-1.5 m-4 rounded-lg">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all duration-200 ${tab === 'login' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('signup'); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all duration-200 ${tab === 'signup' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          <div className="px-8 pb-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              {tab === 'signup' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>First Name</label>
                    <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Brighton" className={inputNoPrefixCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name</label>
                    <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Jones" className={inputNoPrefixCls} />
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls} htmlFor="auth-email">Email Address</label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <input id="auth-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="john@contractor.com" className={inputCls} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className={labelCls} htmlFor="auth-password">Password</label>
                  {tab === 'login' && <button type="button" onClick={() => { setMode('forgot'); setError(''); }} className="text-[11px] font-bold text-primary hover:underline">Forgot?</button>}
                </div>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <input id="auth-password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
                </div>
              </div>

              {tab === 'signup' && (
                <div className="bg-primary-container/10 border-l-4 border-primary-container p-4 rounded-r-lg">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-primary-container flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                    </svg>
                    <p className="text-xs font-semibold text-on-primary-container">Start with 5 free estimates — no credit card required</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-error-container/30 border-l-4 border-error p-3 rounded-r-lg">
                  <p className="text-sm text-error font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full amber-gradient text-white font-headline font-bold py-4 rounded-lg shadow-lg shadow-primary/20 hover:scale-[0.98] transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting
                  ? (tab === 'login' ? 'Signing in…' : 'Creating account…')
                  : (tab === 'login' ? 'Sign In' : 'Create Account')}
                {!submitting && (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                )}
              </button>

              {/* OAuth divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-outline/20" />
                <span className="text-[11px] text-on-surface-variant/50 font-label uppercase tracking-wider">or continue with</span>
                <div className="flex-1 h-px bg-outline/20" />
              </div>

              {/* OAuth buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-surface-container-low hover:bg-surface-container border border-outline/10 transition-colors text-sm font-medium text-on-surface"
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => supabase.auth.signInWithOAuth({ provider: 'azure', options: { redirectTo: window.location.origin, scopes: 'email' } })}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-surface-container-low hover:bg-surface-container border border-outline/10 transition-colors text-sm font-medium text-on-surface"
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#f25022" d="M1 1h10v10H1z"/>
                    <path fill="#00a4ef" d="M13 1h10v10H13z"/>
                    <path fill="#7fba00" d="M1 13h10v10H1z"/>
                    <path fill="#ffb900" d="M13 13h10v10H13z"/>
                  </svg>
                  Microsoft
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footnote */}
        <p className="mt-8 text-center text-surface-variant/60 text-[11px] font-medium max-w-xs mx-auto">
          By continuing, you agree to Roof Estimator's{' '}
          <a className="underline hover:text-white" href="#">Terms of Service</a> and{' '}
          <a className="underline hover:text-white" href="#">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
