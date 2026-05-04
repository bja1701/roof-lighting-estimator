import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, MailCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';

interface Props {
  onSuccess: () => void;
  onNewUser: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  paddingLeft: '2.5rem',
  paddingRight: '1rem',
  paddingTop: '0.75rem',
  paddingBottom: '0.75rem',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 'var(--radius-md)',
  color: '#fff',
  fontSize: '0.875rem',
  caretColor: '#fff',
  outline: 'none',
  transition: 'border-color 150ms ease',
};

const inputNoIconStyle: React.CSSProperties = {
  ...inputStyle,
  paddingLeft: '1rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'rgba(255,255,255,0.45)',
  marginBottom: '6px',
};

function Logo() {
  return (
    <div
      className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{
        background: 'var(--color-accent)',
        boxShadow: '0 8px 24px rgba(217,111,10,0.35)',
        border: '1px solid rgba(255,255,255,0.15)',
      }}
    >
      <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2L1 9l2 1.5V20h18V10.5L23 9 12 2zm0 2.5L20 10v8H4v-8l8-5.5z" />
        <rect x="9" y="14" width="6" height="6" rx="0.5" />
      </svg>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
      }}
    >
      {children}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div
      className="px-4 py-3 rounded-lg"
      style={{ background: 'rgba(201,64,64,0.15)', border: '1px solid rgba(201,64,64,0.3)' }}
    >
      <p className="text-sm font-medium" style={{ color: '#f87171' }}>{msg}</p>
    </div>
  );
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

  const { signIn, signUp } = useAuth();
  const { fetchProfile } = useProfile();

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

  // Forgot sent
  if (mode === 'forgot-sent') {
    return (
      <AuthShell>
        <div className="w-full max-w-sm text-center">
          <div className="flex flex-col items-center mb-8">
            <Logo />
            <h1 className="mt-4 font-extrabold text-3xl tracking-tight text-white" style={{ fontFamily: 'var(--font-display)' }}>
              Check your email
            </h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Password Reset
            </p>
          </div>
          <Card>
            <div className="px-8 py-8">
              <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>We sent a reset link to</p>
              <p className="font-semibold text-sm mb-4 text-white">{email}</p>
              <p className="text-xs mb-6 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Click the link in that email to choose a new password. Check your spam folder if you don't see it.
              </p>
              <button
                onClick={() => { setMode('auth'); setTab('login'); }}
                className="w-full py-3 rounded-lg text-sm font-bold transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              >
                Back to Sign In
              </button>
            </div>
          </Card>
        </div>
      </AuthShell>
    );
  }

  // Forgot form
  if (mode === 'forgot') {
    return (
      <AuthShell>
        <div className="w-full max-w-lg">
          <div className="flex flex-col items-center mb-10">
            <Logo />
            <h1 className="mt-4 font-extrabold text-3xl tracking-tight text-white" style={{ fontFamily: 'var(--font-display)' }}>
              Reset password
            </h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              We'll send you a link
            </p>
          </div>
          <Card>
            <div className="px-8 py-8">
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label style={labelStyle} htmlFor="reset-email">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.35)' }} />
                    <input id="reset-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="john@contractor.com" style={inputStyle} />
                  </div>
                </div>
                {error && <ErrorBanner msg={error} />}
                <PrimaryButton loading={submitting}>{submitting ? 'Sending…' : 'Send reset link'}</PrimaryButton>
                <button
                  type="button"
                  onClick={() => { setMode('auth'); setError(''); }}
                  className="w-full text-sm transition-colors"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                >
                  ← Back to Sign In
                </button>
              </form>
            </div>
          </Card>
        </div>
      </AuthShell>
    );
  }

  // Check email (post-signup)
  if (checkEmail) {
    return (
      <AuthShell>
        <div className="w-full max-w-sm text-center">
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-primary)', boxShadow: '0 8px 24px rgba(58,99,73,0.4)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <MailCheck size={32} className="text-white" />
            </div>
            <h1 className="mt-4 font-extrabold text-3xl tracking-tight text-white" style={{ fontFamily: 'var(--font-display)' }}>
              Check your email
            </h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Verification Required
            </p>
          </div>
          <Card>
            <div className="px-8 py-8">
              <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>We sent a confirmation link to</p>
              <p className="font-semibold text-sm mb-4 text-white">{email}</p>
              <p className="text-xs mb-6 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Click the link in that email to activate your account. If this email is already registered, use Sign In or reset your password instead.
              </p>
              <button
                onClick={() => { setCheckEmail(false); setTab('login'); }}
                className="w-full py-3 rounded-lg text-sm font-bold transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              >
                Back to Sign In
              </button>
            </div>
          </Card>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {/* Subtle corner lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden hidden md:block">
        <div className="absolute top-10 right-10 w-64 h-64 border-t border-r" style={{ borderColor: 'rgba(255,255,255,0.04)' }} />
        <div className="absolute bottom-10 left-10 w-96 h-96 border-b border-l" style={{ borderColor: 'rgba(255,255,255,0.04)' }} />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Brand */}
        <div className="flex flex-col items-center mb-10">
          <Logo />
          <h1 className="mt-4 font-extrabold text-3xl tracking-tight text-white" style={{ fontFamily: 'var(--font-display)' }}>
            EaveHQ
          </h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Precision Built for Contractors
          </p>
        </div>

        <Card>
          {/* Tab toggle */}
          <div className="p-4">
            <div
              className="flex p-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              {(['login', 'signup'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(''); }}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-md transition-all duration-200"
                  style={
                    tab === t
                      ? { background: 'var(--color-card)', color: 'var(--color-primary)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
                      : { color: 'rgba(255,255,255,0.45)' }
                  }
                >
                  {t === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="px-8 pb-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              {tab === 'signup' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label style={labelStyle}>First Name</label>
                    <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Brighton" style={inputNoIconStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Last Name</label>
                    <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Jones" style={inputNoIconStyle} />
                  </div>
                </div>
              )}

              <div>
                <label style={labelStyle} htmlFor="auth-email">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.35)' }} />
                  <input id="auth-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="john@contractor.com" style={inputStyle} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label style={labelStyle} htmlFor="auth-password">Password</label>
                  {tab === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); }}
                      className="text-[11px] font-bold transition-colors"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.35)' }} />
                  <input id="auth-password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
                </div>
              </div>

              {tab === 'signup' && (
                <div
                  className="px-4 py-3.5 rounded-lg"
                  style={{ background: 'rgba(58,99,73,0.25)', border: '1px solid rgba(58,99,73,0.4)' }}
                >
                  <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    Start with 5 free estimates — no credit card required
                  </p>
                </div>
              )}

              {error && <ErrorBanner msg={error} />}

              <PrimaryButton loading={submitting}>
                {submitting
                  ? (tab === 'login' ? 'Signing in…' : 'Creating account…')
                  : (tab === 'login' ? 'Sign In' : 'Create Account')}
                {!submitting && <ArrowRight size={20} />}
              </PrimaryButton>
            </form>
          </div>
        </Card>

        <p className="mt-8 text-center text-[11px] font-medium max-w-xs mx-auto" style={{ color: 'rgba(255,255,255,0.25)' }}>
          By continuing, you agree to EaveHQ's{' '}
          <a className="underline hover:opacity-75" href="#">Terms of Service</a> and{' '}
          <a className="underline hover:opacity-75" href="#">Privacy Policy</a>.
        </p>
      </div>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 px-4 overflow-hidden"
      style={{ background: 'var(--color-primary-dark)', fontFamily: 'var(--font-body)' }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({ children, loading }: { children: React.ReactNode; loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full font-bold py-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
      style={{
        background: loading ? 'rgba(255,255,255,0.1)' : 'var(--color-accent)',
        color: loading ? 'rgba(255,255,255,0.4)' : '#fff',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font-display)',
        boxShadow: loading ? 'none' : '0 4px 14px rgba(217,111,10,0.4)',
      }}
    >
      {children}
    </button>
  );
}
