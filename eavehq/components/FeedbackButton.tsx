import React, { useState } from 'react';
import { MessageCircle, X, CheckCircle, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function FeedbackButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    await supabase.from('feedback').insert({
      user_id: user?.id ?? null,
      rating: rating || null,
      message: message.trim(),
      page: window.location.pathname,
    });
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setOpen(false);
      setRating(0);
      setMessage('');
    }, 2500);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 sm:bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all active:scale-95"
        style={{
          background: 'var(--color-primary-dark)',
          color: 'rgba(255,255,255,0.85)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        <MessageCircle size={16} />
        Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end pointer-events-none">
          <div
            className="pointer-events-auto w-80 mb-20 mr-5 rounded-xl p-6"
            style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-modal)',
            }}
          >
            {submitted ? (
              <div className="text-center py-6">
                <CheckCircle size={40} className="mx-auto mb-3" style={{ color: 'var(--color-success)' }} />
                <p className="font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
                  Thanks! This helps a lot.
                </p>
                <p className="text-sm" style={{ color: 'var(--color-slate)' }}>
                  Your feedback has been received.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <MessageCircle size={16} style={{ color: 'var(--color-primary)' }} />
                    <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
                      Send Feedback
                    </h3>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--color-slate)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-ink)'; e.currentTarget.style.background = 'var(--color-surface)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-slate)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Star rating */}
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map(star => {
                    const active = star <= (hover || rating);
                    return (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        className="transition-transform hover:scale-110"
                        style={{ color: active ? 'var(--color-accent)' : 'var(--color-border)' }}
                      >
                        <Star size={22} fill={active ? 'currentColor' : 'none'} strokeWidth={1.5} />
                      </button>
                    );
                  })}
                </div>

                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="What's working? What's not?"
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg text-sm resize-none mb-4 focus:outline-none"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-ink)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                />

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !message.trim()}
                  className="w-full font-bold py-3 rounded-lg transition-all active:scale-95"
                  style={{
                    background: submitting || !message.trim() ? 'var(--color-border)' : 'var(--color-accent)',
                    color: submitting || !message.trim() ? 'var(--color-slate)' : '#fff',
                    cursor: submitting || !message.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {submitting ? 'Sending…' : 'Submit'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
