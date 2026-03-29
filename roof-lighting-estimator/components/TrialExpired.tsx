import React from 'react';
import { useTrialStore, MAX_ESTIMATES } from '../store/useTrialStore';

const TrialExpired: React.FC = () => {
  const { estimatesUsed } = useTrialStore();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 text-center">

        {/* Icon */}
        <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg shadow-amber-500/30 flex items-center justify-center mx-auto mb-5">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>

        {/* Heading */}
        <h2 className="text-xl font-bold text-white mb-1 tracking-tight">
          Free Trial Complete
        </h2>
        <p className="text-slate-400 text-sm mb-2">
          You've used {estimatesUsed} of {MAX_ESTIMATES} free estimates.
        </p>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          Ready to put this to work for your business?
          Reach out and we'll get you set up.
        </p>

        {/* Divider */}
        <div className="w-full h-px bg-slate-800 mb-6"></div>

        {/* CTA */}
        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">
          Contact NexusFlow Solutions
        </p>

        <a
          href="mailto:brighton@nexusflowsolutions.com"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-semibold text-sm bg-blue-600 hover:bg-blue-500 text-white transition-all mb-3"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          brighton@nexusflowsolutions.com
        </a>

        <p className="text-slate-600 text-xs">
          We'll get back to you within 24 hours.
        </p>
      </div>
    </div>
  );
};

export default TrialExpired;
