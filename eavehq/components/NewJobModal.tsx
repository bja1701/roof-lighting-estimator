import React, { useState } from 'react';
import { BriefcaseBusiness, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ensureProfileRowExists } from '../utils/ensureProfile';

interface Props {
  onCreated: (jobId: string) => void;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-ink)',
  fontSize: '0.875rem',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--color-slate)',
  marginBottom: '6px',
};

export default function NewJobModal({ onCreated, onClose }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setSubmitting(true);
    setError('');
    const ensured = await ensureProfileRowExists(user);
    if (!ensured.ok) {
      setSubmitting(false);
      setError(ensured.error ?? 'Your account profile is still syncing. Refresh and try again.');
      return;
    }
    const { data, error: err } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        name: name.trim(),
        address: null,
        client_name: clientName.trim() || null,
        client_email: clientEmail.trim() || null,
        client_phone: clientPhone.trim() || null,
      })
      .select()
      .single();
    setSubmitting(false);
    if (err) { setError(err.message); return; }

    // Upsert client and link to job — errors are silently swallowed, never block job creation
    const trimEmail = clientEmail.trim();
    const trimPhone = clientPhone.trim();
    const trimName = clientName.trim();
    if (trimName || trimEmail || trimPhone) {
      try {
        let clientId: string | null = null;

        if (trimEmail) {
          const { data: existing } = await supabase
            .from('clients')
            .select('id')
            .eq('contractor_id', user.id)
            .eq('email', trimEmail)
            .maybeSingle();
          if (existing?.id) {
            clientId = existing.id;
          } else {
            const { data: inserted } = await supabase
              .from('clients')
              .insert({
                contractor_id: user.id,
                name: trimName || trimEmail,
                email: trimEmail,
                phone: trimPhone || null,
              })
              .select('id')
              .single();
            clientId = inserted?.id ?? null;
          }
        } else if (trimPhone) {
          const { data: existing } = await supabase
            .from('clients')
            .select('id')
            .eq('contractor_id', user.id)
            .eq('phone', trimPhone)
            .maybeSingle();
          if (existing?.id) {
            clientId = existing.id;
          } else {
            const { data: inserted } = await supabase
              .from('clients')
              .insert({
                contractor_id: user.id,
                name: trimName || trimPhone,
                phone: trimPhone,
              })
              .select('id')
              .single();
            clientId = inserted?.id ?? null;
          }
        } else {
          // Name only — always insert a new client row (no dedup)
          const { data: inserted } = await supabase
            .from('clients')
            .insert({ contractor_id: user.id, name: trimName })
            .select('id')
            .single();
          clientId = inserted?.id ?? null;
        }

        if (clientId) {
          await supabase
            .from('jobs')
            .update({ client_id: clientId })
            .eq('id', data.id);
        }
      } catch {
        // Client upsert failed — job already created, proceed normally
      }
    }

    onCreated(data.id);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 px-4"
      style={{ background: 'rgba(31,61,44,0.75)' }}
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-modal)',
        }}
      >

        <div className="p-7">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(58,99,73,0.1)', color: 'var(--color-primary)' }}
              >
                <BriefcaseBusiness size={18} />
              </div>
              <h2 className="font-bold text-xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
                New Job
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-slate)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-ink)'; e.currentTarget.style.background = 'var(--color-surface)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-slate)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label style={labelStyle}>Job Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Smith Residence"
                style={inputStyle}
              />
            </div>

            <div className="pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-slate)' }}>
                Client Info (Optional)
              </p>
              <div className="space-y-4">
                <div>
                  <label style={labelStyle}>Client Name</label>
                  <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="John Smith" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Client Email</label>
                  <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="john@example.com" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Client Phone</label>
                  <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(208) 555-0123" style={inputStyle} />
                </div>
              </div>
            </div>

            <p className="text-xs" style={{ color: 'var(--color-slate)' }}>
              Site address is set automatically when you save an estimate from the map.
            </p>

            {error && (
              <div
                className="px-4 py-3 rounded-lg"
                style={{ background: 'rgba(201,64,64,0.08)', border: '1px solid rgba(201,64,64,0.2)' }}
              >
                <p className="text-sm font-medium" style={{ color: 'var(--color-destructive)' }}>{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 text-sm font-medium rounded-lg transition-colors"
                style={{ background: 'var(--color-surface)', color: 'var(--color-slate)', border: '1px solid var(--color-border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="flex-1 font-bold py-3 rounded-lg transition-all active:scale-95"
                style={{
                  background: submitting || !name.trim() ? 'var(--color-border)' : 'var(--color-accent)',
                  color: submitting || !name.trim() ? 'var(--color-slate)' : '#fff',
                  cursor: submitting || !name.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-display)',
                  boxShadow: submitting || !name.trim() ? 'none' : '0 2px 8px rgba(217,111,10,0.3)',
                }}
              >
                {submitting ? 'Creating…' : 'Create Job'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
