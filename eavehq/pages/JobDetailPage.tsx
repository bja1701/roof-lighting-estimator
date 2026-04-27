import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const NOTIFY_FINAL_PAYMENT_URL =
  'https://bsbewwwflqjlxxovjgec.supabase.co/functions/v1/notify-final-payment';
const SEND_ESTIMATE_OPTIONS_URL =
  'https://bsbewwwflqjlxxovjgec.supabase.co/functions/v1/send-estimate-options';
import { useProfile, useProfileVisibilityRefetch } from '../hooks/useProfile';
import { isFreeTierEstimatorExhausted } from '../utils/estimatorAccess';
import SharedLayout from '../components/SharedLayout';
import QuoteCard from '../components/QuoteCard';
import JobStatusBadge from '../components/JobStatusBadge';
import { Job, JobStatus } from '../types/job';
import { JOB_STATUS_CONFIG } from '../utils/jobStatus';

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

interface Quote {
  id: string;
  label: string;
  line_items: any[];
  notes: string | null;
  total_linear_ft: number | null;
  total_price: number | null;
  price_per_foot: number | null;
  controller_fee: number | null;
  include_controller: boolean | null;
  canvas_state: any | null;
  created_at: string;
  discount_amount: number | null;
  discount_type: string | null;
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useProfile();
  useProfileVisibilityRefetch();
  const [job, setJob] = useState<Job | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [depositEditValue, setDepositEditValue] = useState<string>('');
  const [depositEditing, setDepositEditing] = useState(false);
  const [depositSaving, setDepositSaving] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [advancingStatus, setAdvancingStatus] = useState(false);
  const [sendOptionsModalOpen, setSendOptionsModalOpen] = useState(false);
  const [sendOptionsMessage, setSendOptionsMessage] = useState('');
  const [sendOptionsDepositPct, setSendOptionsDepositPct] = useState<string>('');
  const [sendOptionsSending, setSendOptionsSending] = useState(false);

  const handleStatusChange = (newStatus: JobStatus) => {
    setJob(prev => prev ? { ...prev, status: newStatus } : prev);
  };

  const handleJobUpdate = (updates: Partial<Job>) => {
    setJob(prev => prev ? { ...prev, ...updates } : prev);
  };

  const handleDepositEditStart = () => {
    if (!job) return;
    setDepositEditValue(String(job.deposit_percent ?? 50));
    setDepositError(null);
    setDepositEditing(true);
  };

  const handleDepositSave = async () => {
    if (!job || !id) return;
    const parsed = parseInt(depositEditValue, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 100) {
      setDepositError('Enter a whole number between 1 and 100.');
      return;
    }
    setDepositSaving(true);
    const { error } = await supabase.from('jobs').update({ deposit_percent: parsed }).eq('id', id);
    setDepositSaving(false);
    if (error) {
      setDepositError(error.message);
      return;
    }
    handleJobUpdate({ deposit_percent: parsed });
    setDepositEditing(false);
    setDepositError(null);
  };

