import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { Profile } from '../hooks/useProfile';

interface Props {
  profile: Profile | null;
}

const STORAGE_KEY = 'setup_checklist_dismissed';

export default function SetupChecklist({ profile }: Props) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');

  if (dismissed) return null;

  const status = profile?.subscription_status;
  if (status !== 'active' && status !== 'canceling') return null;

  const steps = [
    { label: 'Create your account', done: true },
    {
      label: 'Connect Stripe',
      done: profile?.stripe_connect_enabled === true,
      action: () => navigate('/settings'),
      actionLabel: 'Go to Settings',
    },
    {
      label: 'Add company branding',
      done: Boolean(profile?.company_name),
      action: () => navigate('/settings'),
      actionLabel: 'Go to Settings',
    },
  ];

  const allDone = steps.every(s => s.done);
  if (allDone) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  return (
    <div
      className="mb-6 rounded-xl p-5"
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2
            className="font-bold text-base"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}
          >
            Finish setting up EaveHQ
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>
            Complete these steps to start accepting client payments.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss setup checklist"
          className="shrink-0 p-1 rounded-lg transition-colors"
          style={{ color: 'var(--color-slate)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-ink)'; e.currentTarget.style.background = 'var(--color-surface)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-slate)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <X size={16} />
        </button>
      </div>

      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {step.done ? (
                <CheckCircle2 size={18} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
              ) : (
                <Circle size={18} style={{ color: 'var(--color-slate)', flexShrink: 0 }} />
              )}
              <span
                className={`text-sm ${step.done ? 'line-through' : 'font-medium'}`}
                style={{ color: step.done ? 'var(--color-slate)' : 'var(--color-ink)' }}
              >
                {step.label}
              </span>
            </div>
            {!step.done && step.action && (
              <button
                type="button"
                onClick={step.action}
                className="text-xs font-semibold shrink-0 transition-colors"
                style={{ color: 'var(--color-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
              >
                {step.actionLabel}
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
