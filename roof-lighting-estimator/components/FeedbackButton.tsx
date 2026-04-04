import React, { useState } from 'react';
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
      {/* Floating pill button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2.5 bg-inverse-surface text-inverse-on-surface text-sm font-medium rounded-full shadow-lg hover:opacity-90 transition-all active:scale-95"
      >
        <span className="material-symbols-outlined text-base">chat_bubble</span>
        Feedback
      </button>

      {/* Popup */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end pointer-events-none">
          <div className="pointer-events-auto w-80 mb-20 mr-5 bg-surface-container-lowest rounded-xl shadow-[0px_20px_40px_rgba(17,28,45,0.12)] border border-outline-variant/20 p-6">
            {submitted ? (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-4xl text-tertiary mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <p className="font-headline font-bold text-on-surface mb-1">Thanks! This helps a lot.</p>
                <p className="text-on-surface-variant text-sm">Your feedback has been received.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary-container text-xl">chat_bubble</span>
                    <h3 className="font-headline font-bold text-on-surface">Send Feedback</h3>
                  </div>
                  <button onClick={() => setOpen(false)} className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-lg hover:bg-surface-container-low">
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>

                {/* Star rating */}
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHover(star)}
                      onMouseLeave={() => setHover(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <span
                        className={`material-symbols-outlined text-2xl ${star <= (hover || rating) ? 'text-primary-container' : 'text-outline-variant'}`}
                        style={{ fontVariationSettings: `'FILL' ${star <= (hover || rating) ? 1 : 0}` }}
                      >star</span>
                    </button>
                  ))}
                </div>

                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="What's working? What's not?"
                  rows={3}
                  className="w-full px-4 py-3 bg-surface-container-low border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-sm placeholder:text-outline/50 transition-all resize-none mb-4"
                />

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !message.trim()}
                  className="w-full amber-gradient text-white font-headline font-bold py-3 rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
