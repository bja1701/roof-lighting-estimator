import React, { useState } from 'react';
import { useTrialStore } from '../store/useTrialStore';

const EmailGate: React.FC = () => {
  const { submitEmail, isLoading } = useTrialStore();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    await submitEmail(email.trim().toLowerCase());
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4">

        {/* Icon */}
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-teal-400 rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center mx-auto mb-5">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        </div>

        {/* Heading */}
        <h2 className="text-xl font-bold text-white text-center mb-1 tracking-tight">
          Try the Roof Lighting Estimator
        </h2>
        <p className="text-slate-400 text-sm text-center mb-6 leading-relaxed">
          Get <span className="text-teal-400 font-semibold">5 free estimates</span> on us.
          Enter your email to start.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            placeholder="your@email.com"
            autoFocus
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
          />

          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Setting up your trial...
              </>
            ) : (
              'Start Free Trial'
            )}
          </button>
        </form>

        <p className="text-slate-600 text-xs text-center mt-4">
          No credit card required. 5 free estimates included.
        </p>
      </div>
    </div>
  );
};

export default EmailGate;
