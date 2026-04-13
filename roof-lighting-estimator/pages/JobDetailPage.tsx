import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useProfile } from '../hooks/useProfile';
import { isFreeTierEstimatorExhausted } from '../utils/estimatorAccess';
import SharedLayout from '../components/SharedLayout';
import QuoteCard from '../components/QuoteCard';
import ClientQuoteModal from '../components/ClientQuoteModal';
import JobStatusBadge from '../components/JobStatusBadge';
import PaymentSection from '../components/PaymentSection';
import { Job, JobStatus } from '../types/job';

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
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [job, setJob] = useState<Job | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [clientQuoteOpen, setClientQuoteOpen] = useState(false);

  const handleStatusChange = (newStatus: JobStatus) => {
    setJob(prev => prev ? { ...prev, status: newStatus } : prev);
  };

  const handleJobUpdate = (updates: Partial<Job>) => {
    setJob(prev => prev ? { ...prev, ...updates } : prev);
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
        {/* Breadcrumb + Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
          <div className="space-y-4">
            <nav className="flex items-center gap-2 text-on-surface-variant text-sm font-label uppercase tracking-widest">
              <button onClick={() => navigate('/')} className="hover:text-primary transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Jobs
              </button>
              <span>/</span>
              <span className="text-on-surface font-bold">{job.name}</span>
            </nav>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-5xl font-headline font-extrabold text-on-surface tracking-tight leading-none">{job.name}</h1>
              <JobStatusBadge status={job.status ?? 'estimate_sent'} />
            </div>
            <div className="flex flex-wrap gap-5 items-center text-on-surface-variant">
              {job.address && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary-container">location_on</span>
                  <span>{job.address}</span>
                </div>
              )}
              {job.notes && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary-container">sticky_note_2</span>
                  <span className="italic">{job.notes}</span>
                </div>
              )}
              {(job.client_name || job.client_email || job.client_phone) && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary-container">person</span>
                  <span>{[job.client_name, job.client_email, job.client_phone].filter(Boolean).join(' · ')}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={handleDeleteJob}
              disabled={deleting}
              className="order-3 flex items-center justify-center gap-2 rounded-lg border border-error/40 bg-surface-container-lowest py-3 px-5 font-label text-sm font-bold uppercase tracking-wider text-error transition-colors hover:bg-error-container/20 disabled:opacity-50 sm:order-1"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              {deleting ? 'Deleting…' : 'Delete job'}
            </button>
            <button
              type="button"
              onClick={() => setClientQuoteOpen(true)}
              disabled={quotes.length === 0}
              title={quotes.length === 0 ? 'Save at least one estimate first' : 'Build a PDF for your client'}
              className="order-2 flex items-center justify-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest py-3 px-5 font-headline text-sm font-bold text-on-surface shadow-sm transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-45 sm:order-2"
            >
              <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
              Client quote
            </button>
            <button
              type="button"
              onClick={() => handleOpenEstimator()}
              disabled={!canEstimate}
              className="order-1 amber-gradient flex items-center justify-center gap-3 rounded-lg py-4 px-8 font-headline font-bold text-white shadow-lg transition-all hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:order-3"
            >
              <span className="material-symbols-outlined">add</span>
              New Estimate
            </button>
          </div>
        </div>

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

        {/* Payment Section */}
        <div className="mb-12">
          <PaymentSection
            job={job}
            onStatusChange={handleStatusChange}
            onJobUpdate={handleJobUpdate}
          />
        </div>

        {/* Quotes grid */}
        {quotes.length === 0 ? (
          <div className="text-center py-24 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {quotes.map(quote => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                profile={profile}
                onDelete={() => handleDeleteQuote(quote.id)}
                onEdit={() => handleOpenEstimator(quote)}
              />
            ))}
          </div>
        )}
      </div>

      <ClientQuoteModal
        open={clientQuoteOpen}
        onClose={() => setClientQuoteOpen(false)}
        job={{ name: job.name, address: job.address }}
        quotes={quotes}
        profile={profile}
      />
    </SharedLayout>
  );
}
