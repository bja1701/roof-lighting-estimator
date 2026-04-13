import React from 'react';
import { useProfile } from '../hooks/useProfile';
import { useUpgradeModal } from '../hooks/useUpgradeModal';

interface Props {
  onClose: () => void;
}

export default function WelcomeModal({ onClose }: Props) {
  const { markWelcomeShown } = useProfile();
  const { open: openUpgrade } = useUpgradeModal();

  const handleClose = async () => {
    await markWelcomeShown();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="relative w-full max-w-lg bg-surface rounded-xl shadow-2xl overflow-hidden transform transition-all">
        {/* Decorative amber top bar */}
        <div className="h-1.5 w-full amber-gradient"></div>

        <div className="p-8 md:p-12 text-center">
          {/* Icon */}
          <div className="mb-6 relative inline-block">
            <div className="w-20 h-20 bg-primary-container/10 rounded-full flex items-center justify-center mx-auto">
              <span className="text-5xl">🥳</span>
            </div>
            <div className="absolute -top-1 -right-1">
              <span className="material-symbols-outlined text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
          </div>

          {/* Content */}
          <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight mb-2">Welcome aboard!</h1>
          <p className="text-primary-container font-semibold text-lg mb-6">You've got 5 free estimates to start.</p>

          <p className="text-on-surface-variant leading-relaxed text-sm px-2 mb-6">
            Measure any roof directly from satellite imagery with surgical precision. Generate accurate, itemized cost estimates and professional client proposals in minutes.
          </p>

          {/* Feature chips */}
          <div className="flex justify-center gap-4 mb-10">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">satellite_alt</span>
              Satellite Mapping
            </div>
            <div className="w-1 h-1 bg-outline-variant rounded-full self-center"></div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">contract</span>
              Pro Proposals
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-full md:w-auto px-12 py-4 amber-gradient text-white font-headline font-bold text-lg rounded-lg shadow-lg active:scale-95 transition-all uppercase tracking-widest"
          >
            Let's go
          </button>

          <p className="text-xs text-on-surface-variant/60 mt-4">
            You have 5 free estimates.{' '}
            <button
              onClick={() => { handleClose(); openUpgrade(); }}
              className="text-amber-500 hover:text-amber-400 underline underline-offset-2 transition-colors"
            >
              Upgrade anytime
            </button>
            {' '}for unlimited access.
          </p>
        </div>

        {/* Decorative corners */}
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-container/5 rounded-tr-full -z-10"></div>
        <div className="absolute top-0 right-0 w-24 h-24 bg-tertiary-container/5 rounded-bl-full -z-10"></div>
      </div>
    </div>
  );
}
