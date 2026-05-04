import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Check } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function ProWelcomeModal({ onClose }: Props) {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/settings', { replace: true });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: 'rgba(31,61,44,0.75)' }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl"
        style={{
          background: 'var(--color-primary-dark)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div className="p-8 text-center">
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: 'var(--color-accent)',
              boxShadow: '0 8px 24px rgba(217,111,10,0.4)',
            }}
          >
            <Zap size={30} fill="white" color="white" />
          </div>

          <h2
            className="text-2xl font-extrabold text-white mb-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            You're on Pro!
          </h2>
          <p className="text-sm mb-7" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Unlimited estimates unlocked. No more limits — build every job exactly how you want it.
          </p>

          <div
            className="rounded-xl p-4 mb-7 text-left space-y-3"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {[
              'Unlimited roofline estimates',
              'PDF client quotes',
              'Job pipeline & payment tracking',
              'Cancel anytime from Settings',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'rgba(217,111,10,0.2)' }}
                >
                  <Check size={12} color="var(--color-accent)" strokeWidth={3} />
                </div>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>{item}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleClose}
            className="w-full rounded-xl py-3.5 text-sm font-bold transition-opacity hover:opacity-90 active:scale-95"
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
              fontFamily: 'var(--font-display)',
              boxShadow: '0 4px 16px rgba(217,111,10,0.35)',
            }}
          >
            Let's build →
          </button>
        </div>
      </div>
    </div>
  );
}
