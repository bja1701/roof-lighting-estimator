import React, { useEffect, useState } from 'react';
import { Save, X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ensureProfileRowExists } from '../utils/ensureProfile';
import { useProfile } from '../hooks/useProfile';
import { useEstimatorStore } from '../store/useEstimatorStore';

interface Job { id: string; name: string; address: string | null; }
interface Props { onSaved: () => void; onClose: () => void; editingQuoteId?: string | null; editingLabel?: string | null; }

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

function resolveAddressForJob(
  formattedFromSearch: string | null,
  center: { lat: number; lng: number }
): Promise<string> {
  if (formattedFromSearch?.trim()) return Promise.resolve(formattedFromSearch.trim());
  const win = window as any;
  if (win.google?.maps?.Geocoder) {
    return new Promise((resolve) => {
      const geocoder = new win.google.maps.Geocoder();
      geocoder.geocode({ location: center }, (results: any, status: string) => {
        if (status === 'OK' && results?.[0]?.formatted_address) {
          resolve(results[0].formatted_address);
        } else {
          resolve(`${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`);
        }
      });
    });
  }
  return Promise.resolve(`${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`);
}

export default function SaveToJobModal({ onSaved, onClose, editingQuoteId, editingLabel }: Props) {
  const { user } = useAuth();
  const { profile, incrementEstimates } = useProfile();
  const {
    nodes, lines, totalLength3D, estimatedCost, pricePerFt,
    controllerFee, includeController, satelliteCenter, estimateSiteAddress,
  } = useEstimatorStore();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [newJobName, setNewJobName] = useState('');
  const [label, setLabel] = useState(editingLabel ?? 'Estimate');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'existing' | 'new'>('existing');

  const atLimit = profile?.subscription_status === 'free' && (profile?.estimates_used ?? 0) >= 5;

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    const { data } = await supabase.from('jobs').select('id, name, address').order('created_at', { ascending: false });
    setJobs(data ?? []);
    if (data && data.length > 0) { setSelectedJobId(data[0].id); } else { setMode('new'); }
  };

  const buildLineItems = () => lines.map(line => {
    const start = nodes.find(n => n.id === line.startNodeId);
    const end = nodes.find(n => n.id === line.endNodeId);
    return { id: line.id, type: line.type, pitch: line.pitch, startNode: start ?? null, endNode: end ?? null };
  });

  const handleSave = async () => {
    if (atLimit) return;
    if (mode === 'existing' && !selectedJobId) { setError('Select a job'); return; }
    if (mode === 'new' && !newJobName.trim()) { setError('Enter a job name'); return; }
    if (!user) return;
    setSubmitting(true);
    setError('');
    const ensured = await ensureProfileRowExists(user);
    if (!ensured.ok) {
      setSubmitting(false);
      setError(ensured.error ?? 'Your account profile is still syncing. Refresh and try again.');
      return;
    }
    const canvasState = { nodes, lines, pricePerFt, controllerFee, includeController, satelliteCenter, estimateSiteAddress };
    const quotePayload = {
      label: label.trim() || 'Estimate', line_items: buildLineItems(),
      notes: notes.trim() || null, price_per_foot: pricePerFt, controller_fee: controllerFee,
      include_controller: includeController, total_linear_ft: totalLength3D,
      total_price: estimatedCost, canvas_state: canvasState,
    };

    if (editingQuoteId) {
      // UPDATE path — paid users editing an existing quote
      const { error: quoteErr } = await supabase.from('quotes').update(quotePayload).eq('id', editingQuoteId).eq('job_id', selectedJobId);
      if (quoteErr) { setError(quoteErr.message); setSubmitting(false); return; }
    } else {
      // INSERT path — new quote
      let jobId = selectedJobId;
      if (mode === 'new') {
        const { data, error: jobErr } = await supabase.from('jobs').insert({ user_id: user.id, name: newJobName.trim() }).select().single();
        if (jobErr) { setError(jobErr.message); setSubmitting(false); return; }
        jobId = data.id;
      }
      const { error: quoteErr } = await supabase.from('quotes').insert({ job_id: jobId, ...quotePayload });
      if (quoteErr) { setError(quoteErr.message); setSubmitting(false); return; }
      const jobAddress = await resolveAddressForJob(estimateSiteAddress, satelliteCenter);
      await supabase.from('jobs').update({ address: jobAddress }).eq('id', jobId);
      await incrementEstimates();
    }

    setSubmitting(false);
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 px-4"
      style={{ background: 'rgba(31,61,44,0.75)' }}
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="p-7">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(58,99,73,0.1)', color: 'var(--color-primary)' }}>
                <Save size={18} />
              </div>
              <h2 className="font-bold text-xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
                Save Estimate
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

          {atLimit ? (
            <div className="text-center py-6">
              <AlertCircle size={40} className="mx-auto mb-3" style={{ color: 'var(--color-destructive)' }} />
              <p className="font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
                Free estimate limit reached
              </p>
              <p className="text-sm mb-5" style={{ color: 'var(--color-slate)' }}>
                You've used all 5 free estimates. Contact us to upgrade your account.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-medium rounded-lg transition-colors"
                style={{ background: 'var(--color-surface)', color: 'var(--color-slate)', border: '1px solid var(--color-border)' }}
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Summary */}
              <div
                className="rounded-xl p-4 flex items-center justify-between"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--color-slate)' }}>Total linear ft</p>
                  <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}>
                    {totalLength3D.toFixed(1)} ft
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--color-slate)' }}>Estimated cost</p>
                  <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                    ${estimatedCost.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Job mode toggle */}
              {jobs.length > 0 && (
                <div
                  className="flex p-1 rounded-lg"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  {(['existing', 'new'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className="flex-1 py-2 text-sm font-medium rounded-md transition-all"
                      style={
                        mode === m
                          ? { background: 'var(--color-card)', color: 'var(--color-primary)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                          : { color: 'var(--color-slate)' }
                      }
                    >
                      {m === 'existing' ? 'Existing Job' : 'New Job'}
                    </button>
                  ))}
                </div>
              )}

              {mode === 'existing' ? (
                <div>
                  <label style={labelStyle}>Job</label>
                  <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} style={inputStyle}>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.name}{j.address ? ` — ${j.address}` : ''}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Job Name *</label>
                  <input type="text" value={newJobName} onChange={e => setNewJobName(e.target.value)} placeholder="Johnson Residence" style={inputStyle} />
                </div>
              )}

              <div>
                <label style={labelStyle}>Estimate Label</label>
                <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Estimate" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Includes clip installation, excludes power run."
                  rows={2}
                  className="resize-none focus:outline-none"
                  style={{ ...inputStyle, display: 'block' }}
                />
              </div>

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
                  onClick={onClose}
                  className="flex-1 py-3 text-sm font-medium rounded-lg transition-colors"
                  style={{ background: 'var(--color-surface)', color: 'var(--color-slate)', border: '1px solid var(--color-border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={submitting}
                  className="flex-1 font-bold py-3 rounded-lg transition-all active:scale-95"
                  style={{
                    background: submitting ? 'var(--color-border)' : 'var(--color-accent)',
                    color: submitting ? 'var(--color-slate)' : '#fff',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-display)',
                    boxShadow: submitting ? 'none' : '0 2px 8px rgba(217,111,10,0.3)',
                  }}
                >
                  {submitting ? 'Saving…' : 'Save Estimate'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
