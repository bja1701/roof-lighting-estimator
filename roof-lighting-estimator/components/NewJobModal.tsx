import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface Props {
  onCreated: (jobId: string) => void;
  onClose: () => void;
}

const inputCls = 'w-full px-4 py-3 bg-surface-container-low border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-sm placeholder:text-outline/50 transition-all';
const labelCls = 'block text-[11px] font-label font-bold uppercase tracking-wider text-on-surface-variant mb-1.5';

export default function NewJobModal({ onCreated, onClose }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setSubmitting(true);
    setError('');
    const { data, error: err } = await supabase
      .from('jobs')
      .insert({ user_id: user.id, name: name.trim(), address: null })
      .select()
      .single();
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    onCreated(data.id);
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/70 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-xl shadow-[0px_20px_40px_rgba(17,28,45,0.15)] border border-outline-variant/10 w-full max-w-md overflow-hidden">
        {/* Top amber bar */}
        <div className="h-1 w-full amber-gradient"></div>
        <div className="p-7">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-container/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-container text-lg">add_home_work</span>
              </div>
              <h2 className="font-headline font-bold text-xl text-on-surface">New Job</h2>
            </div>
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-lg hover:bg-surface-container-low">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={labelCls}>Job Name *</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Smith Residence" className={inputCls} />
            </div>
            <p className="text-xs text-on-surface-variant">
              Site address is set automatically when you save an estimate from the map (search or map center).
            </p>

            {error && (
              <div className="bg-error-container/30 border-l-4 border-error p-3 rounded-r-lg">
                <p className="text-sm text-error font-medium">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-3 bg-surface-container-low text-on-surface-variant font-medium text-sm rounded-lg hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={submitting || !name.trim()} className="flex-1 amber-gradient text-white font-headline font-bold py-3 rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? 'Creating…' : 'Create Job'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