  const handleDepositKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleDepositSave();
    if (e.key === 'Escape') setDepositEditing(false);
  };

  const handleOpenSendOptions = () => {
    setSendOptionsDepositPct(String(job?.deposit_percent ?? 50));
    setSendOptionsModalOpen(true);
  };

  const handleSendEstimateOptions = async () => {
    if (!id) return;
    const parsedDepositPct = parseInt(sendOptionsDepositPct, 10);
    if (isNaN(parsedDepositPct) || parsedDepositPct < 1 || parsedDepositPct > 100) {
      alert('Enter a deposit percentage between 1 and 100.');
      return;
    }
    setSendOptionsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(SEND_ESTIMATE_OPTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          job_id: id,
          deposit_percentage: parsedDepositPct,
          ...(sendOptionsMessage.trim() ? { custom_message: sendOptionsMessage.trim() } : {}),
        }),
      });
      // Email failure is non-blocking — log but don't abort
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('send-estimate-options failed:', errData);
      }
      // Store deposit_percent on the job regardless of email success
      await supabase.from('jobs').update({ deposit_percent: parsedDepositPct }).eq('id', id);
      handleJobUpdate({ deposit_percent: parsedDepositPct });
      setSendOptionsModalOpen(false);
      setSendOptionsMessage('');
      setSendOptionsDepositPct('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send estimate options');
    } finally {
      setSendOptionsSending(false);
    }
  };

  const handleAdvanceStatus = async () => {
    if (!job || !id) return;
    const cfg = JOB_STATUS_CONFIG[job.status];
    if (!cfg.nextManualStatus) return;
    if (
      job.status === 'estimate_sent' &&
      cfg.nextManualStatus === 'scheduled' &&
      !job.deposit_paid_at &&
      job.deposit_amount == null
    ) {
      const confirmed = window.confirm('No deposit recorded. Mark as Scheduled anyway?');
      if (!confirmed) return;
    }

    // scheduled → in_progress: direct status update, no email prompt
    if (job.status === 'scheduled' && cfg.nextManualStatus === 'in_progress') {
      setAdvancingStatus(true);
      const { error } = await supabase.from('jobs').update({ status: 'in_progress' }).eq('id', id);
      setAdvancingStatus(false);
      if (error) { alert(error.message); return; }
      handleStatusChange('in_progress');
      return;
    }

    // in_progress → complete: call edge function so client gets a final payment email,
    // but skip the email if the job is already final_paid
    if (job.status === 'in_progress' && cfg.nextManualStatus === 'complete') {
      setAdvancingStatus(true);
      try {
        if (job.final_paid_at != null) {
          // Final payment already collected — just update status, no email
          console.log('notify-final-payment: final_paid_at already set — skipping email');
          const { error } = await supabase.from('jobs').update({ status: 'complete' }).eq('id', id);
          if (error) throw new Error(error.message);
          handleStatusChange('complete');
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token) throw new Error('Not authenticated');
          const res = await fetch(NOTIFY_FINAL_PAYMENT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ job_id: id }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? 'Failed to mark complete');
          handleStatusChange('complete');
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to mark complete');
      } finally {
        setAdvancingStatus(false);
      }
      return;
    }

    // All other transitions: direct Supabase update
    setAdvancingStatus(true);
    const { error } = await supabase.from('jobs').update({ status: cfg.nextManualStatus }).eq('id', id);
    setAdvancingStatus(false);
    if (error) { alert(error.message); return; }
    handleStatusChange(cfg.nextManualStatus);
  };

  useEffect(() => { if (id) fetchJobAndQuotes(id); }, [id]);

  const fetchJobAndQuotes = async (jobId: string) => {
    setLoading(true);
    const [{ data: jobData }, { data: quotesData }] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', jobId).single(),
      supabase.from('quotes').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
    ]);
    setJob(jobData ?? null);
    setQuotes(quotesData ?? []);
    setLoading(false);
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm('Delete this estimate?')) return;
    await supabase.from('quotes').delete().eq('id', quoteId);
    setQuotes(q => q.filter(x => x.id !== quoteId));
  };

  const handleDeleteJob = async () => {
    if (!job || !id) return;
    const n = quotes.length;
    const msg =
      n === 0
        ? `Delete job “${job.name}”? This cannot be undone.`
        : `Delete job “${job.name}” and all ${n} saved estimate${n === 1 ? '' : 's'}? This cannot be undone.`;
    if (!confirm(msg)) return;
    setDeleting(true);
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    setDeleting(false);
    if (error) {
      alert(error.message);
      return;
    }
    navigate('/');
  };

  const handleOpenEstimator = (quote?: Quote) => {
    if (isFreeTierEstimatorExhausted(profile)) return;
    if (quote?.canvas_state) {
      const canvasState = { ...quote.canvas_state };
      if (job?.address && (canvasState.estimateSiteAddress == null || canvasState.estimateSiteAddress === '')) {
        canvasState.estimateSiteAddress = job.address;
      }
      sessionStorage.setItem(
        'restore_quote',
        JSON.stringify({ quoteId: quote.id, jobId: id, canvasState, label: quote.label })
      );
    } else {
      sessionStorage.setItem('restore_quote', JSON.stringify({ jobId: id }));
    }
    navigate('/estimator');
  };

  const totalValue = quotes.reduce((sum, q) => sum + (q.total_price ?? 0), 0);
  const totalFt = quotes.reduce((sum, q) => sum + (q.total_linear_ft ?? 0), 0);
  const canEstimate = !isFreeTierEstimatorExhausted(profile);

  if (loading) {
    return (
      <SharedLayout>
        <div className="flex items-center justify-center py-32 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
          Loading…
        </div>
      </SharedLayout>
    );
  }

  if (!job) {
    return (
      <SharedLayout>
        <div className="flex items-center justify-center py-32 text-on-surface-variant">Job not found.</div>
      </SharedLayout>
    );
  }

  return (
    <SharedLayout>
      <div className="max-w-6xl mx-auto px-6 md:px-10 pb-20 pt-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-on-surface-variant text-sm font-label uppercase tracking-widest mb-6">
          <button onClick={() => navigate('/')} className="hover:text-primary transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Jobs
          </button>
          <span>/</span>
          <span className="text-on-surface font-bold">{job.name}</span>
        </nav>

        {/* Job header */}
        <div className="mb-3">
          <h1 className="text-5xl font-headline font-extrabold text-on-surface tracking-tight leading-none mb-3">{job.name}</h1>
          <div className="flex flex-wrap gap-4 items-center text-on-surface-variant text-sm">
            {job.address && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-primary-container">location_on</span>
                <span>{job.address}</span>
              </div>
            )}
            {job.notes && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-primary-container">sticky_note_2</span>
                <span className="italic">{job.notes}</span>
              </div>
            )}
            {(job.client_name || job.client_email || job.client_phone) && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-primary-container">person</span>
                <span>{[job.client_name, job.client_email, job.client_phone].filter(Boolean).join(' · ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status pills row */}
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <JobStatusBadge status={job.status} />

          {job.estimate_sent_at != null && (
            <span className="inline-flex items-center gap-1.5 bg-surface-container-low border border-outline-variant/20 text-on-surface-variant text-xs font-semibold px-3 py-1.5 rounded-full min-h-[36px]">
              <span className="material-symbols-outlined text-sm text-primary-container">mark_email_read</span>
              Estimate sent {new Date(job.estimate_sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}

          {job.client_opened_at != null && (
            <span className="inline-flex items-center gap-1.5 bg-surface-container-low border border-outline-variant/20 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full min-h-[36px]">
              <span className="material-symbols-outlined text-sm">visibility</span>
              Client opened {timeAgo(job.client_opened_at)}
            </span>
          )}

          {job.deposit_paid_at != null && (
            <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-800 text-xs font-semibold px-3 py-1.5 rounded-full min-h-[36px]">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Deposit received {new Date(job.deposit_paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {job.deposit_amount != null && (
                <span className="font-normal ml-0.5">· ${job.deposit_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              )}
            </span>
          )}

          {job.final_paid_at != null && (
            <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-800 text-xs font-semibold px-3 py-1.5 rounded-full min-h-[36px]">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Final payment received {new Date(job.final_paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {job.final_amount != null && (
                <span className="font-normal ml-0.5">· ${job.final_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              )}
            </span>
          )}
        </div>

        {/* Next-status action — inline with pills */}
        {(() => {
          const cfg = JOB_STATUS_CONFIG[job.status];
          if (!cfg.nextManualStatus || !cfg.nextManualLabel) return null;
          const isStartedTransition = job.status === 'scheduled' && cfg.nextManualStatus === 'in_progress';
          if (isStartedTransition && quotes.length === 0) return null;
          return (
            <div className="mb-8">
              <button
                type="button"
                onClick={handleAdvanceStatus}
                disabled={advancingStatus}
                className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest py-2.5 px-4 font-headline text-sm font-bold text-on-surface shadow-sm transition-colors hover:bg-surface-container-low disabled:opacity-50 min-h-[44px]"
              >
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
                {advancingStatus ? 'Saving…' : cfg.nextManualLabel}
              </button>
            </div>
          );
        })()}

        {/* Client actions row */}
        {(quotes.length > 0 || job.portal_token) && (
          <div className="flex flex-wrap gap-3 items-center mb-8 p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
            {/* Deposit % — compact inline field */}
            <div className="flex items-center gap-2 text-sm mr-2">
              <span className="font-label text-on-surface-variant text-xs uppercase tracking-wider">Deposit</span>
              {depositEditing ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={depositEditValue}
                    onChange={e => setDepositEditValue(e.target.value)}
                    onBlur={handleDepositSave}
                    onKeyDown={handleDepositKeyDown}
                    autoFocus
                    className="w-14 rounded-md border border-outline-variant/40 bg-surface-container px-2 py-1 text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
                  />
                  <span className="text-on-surface-variant font-label text-xs">%</span>
                  {depositSaving && <span className="text-xs text-on-surface-variant">Saving…</span>}
                  {depositError && <span className="text-xs text-error">{depositError}</span>}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDepositEditStart}
                  className="inline-flex items-center gap-1 font-bold text-on-surface hover:text-primary transition-colors text-sm min-h-[36px]"
                >
                  {job.deposit_percent ?? 50}%
                  <span className="material-symbols-outlined text-sm text-on-surface-variant">edit</span>
                </button>
              )}
            </div>

            <div className="w-px h-6 bg-outline-variant/30 mx-1" />

            {/* Send Options to Client — primary CTA */}
            {quotes.length > 0 && (
              <button
                type="button"
                onClick={handleOpenSendOptions}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 px-6 font-headline text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary/90 min-h-[44px] flex-1 sm:flex-none"
              >
                <span className="material-symbols-outlined text-lg">send</span>
                Send Options to Client
              </button>
            )}

            {/* View Invoice — demoted text link */}
            {job.portal_token && (
              <a
                href={`/invoice/${job.portal_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors min-h-[36px]"
              >
                <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                View Invoice
              </a>
            )}

            {/* Stripe nudge */}
            {job.deposit_paid_at == null && !profile?.stripe_connect_enabled && (
              <a
                href="/settings"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 hover:bg-amber-100 transition-colors min-h-[36px]"
              >
                <span className="material-symbols-outlined text-sm">warning</span>
                Connect Stripe
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </a>
            )}
          </div>
        )}

        {/* Bento stats row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-surface-container-low p-6 rounded-xl">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-label mb-2">Total Estimates</p>
            <p className="text-3xl font-headline font-bold text-on-surface">{String(quotes.length).padStart(2, '0')}</p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-xl">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-label mb-2">Total Value</p>
            <p className="text-3xl font-headline font-bold text-primary-container">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-primary-container">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-label mb-2">Total Linear Ft</p>
            <p className="text-3xl font-headline font-bold text-on-surface">{totalFt.toFixed(0)} ft</p>
          </div>
        </div>

        {/* Estimates section */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline font-bold text-lg text-on-surface">Estimates</h2>
          <button
            type="button"
            onClick={() => handleOpenEstimator()}
            disabled={!canEstimate}
            className="amber-gradient inline-flex items-center gap-2 rounded-lg py-2.5 px-5 font-headline font-bold text-white shadow-md transition-all hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            New Estimate
          </button>
        </div>

        {quotes.length === 0 ? (
          <div className="text-center py-24 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 mb-12">
            <div className="w-16 h-16 bg-surface-container rounded-2xl mx-auto mb-5 flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant text-3xl">request_quote</span>
            </div>
            <h3 className="font-headline font-bold text-xl text-on-surface mb-2">No estimates yet</h3>
            <p className="text-on-surface-variant text-sm mb-6">Open the estimator to trace rooflines and save an estimate</p>
            <button
              onClick={() => handleOpenEstimator()}
              disabled={!canEstimate}
              className="amber-gradient text-white font-headline font-bold py-3 px-8 rounded-lg shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              Open Estimator
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {quotes.map(quote => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                profile={profile}
                jobId={id!}
                onDelete={() => handleDeleteQuote(quote.id)}
                onEdit={() => handleOpenEstimator(quote)}
                onDiscountChange={(qId, amount, type) => {
                  setQuotes(qs => qs.map(q =>
                    q.id === qId ? { ...q, discount_amount: amount, discount_type: type } : q
                  ));
                }}
              />
            ))}
          </div>
        )}

        {/* Danger zone */}
        <div className="border-t border-outline-variant/20 pt-8">
          <p className="text-xs font-label uppercase tracking-wider text-on-surface-variant mb-3">Danger zone</p>
          <button
            type="button"
            onClick={handleDeleteJob}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg border border-error/30 bg-surface-container-lowest py-2.5 px-4 font-label text-sm font-bold text-error transition-colors hover:bg-error-container/20 disabled:opacity-50 min-h-[44px]"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
            {deleting ? 'Deleting…' : 'Delete job'}
          </button>
        </div>
      </div>

      {sendOptionsModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-inverse-surface/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="send-options-modal-title"
          onClick={(e) => e.target === e.currentTarget && !sendOptionsSending && setSendOptionsModalOpen(false)}
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-lowest shadow-[0px_20px_40px_rgba(17,28,45,0.15)]">
            <div className="h-1 w-full bg-primary-container" />
            <div className="p-7">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container/30">
                  <span className="material-symbols-outlined text-primary text-2xl">send</span>
                </div>
                <h2 id="send-options-modal-title" className="font-headline text-xl font-bold text-on-surface">
                  Send options to client
                </h2>
              </div>
              <p className="mb-4 text-sm text-on-surface-variant leading-relaxed">
                Sending <span className="font-semibold text-on-surface">{quotes.length} estimate{quotes.length !== 1 ? 's' : ''}</span> to{' '}
                <span className="font-semibold text-on-surface">{job.client_email ?? 'the client'}</span>.
                Each option will include a link for the client to select it and pay their deposit.
              </p>
              <div className="mb-2 rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3 space-y-1">
                {quotes.map(q => (
                  <p key={q.id} className="text-sm text-on-surface font-medium">
                    {q.label}{q.total_price != null ? ` — $${q.total_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                  </p>
                ))}
              </div>
              <div className="mt-4 mb-4">
                <label htmlFor="send-options-deposit-pct" className="block text-xs font-label uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Deposit required (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="send-options-deposit-pct"
                    type="number"
                    min={1}
                    max={100}
                    value={sendOptionsDepositPct}
                    onChange={e => setSendOptionsDepositPct(e.target.value)}
                    disabled={sendOptionsSending}
                    placeholder="e.g. 50"
                    className="w-24 rounded-lg border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-50"
                  />
                  <span className="text-sm text-on-surface-variant font-label">%</span>
                </div>
              </div>
              <div className="mb-6">
                <label htmlFor="send-options-message" className="block text-xs font-label uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Custom message (optional)
                </label>
                <textarea
                  id="send-options-message"
                  rows={3}
                  value={sendOptionsMessage}
                  onChange={e => setSendOptionsMessage(e.target.value)}
                  disabled={sendOptionsSending}
                  placeholder="Add a personal note to the client…"
                  className="w-full rounded-lg border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-50 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setSendOptionsModalOpen(false); setSendOptionsMessage(''); setSendOptionsDepositPct(''); }}
                  disabled={sendOptionsSending}
                  className="flex-1 rounded-lg bg-surface-container-low py-3 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSendEstimateOptions()}
                  disabled={sendOptionsSending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-headline font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {sendOptionsSending ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                      Sending…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">send</span>
                      Send
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SharedLayout>
  );
}
