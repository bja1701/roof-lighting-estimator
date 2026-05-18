import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUpgradeModal } from '../hooks/useUpgradeModal';
import { useProfile } from '../hooks/useProfile';

export default function UpgradeModal() {
  const { isOpen, close } = useUpgradeModal();
  const { profile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const hasRemainingEstimates = (profile?.estimates_used ?? 0) < 5;

  const handleGetStarted = async () => {
    setLoading(true);
    setError('');
    try {
      // Explicitly pass the JWT so the Edge Function receives it
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in. Please refresh and try again.');

      const { data, error: fnError } = await supabase.functions.invoke('create-checkout-session', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { returnUrl: window.location.origin },
      });
      if (fnError) {
        let message = fnError.message;
        try {
          const body = await (fnError as any).context?.json?.();
          if (body?.error) message = body.error;
        } catch { /* ignore parse failure */ }
        throw new Error(message);
      }
      if (!data?.url) throw new Error('No checkout URL returned');
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ background: 'rgba(26,26,26,0.5)' }}>
      <div className="w-full max-w-sm">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-modal)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          {/* Forest green top bar */}
          <div style={{ height: 4, background: 'var(--color-primary)' }} />

          <div className="p-7">
            {/* Title */}
            <div
              className="mb-1.5 text-[15px] font-extrabold"
              style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
            >
              Upgrade to Pro
            </div>
            <div className="text-[11px] mb-5" style={{ color: 'var(--color-slate)' }}>
              You've used all 5 free estimates
            </div>

            {/* Price block */}
            <div
              className="rounded-[10px] p-4 mb-5 flex items-center justify-between"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div>
                <div
                  className="text-[26px] font-extrabold leading-none"
                  style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
                >
                  $89
                  <span className="text-[13px] font-normal" style={{ color: 'var(--color-slate)' }}> /month</span>
                </div>
                <div className="text-[10px] mt-1" style={{ color: 'var(--color-slate)' }}>
                  Unlimited estimates · Cancel anytime
                </div>
              </div>
              <div className="text-[10px] font-bold text-right leading-tight" style={{ color: 'var(--color-primary)' }}>
                Everything<br />included
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 text-[11px] rounded-lg px-3 py-2" style={{ color: '#c94040', background: 'rgba(201,64,64,0.08)', border: '1px solid rgba(201,64,64,0.15)' }}>
                {error}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleGetStarted}
              disabled={loading}
              className="w-full rounded-[10px] py-3 text-center text-[13px] font-bold mb-2.5 text-white transition-opacity disabled:opacity-60"
              style={{ background: 'linear-gradient(90deg, var(--color-accent), #f08030)' }}
            >
              {loading ? 'Redirecting…' : 'Get started →'}
            </button>

            {/* Dismiss — always shown */}
            <button
              onClick={close}
              className="w-full text-center text-[11px] transition-colors"
              style={{ color: 'var(--color-slate)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-slate)')}
            >
              {hasRemainingEstimates
                ? 'Not ready yet — use my remaining free estimates'
                : 'Not right now — dismiss'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
