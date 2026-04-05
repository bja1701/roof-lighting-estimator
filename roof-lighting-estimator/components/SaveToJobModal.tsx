import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ensureProfileRowExists } from '../utils/ensureProfile';
import { useProfile } from '../hooks/useProfile';
import { useEstimatorStore } from '../store/useEstimatorStore';

interface Job { id: string; name: string; address: string | null; }
interface Props { onSaved: () => void; onClose: () => void; }

const inputCls = 'w-full px-4 py-3 bg-surface-container-low border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-sm placeholder:text-outline/50 transition-all';
const labelCls = 'block text-[11px] font-label font-bold uppercase tracking-wider text-on-surface-variant mb-1.5';

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

export default function SaveToJobModal({ onSaved, onClose }: Props) {
  const { user } = useAuth();
  const { profile, incrementEstimates } = useProfile();
  const {
    nodes,
    lines,
    totalLength3D,
    estimatedCost,
    pricePerFt,
    controllerFee,
    includeController,
    satelliteCenter,
    estimateSiteAddress,
  } = useEstimatorStore();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [newJobName, setNewJobName] = useState('');
  const [label, setLabel] = useState('Estimate');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'existing' | 'new'>('existing');

  const atLimit = profile?.subscription_tier === 'free' && (profile?.estimates_used ?? 0) >= 5;

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
      setError(
        ensured.error ??
          'Your account profile is still syncing. Refresh the page and try again, or contact support.'
      );
      return;
    }
    let jobId = selectedJobId;
    if (mode === 'new') {
      const { data, error: jobErr } = await supabase.from('jobs').insert({ user_id: user.id, name: newJobName.trim() }).select().single();
      if (jobErr) { setError(jobErr.message); setSubmitting(false); return; }
      jobId = data.id;
    }
    const canvasState = {
      nodes,
      lines,
      pricePerFt,
      controllerFee,
      includeController,
      satelliteCenter,
      estimateSiteAddress,
    };
    const { error: quoteErr } = await supabase.from('quotes').insert({
      job_id: jobId, label: label.trim() || 'Estimate', line_items: buildLineItems(),
      notes: notes.trim() || null, price_per_foot: pricePerFt, controller_fee: controllerFee,
      include_controller: includeController, total_linear_ft: totalLength3D,
      total_price: estimatedCost, canvas_state: canvasState,
    });
    if (quoteErr) { setError(quoteErr.message); setSubmitting(false); return; }

    const jobAddress = await resolveAddressForJob(estimateSiteAddress, satelliteCenter);
    const { error: jobAddrErr } = await supabase.from('jobs').update({ address: jobAddress }).eq('id', jobId);
    if (jobAddrErr) { setError(jobAddrErr.message); setSubmitting(false); return; }

    await incrementEstimates();
    setSubmitting(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/70 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-xl shadow-[0px_20px_40px_rgba(17,28,45,0.15)] border border-outline-variant/10 w-full max-w-md overflow-hidden">
        <div className="h-1 w-full amber-gradient"></div>
        <div className="p-7">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-container/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-container text-lg">save</span>
              </div>
              <h2 className="font-headline font-bold text-xl text-on-surface">Save Estimate</h2>
            </div>
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-lg hover:bg-surface-container-low">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          {atLimit ? (
            <div className="text-center py-6">
              <span className="material-symbols-outlined text-4xl text-error mb-3 block">block</span>
              <p className="font-headline font-bold text-on-surface mb-2">Free estimate limit reached</p>
              <p className="text-on-surface-variant text-sm mb-5">You've used all 5 free estimates. Contact us to upgrade your account.</p>
              <button onClick={onClose} className="px-6 py-2.5 bg-surface-container-low text-on-surface font-medium text-sm rounded-lg hover:bg-surface-container transition-colors">Close</button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Summary */}
              <div className="bg-surface-container-low rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-label uppercase tracking-wider text-on-surface-variant">Total linear ft</p>
                  <p className="text-xl font-headline font-bold text-on-surface">{totalLength3D.toFixed(1)} ft</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-label uppercase tracking-wider text-on-surface-variant">Estimated cost</p>
                  <p className="text-xl font-headline font-bold text-primary-container">${estimatedCost.toFixed(2)}</p>
                </div>
              </div>

              {/* Job mode toggle */}
              {jobs.length > 0 && (
                <div className="flex bg-surface-container-low p-1 rounded-lg">
                  <button onClick={() => setMode('existing')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'existing' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>Existing Job</button>
                  <button onClick={() => setMode('new')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'new' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>New Job</button>
                </div>
              )}

              {mode === 'existing' ? (
                <div>
                  <label className={labelCls}>Job</label>
                  <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} className={inputCls}>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.name}{j.address ? ` — ${j.address}` : ''}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className={labelCls}>Job Name *</label>
                  <input type="text" value={newJobName} onChange={e => setNewJobName(e.target.value)} placeholder="Johnson Residence" className={inputCls} />
                </div>
              )}

              <div>
                <label className={labelCls}>Estimate Label</label>
                <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Estimate" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Includes clip installation, excludes power run." rows={2} className={`${inputCls} resize-none`} />
              </div>

              {error && (
                <div className="bg-error-container/30 border-l-4 border-error p-3 rounded-r-lg">
                  <p className="text-sm text-error font-medium">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 py-3 bg-surface-container-low text-on-surface-variant font-medium text-sm rounded-lg hover:bg-surface-container transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={submitting} className="flex-1 amber-gradient text-white font-headline font-bold py-3 rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
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
