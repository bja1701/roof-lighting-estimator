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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

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

  if (checkEmail) {
    return (
      <div className="fixed inset-0 bg-inverse-surface flex items-center justify-center z-50 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-10 right-10 w-64 h-64 border-t border-r border-white/20"></div>
          <div className="absolute bottom-10 left-10 w-96 h-96 border-b border-l border-white/20"></div>
        </div>
        <div className="w-full max-w-sm text-center relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 amber-gradient rounded-xl shadow-xl flex items-center justify-center mb-4 -rotate-3 border border-white/10">
              <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>mark_email_read</span>
            </div>
            <h1 className="font-headline font-extrabold text-3xl tracking-tight text-white mb-1">Check your email</h1>
            <p className="text-surface-variant font-label uppercase tracking-[0.2em] text-[10px]">Verification Required</p>
          </div>
          <div className="bg-surface-container-lowest rounded-xl shadow-2xl p-8">
            <p className="text-on-surface-variant text-sm mb-1">We sent a confirmation link to</p>
            <p className="text-on-surface font-semibold text-sm mb-4">{email}</p>
            <p className="text-on-surface-variant text-xs mb-6 leading-relaxed">
              Click the link in that email to activate your account and get started with 5 free estimates.
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
    <div className="fixed inset-0 bg-inverse-surface flex items-center justify-center z-50 px-4 relative overflow-hidden">
      {/* Blueprint decoration lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 right-10 w-64 h-64 border-t border-r border-white/5 opacity-20 hidden md:block"></div>
        <div className="absolute bottom-10 left-10 w-96 h-96 border-b border-l border-white/5 opacity-20 hidden md:block"></div>
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* App Identity */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 amber-gradient rounded-xl shadow-xl flex items-center justify-center mb-4 -rotate-3 border border-white/10">
            <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>architecture</span>
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
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">mail</span>
                  <input id="auth-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="john@contractor.com" className={inputCls} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className={labelCls} htmlFor="auth-password">Password</label>
                  {tab === 'login' && <a href="#" className="text-[11px] font-bold text-primary hover:underline">Forgot?</a>}
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">lock</span>
                  <input id="auth-password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
                </div>
              </div>

              {tab === 'signup' && (
                <div className="bg-primary-container/10 border-l-4 border-primary-container p-4 rounded-r-lg">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>celebration</span>
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
                {!submitting && <span className="material-symbols-outlined text-xl">arrow_forward</span>}
              </button>
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
