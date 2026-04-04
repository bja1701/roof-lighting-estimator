import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const ChatIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
  </svg>
);

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg className="w-6 h-6" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-10 h-10 text-tertiary mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

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
      {/* Floating pill button — raised higher on mobile so it clears bottom content */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 sm:bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2.5 bg-inverse-surface text-inverse-on-surface text-sm font-medium rounded-full shadow-lg hover:opacity-90 transition-all active:scale-95"
      >
        <ChatIcon />
        Feedback
      </button>

      {/* Popup */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end pointer-events-none">
          <div className="pointer-events-auto w-80 mb-20 mr-5 bg-surface-container-lowest rounded-xl shadow-[0px_20px_40px_rgba(17,28,45,0.12)] border border-outline-variant/20 p-6">
            {submitted ? (
              <div className="text-center py-6">
                <CheckCircleIcon />
                <p className="font-headline font-bold text-on-surface mb-1">Thanks! This helps a lot.</p>
                <p className="text-on-surface-variant text-sm">Your feedback has been received.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="text-primary-container"><ChatIcon /></span>
                    <h3 className="font-headline font-bold text-on-surface">Send Feedback</h3>
                  </div>
                  <button onClick={() => setOpen(false)} className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-lg hover:bg-surface-container-low">
                    <XIcon />
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
                      className={`transition-transform hover:scale-110 ${star <= (hover || rating) ? 'text-primary-container' : 'text-outline-variant'}`}
                    >
                      <StarIcon filled={star <= (hover || rating)} />
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
