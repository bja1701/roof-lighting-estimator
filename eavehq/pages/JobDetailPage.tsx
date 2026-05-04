import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, MapPin, FileText, User, MailCheck, Eye, CheckCircle,
  ArrowRight, Send, AlertTriangle, Plus, Pencil, Trash2, Loader2, StickyNote,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const NOTIFY_FINAL_PAYMENT_URL =
  'https://bsbewwwflqjlxxovjgec.supabase.co/functions/v1/notify-final-payment';
const SEND_ESTIMATE_OPTIONS_URL =
  'https://bsbewwwflqjlxxovjgec.supabase.co/functions/v1/send-estimate-options';

import { useProfile, useProfileVisibilityRefetch } from '../hooks/useProfile';
import { useToast } from '../hooks/useToast';
import { isFreeTierEstimatorExhausted } from '../utils/estimatorAccess';
import SharedLayout from '../components/SharedLayout';
import QuoteCard from '../components/QuoteCard';
import JobStatusBadge from '../components/JobStatusBadge';
import JobStreetViewImage from '../components/JobStreetViewImage';
import { Job, JobStatus } from '../types/job';
import { JOB_STATUS_CONFIG } from '../utils/jobStatus';

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diffMs / 60_000);
  if (mins < 60)  return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 8)   return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

interface ConfirmDialog {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

export default function JobDetailPage() {
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile }  = useProfile();
  const { toast }    = useToast();
  useProfileVisibilityRefetch();

