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
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout-session');
      if (fnError) throw new Error(fnError.message);
      if (!data?.url) throw new Error('No checkout URL returned');
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-sm">
        <div
          className="rounded-2xl overflow-hidden border border-white/8"
          style={{ background: '#1e2d45', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
        >
          {/* Amber top bar */}
          <div style={{ height: 4, background: 'linear-gradient(90deg,#f59e0b,#fbbf24)' }} />

          <div className="p-7">
            {/* Title */}
            <div className="mb-1.5 text-[15px] font-extrabold text-slate-200">
              Upgrade to Pro
            </div>
            <div className="text-[11px] text-slate-400 mb-5">
              You've used all 5 free estimates
            </div>

            {/* Price block */}
            <div
              className="rounded-[10px] p-4 mb-5 flex items-center justify-between"
              style={{ background: '#0f1729', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div>
                <div className="text-[26px] font-extrabold text-white leading-none">
                  $89
                  <span className="text-[13px] text-slate-400 font-normal"> /month</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Unlimited estimates · Cancel anytime
                </div>
              </div>
              <div className="text-[10px] text-amber-400 font-bold text-right leading-tight">
                Everything<br />included
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 text-[11px] text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleGetStarted}
              disabled={loading}
              className="w-full rounded-[10px] py-3 text-center text-[13px] font-bold mb-2.5 transition-opacity disabled:opacity-60"
              style={{ background: '#f59e0b', color: '#0f1729' }}
            >
              {loading ? 'Redirecting…' : 'Get started →'}
            </button>

            {/* Dismiss — only if estimates remain */}
            {hasRemainingEstimates && (
              <button
                onClick={close}
                className="w-full text-center text-[11px] text-slate-500 hover:text-slate-400 transition-colors"
              >
                Not ready yet — use my remaining free estimates
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