  const [job, setJob]       = useState<Job | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading]     = useState(true);
  const [deleting, setDeleting]   = useState(false);
  const [advancingStatus, setAdvancingStatus] = useState(false);

  const [depositEditValue, setDepositEditValue] = useState('');
  const [depositEditing, setDepositEditing]     = useState(false);
  const [depositSaving, setDepositSaving]       = useState(false);
  const [depositError, setDepositError]         = useState<string | null>(null);

  const [sendOptionsOpen, setSendOptionsOpen]           = useState(false);
  const [sendOptionsMessage, setSendOptionsMessage]     = useState('');
  const [sendOptionsDepositPct, setSendOptionsDepositPct] = useState('');
  const [sendOptionsSending, setSendOptionsSending]     = useState(false);
  const [sendOptionsError, setSendOptionsError]         = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);

  const handleStatusChange = (newStatus: JobStatus) =>
    setJob(prev => prev ? { ...prev, status: newStatus } : prev);

  const handleJobUpdate = (updates: Partial<Job>) =>
    setJob(prev => prev ? { ...prev, ...updates } : prev);

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
      setDepositError('Enter 1–100.');
      return;
    }
    setDepositSaving(true);
    const { error } = await supabase.from('jobs').update({ deposit_percent: parsed }).eq('id', id);
    setDepositSaving(false);
    if (error) { setDepositError(error.message); return; }
    handleJobUpdate({ deposit_percent: parsed });
    setDepositEditing(false);
    setDepositError(null);
  };

  const handleDepositKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  handleDepositSave();
    if (e.key === 'Escape') setDepositEditing(false);
  };

  const handleOpenSendOptions = () => {
    setSendOptionsDepositPct(String(job?.deposit_percent ?? 50));
    setSendOptionsError(null);
    setSendOptionsOpen(true);
  };

  const handleSendEstimateOptions = async () => {
    if (!id) return;
    const parsedPct = parseInt(sendOptionsDepositPct, 10);
    if (isNaN(parsedPct) || parsedPct < 1 || parsedPct > 100) {
      setSendOptionsError('Enter a deposit percentage between 1 and 100.');
      return;
    }
    setSendOptionsSending(true);
    setSendOptionsError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(SEND_ESTIMATE_OPTIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          job_id: id,
          deposit_percentage: parsedPct,
          ...(sendOptionsMessage.trim() ? { custom_message: sendOptionsMessage.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('send-estimate-options failed:', errData);
      }
      await supabase.from('jobs').update({ deposit_percent: parsedPct }).eq('id', id);
      handleJobUpdate({ deposit_percent: parsedPct });
      setSendOptionsOpen(false);
      setSendOptionsMessage('');
      setSendOptionsDepositPct('');
      toast('Estimate options sent to client', 'success');
    } catch (err) {
      setSendOptionsError(err instanceof Error ? err.message : 'Failed to send estimate options');
    } finally {
      setSendOptionsSending(false);
    }
  };

  const handleAdvanceStatus = async () => {
    if (!job || !id) return;
    const cfg = JOB_STATUS_CONFIG[job.status];
    if (!cfg.nextManualStatus) return;

    const doAdvance = async (nextStatus: JobStatus) => {
      if (job.status === 'in_progress' && nextStatus === 'complete') {
        setAdvancingStatus(true);
        try {
          if (job.final_paid_at != null) {
            const { error } = await supabase.from('jobs').update({ status: 'complete' }).eq('id', id);
            if (error) throw new Error(error.message);
          } else {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Not authenticated');
            const res = await fetch(NOTIFY_FINAL_PAYMENT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ job_id: id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to mark complete');
          }
          handleStatusChange('complete');
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Failed to mark complete', 'error');
        } finally {
          setAdvancingStatus(false);
        }
        return;
      }
      setAdvancingStatus(true);
      const { error } = await supabase.from('jobs').update({ status: nextStatus }).eq('id', id);
      setAdvancingStatus(false);
      if (error) { toast(error.message, 'error'); return; }
      handleStatusChange(nextStatus);
    };

    const nextStatus = cfg.nextManualStatus;
    const isStartedTransition = job.status === 'scheduled' && nextStatus === 'in_progress';
    if (isStartedTransition && quotes.length === 0) return;

    if (
      job.status === 'estimate_sent' && nextStatus === 'scheduled' &&
      !job.deposit_paid_at && job.deposit_amount == null
    ) {
      setConfirmDialog({
        title: 'No deposit recorded',
        message: 'No deposit has been recorded for this job. Mark as Scheduled anyway?',
        confirmLabel: cfg.nextManualLabel ?? 'Continue',
        onConfirm: () => { setConfirmDialog(null); doAdvance(nextStatus); },
      });
      return;
    }

    doAdvance(nextStatus);
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

  const handleDeleteQuote = (quoteId: string, quoteLabel: string) => {
    setConfirmDialog({
      title: 'Delete estimate?',
      message: `"${quoteLabel}" will be removed permanently.`,
      confirmLabel: 'Delete estimate',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        await supabase.from('quotes').delete().eq('id', quoteId);
        setQuotes(q => q.filter(x => x.id !== quoteId));
        toast('Estimate deleted', 'success');
      },
    });
  };

  const handleDeleteJob = () => {
    if (!job || !id) return;
    const n = quotes.length;
    setConfirmDialog({
      title: `Delete "${job.name}"?`,
      message: n > 0
        ? `This also deletes ${n} saved estimate${n === 1 ? '' : 's'}. This cannot be undone.`
        : 'This cannot be undone.',
      confirmLabel: 'Delete job',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setDeleting(true);
        const { error } = await supabase.from('jobs').delete().eq('id', id);
        setDeleting(false);
        if (error) { toast(error.message, 'error'); return; }
        navigate('/');
      },
    });
  };

  const handleOpenEstimator = (quote?: Quote) => {
    if (isFreeTierEstimatorExhausted(profile)) return;
    if (quote?.canvas_state) {
      const state = { ...quote.canvas_state };
      if (job?.address && !state.estimateSiteAddress) state.estimateSiteAddress = job.address;
      sessionStorage.setItem('restore_quote', JSON.stringify({ quoteId: quote.id, jobId: id, canvasState: state, label: quote.label }));
    } else {
      sessionStorage.setItem('restore_quote', JSON.stringify({ jobId: id }));
    }
    navigate('/estimator');
  };

  const totalValue = quotes.reduce((sum, q) => sum + (q.total_price ?? 0), 0);
  const totalFt    = quotes.reduce((sum, q) => sum + (q.total_linear_ft ?? 0), 0);
  const canEstimate = !isFreeTierEstimatorExhausted(profile);

  if (loading) {
    return (
      <SharedLayout>
        <div className="flex items-center justify-center gap-2 py-32" style={{ color: 'var(--color-slate)' }}>
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </SharedLayout>
    );
  }

  if (!job) {
    return (
      <SharedLayout>
        <div className="flex items-center justify-center py-32 text-sm" style={{ color: 'var(--color-slate)' }}>
          Job not found.
        </div>
      </SharedLayout>
    );
  }

  const cfg = JOB_STATUS_CONFIG[job.status];
  const showAdvance = cfg.nextManualStatus && cfg.nextManualLabel &&
    !(job.status === 'scheduled' && cfg.nextManualStatus === 'in_progress' && quotes.length === 0);

  return (
    <SharedLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 pb-20 pt-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 transition-colors"
            style={{ color: 'var(--color-slate)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-slate)')}
          >
            <ChevronLeft size={16} />
            Jobs
          </button>
          <span style={{ color: 'var(--color-border)' }}>/</span>
          <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>{job.name}</span>
        </nav>

        {/* Job header */}
        {job.address ? (
          <section
            className="relative mb-5 min-h-[220px] overflow-hidden rounded-2xl"
            style={{ border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}
          >
            <JobStreetViewImage
              address={job.address}
              jobName={job.name}
              mapsApiKey={mapsApiKey}
              width={640}
              height={360}
              className="absolute inset-0 h-full w-full"
              imageClassName="absolute inset-0 h-full w-full object-cover"
              fallbackClassName="absolute inset-0"
              fallbackIconSize={44}
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, rgba(31,61,44,0.92) 0%, rgba(31,61,44,0.72) 48%, rgba(31,61,44,0.18) 100%)',
              }}
            />
            <div className="relative flex min-h-[220px] max-w-2xl flex-col justify-end p-5 sm:p-6">
              <h1
                className="mb-3 text-4xl font-black leading-tight tracking-tight sm:text-5xl"
                style={{ fontFamily: 'var(--font-display)', color: '#f7f3ea' }}
              >
                {job.name}
              </h1>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm" style={{ color: 'rgba(247,243,234,0.84)' }}>
                <span className="flex items-center gap-1.5"><MapPin size={14} />{job.address}</span>
                {job.notes && (
                  <span className="flex items-center gap-1.5"><StickyNote size={14} /><em>{job.notes}</em></span>
                )}
                {(job.client_name || job.client_email || job.client_phone) && (
                  <span className="flex items-center gap-1.5">
                    <User size={14} />
                    {[job.client_name, job.client_email, job.client_phone].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            </div>
          </section>
        ) : (
          <div className="mb-4">
            <h1
              className="text-4xl font-black tracking-tight leading-tight mb-2"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}
            >
              {job.name}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: 'var(--color-slate)' }}>
              {job.notes && (
                <span className="flex items-center gap-1"><StickyNote size={13} /><em>{job.notes}</em></span>
              )}
              {(job.client_name || job.client_email || job.client_phone) && (
                <span className="flex items-center gap-1">
                  <User size={13} />
                  {[job.client_name, job.client_email, job.client_phone].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Status pills */}
        <div className="flex flex-wrap gap-2 items-center mb-4">
          {job.status !== 'estimate_sent' && <JobStatusBadge status={job.status} />}

          {job.estimate_sent_at != null && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-slate)' }}
            >
              <MailCheck size={12} />
              Sent {new Date(job.estimate_sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          {job.client_opened_at != null && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(61,158,106,0.1)', border: '1px solid rgba(61,158,106,0.28)', color: 'var(--color-success)' }}
            >
              <Eye size={12} />
              Client opened {timeAgo(job.client_opened_at)}
            </span>
          )}
          {job.estimate_sent_at != null && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(217,111,10,0.1)', border: '1px solid rgba(217,111,10,0.22)', color: 'var(--color-accent)' }}
            >
              <Send size={12} />
              {job.followup_count ?? 0} follow-up{(job.followup_count ?? 0) === 1 ? '' : 's'}
            </span>
          )}
          {job.deposit_paid_at != null && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(61,158,106,0.1)', border: '1px solid rgba(61,158,106,0.28)', color: 'var(--color-success)' }}
            >
              <CheckCircle size={12} />
              Deposit {new Date(job.deposit_paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {job.deposit_amount != null && ` · $${job.deposit_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
          )}
          {job.final_paid_at != null && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(61,158,106,0.1)', border: '1px solid rgba(61,158,106,0.28)', color: 'var(--color-success)' }}
            >
              <CheckCircle size={12} />
              Final paid {new Date(job.final_paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {job.final_amount != null && ` · $${job.final_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
          )}
        </div>

        {/* Advance status button */}
        {showAdvance && (
          <div className="mb-6">
            <button
              type="button"
              onClick={handleAdvanceStatus}
              disabled={advancingStatus}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {advancingStatus ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              {advancingStatus ? 'Saving…' : cfg.nextManualLabel}
            </button>
          </div>
        )}

        {/* Client actions bar */}
        {(quotes.length > 0 || job.portal_token) && (
          <div
            className="flex flex-wrap gap-3 items-center mb-8 p-4 rounded-xl"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
          >
            {/* Deposit % */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-slate)' }}>
                Deposit
              </span>
              {depositEditing ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min={1} max={100}
                    value={depositEditValue}
                    onChange={e => setDepositEditValue(e.target.value)}
                    onBlur={handleDepositSave}
                    onKeyDown={handleDepositKeyDown}
                    autoFocus
                    className="w-14 rounded-md px-2 py-1 text-sm font-bold outline-none"
                    style={{ border: '1.5px solid var(--color-primary)', color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--color-slate)' }}>%</span>
                  {depositSaving && <span className="text-xs" style={{ color: 'var(--color-slate)' }}>Saving…</span>}
                  {depositError && <span className="text-xs" style={{ color: 'var(--color-destructive)' }}>{depositError}</span>}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDepositEditStart}
                  className="inline-flex items-center gap-1 font-bold text-sm transition-colors"
                  style={{ color: 'var(--color-ink)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-ink)')}
                >
                  {job.deposit_percent ?? 50}%
                  <Pencil size={12} style={{ color: 'var(--color-slate)' }} />
                </button>
              )}
            </div>

            <div className="w-px h-5 self-center" style={{ background: 'var(--color-border)' }} />

            {quotes.length > 0 && (
              <button
                type="button"
                onClick={handleOpenSendOptions}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity flex-1 sm:flex-none"
                style={{ background: 'var(--color-primary)', color: '#fff' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <Send size={14} />
                Send Options to Client
              </button>
            )}

            {job.portal_token && (
              <a
                href={`/invoice/${job.portal_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
                style={{ color: 'var(--color-slate)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-slate)')}
              >
                <FileText size={14} />
                View Invoice
              </a>
            )}

            {job.deposit_paid_at == null && !profile?.stripe_connect_enabled && (
              <a
                href="/settings"
                className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 transition-colors"
                style={{ background: '#fff8f0', border: '1px solid var(--color-warning)', color: 'var(--color-warning)' }}
              >
                <AlertTriangle size={12} />
                Connect Stripe
                <ArrowRight size={12} />
              </a>
            )}
          </div>
        )}

        {/* Stats — only shown when there are estimates */}
        {quotes.length > 0 && (
          <div
            className="grid grid-cols-3 gap-px mb-8 rounded-xl overflow-hidden"
            style={{ background: 'var(--color-border)' }}
          >
            {[
              { label: 'Estimates', value: String(quotes.length) },
              { label: 'Total Value', value: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
              { label: 'Linear Ft', value: `${totalFt.toFixed(0)} ft` },
            ].map(({ label, value }) => (
              <div key={label} className="px-5 py-4" style={{ background: 'var(--color-card)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-slate)' }}>
                  {label}
                </p>
                <p
                  className="text-xl font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Estimates section */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
            Estimates
          </h2>
          <button
            type="button"
            onClick={() => handleOpenEstimator()}
            disabled={!canEstimate}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
            onMouseEnter={e => { if (canEstimate) e.currentTarget.style.opacity = '0.88'; }}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Plus size={15} />
            New Estimate
          </button>
        </div>

        {quotes.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 rounded-xl mb-10"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--color-surface)' }}>
              <FileText size={22} style={{ color: 'var(--color-border)' }} />
            </div>
            <h3 className="font-semibold text-base mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
              No estimates yet
            </h3>
            <p className="text-sm mb-5" style={{ color: 'var(--color-slate)' }}>
              Open the estimator to trace rooflines and save an estimate
            </p>
            <button
              onClick={() => handleOpenEstimator()}
              disabled={!canEstimate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
              onMouseEnter={e => { if (canEstimate) e.currentTarget.style.opacity = '0.88'; }}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <Plus size={15} />
              Open Estimator
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {quotes.map(quote => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                profile={profile}
                jobId={id!}
                onDelete={() => handleDeleteQuote(quote.id, quote.label)}
                onEdit={() => handleOpenEstimator(quote)}
                onDiscountChange={(qId, amount, type) =>
                  setQuotes(qs => qs.map(q => q.id === qId ? { ...q, discount_amount: amount, discount_type: type } : q))
                }
              />
            ))}
          </div>
        )}

        {/* Danger zone */}
        <div className="pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-slate)' }}>
            Danger zone
          </p>
          <button
            type="button"
            onClick={handleDeleteJob}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: 'transparent', border: '1px solid var(--color-destructive)', color: 'var(--color-destructive)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,64,64,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            {deleting ? 'Deleting…' : 'Delete job'}
          </button>
        </div>
      </div>

      {/* Send Options modal */}
      {sendOptionsOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ background: 'rgba(31,61,44,0.75)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="send-options-title"
          onClick={e => e.target === e.currentTarget && !sendOptionsSending && setSendOptionsOpen(false)}
        >
          <div className="w-full max-w-md rounded-xl overflow-hidden" style={{ background: 'var(--color-card)', boxShadow: 'var(--shadow-modal)' }}>
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(58,99,73,0.1)' }}>
                  <Send size={18} style={{ color: 'var(--color-primary)' }} />
                </div>
                <h2 id="send-options-title" className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
                  Send options to client
                </h2>
              </div>

              <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--color-slate)' }}>
                Sending <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>{quotes.length} estimate{quotes.length !== 1 ? 's' : ''}</span> to{' '}
                <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>{job.client_email ?? 'the client'}</span>.
              </p>

              <div className="rounded-lg px-4 py-3 mb-4 space-y-1" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                {quotes.map(q => (
                  <p key={q.id} className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
                    {q.label}{q.total_price != null ? ` — $${q.total_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                  </p>
                ))}
              </div>

              <div className="mb-4">
                <label htmlFor="deposit-pct" className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-slate)' }}>
                  Deposit required (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="deposit-pct"
                    type="number" min={1} max={100}
                    value={sendOptionsDepositPct}
                    onChange={e => setSendOptionsDepositPct(e.target.value)}
                    disabled={sendOptionsSending}
                    placeholder="50"
                    className="w-24 rounded-lg px-3 py-2 text-sm outline-none transition-all disabled:opacity-50"
                    style={{ border: '1.5px solid var(--color-border)', color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                  />
                  <span className="text-sm" style={{ color: 'var(--color-slate)' }}>%</span>
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="custom-message" className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-slate)' }}>
                  Message (optional)
                </label>
                <textarea
                  id="custom-message"
                  rows={3}
                  value={sendOptionsMessage}
                  onChange={e => setSendOptionsMessage(e.target.value)}
                  disabled={sendOptionsSending}
                  placeholder="Add a note for the client…"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none transition-all disabled:opacity-50"
                  style={{ border: '1.5px solid var(--color-border)', color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                />
              </div>

              {sendOptionsError && (
                <p className="text-sm mb-3" style={{ color: 'var(--color-destructive)' }}>{sendOptionsError}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setSendOptionsOpen(false); setSendOptionsMessage(''); setSendOptionsDepositPct(''); setSendOptionsError(null); }}
                  disabled={sendOptionsSending}
                  className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ background: 'var(--color-surface)', color: 'var(--color-slate)', border: '1px solid var(--color-border)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSendEstimateOptions()}
                  disabled={sendOptionsSending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  {sendOptionsSending ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <><Send size={15} /> Send</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generic inline confirm dialog */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ background: 'rgba(31,61,44,0.75)' }}
          role="dialog"
          aria-modal="true"
          onClick={e => e.target === e.currentTarget && setConfirmDialog(null)}
        >
          <div className="w-full max-w-sm rounded-xl p-6" style={{ background: 'var(--color-card)', boxShadow: 'var(--shadow-modal)' }}>
            <h2 className="text-base font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
              {confirmDialog.title}
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--color-slate)' }}>
              {confirmDialog.message}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="flex-1 rounded-lg py-2.5 text-sm font-medium"
                style={{ background: 'var(--color-surface)', color: 'var(--color-slate)', border: '1px solid var(--color-border)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-opacity"
                style={confirmDialog.danger
                  ? { background: 'var(--color-destructive)', color: '#fff' }
                  : { background: 'var(--color-primary)', color: '#fff' }
                }
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </SharedLayout>
  );
}
