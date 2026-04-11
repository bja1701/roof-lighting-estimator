import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Job, JobStatus } from '../types/job';
import { JOB_STATUS_CONFIG } from '../utils/jobStatus';

interface Props {
  job: Job;
  onStatusChange: (newStatus: JobStatus) => void;
  onJobUpdate: (updates: Partial<Job>) => void;
}

const btnPrimary = 'flex items-center gap-2 amber-gradient text-white font-headline font-bold py-3 px-6 rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm';
const btnSecondary = 'flex items-center gap-2 bg-surface-container-low text-on-surface font-bold py-3 px-5 rounded-lg hover:bg-surface-container transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed';
const inputCls = 'px-3 py-2 bg-surface-container-low border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-sm transition-all';

export default function PaymentSection({ job, onStatusChange, onJobUpdate }: Props) {
  const [depositPercent, setDepositPercent] = useState(job.deposit_percent ?? 50);
  const [generating, setGenerating] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [copied, setCopied] = useState<'deposit' | 'final' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusConfig = JOB_STATUS_CONFIG[job.status] ?? JOB_STATUS_CONFIG['estimate_sent'];

  const handleGenerateLink = async (type: 'deposit' | 'final') => {
    setGenerating(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-payment-link', {
        body: { jobId: job.id, depositPercent, type },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      const url: string = data.url;
      if (type === 'deposit') {
        onJobUpdate({ stripe_deposit_link: url, deposit_percent: depositPercent });
      } else {
        onJobUpdate({ stripe_final_link: url });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (url: string, type: 'deposit' | 'final') => {
    await navigator.clipboard.writeText(url);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleAdvanceStatus = async () => {
    const next = statusConfig.nextManualStatus;
    if (!next) return;
    setAdvancing(true);
    setError(null);
    const { error: dbError } = await supabase
      .from('jobs')
      .update({ status: next })
      .eq('id', job.id);
    setAdvancing(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    onStatusChange(next);
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6 space-y-5">
      <h2 className="font-headline font-bold text-lg text-on-surface flex items-center gap-2">
        <span className="material-symbols-outlined text-primary-container">payments</span>
        Payment
      </h2>

      {error && (
        <div className="bg-error-container/30 border-l-4 border-error p-3 rounded-r-lg">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Deposit Link */}
      <div className="space-y-3">
        <p className="text-[11px] font-label font-bold uppercase tracking-wider text-on-surface-variant">Deposit Link</p>

        {!job.stripe_deposit_link ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-label uppercase tracking-wider text-on-surface-variant mb-1">Deposit %</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={depositPercent}
                  onChange={e => setDepositPercent(Number(e.target.value))}
                  className={`${inputCls} w-20`}
                />
                <span className="text-sm text-on-surface-variant">%</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleGenerateLink('deposit')}
              disabled={generating}
              className={btnPrimary}
            >
              <span className="material-symbols-outlined text-lg">
                {generating ? 'progress_activity' : 'link'}
              </span>
              {generating ? 'Generating…' : 'Generate Deposit Link'}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-surface-container-low rounded-lg">
            <span className="material-symbols-outlined text-green-600">check_circle</span>
            <a
              href={job.stripe_deposit_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-sm text-primary underline underline-offset-2 truncate"
            >
              {job.stripe_deposit_link}
            </a>
            <button
              type="button"
              onClick={() => handleCopy(job.stripe_deposit_link!, 'deposit')}
              className={btnSecondary}
            >
              <span className="material-symbols-outlined text-base">
                {copied === 'deposit' ? 'check' : 'content_copy'}
              </span>
              {copied === 'deposit' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}

        {job.deposit_amount != null && (
          <p className="text-xs text-on-surface-variant">
            Deposit: <span className="font-semibold text-on-surface">${job.deposit_amount.toFixed(2)}</span>
            {job.final_amount != null && (
              <> · Remaining: <span className="font-semibold text-on-surface">${job.final_amount.toFixed(2)}</span></>
            )}
          </p>
        )}
      </div>

      {/* Final Payment Link — shown only after job is complete or link already exists */}
      {(job.status === 'complete' || job.stripe_final_link) && (
        <div className="space-y-3 border-t border-outline-variant/20 pt-4">
          <p className="text-[11px] font-label font-bold uppercase tracking-wider text-on-surface-variant">Final Payment Link</p>
          {!job.stripe_final_link ? (
            <button
              type="button"
              onClick={() => handleGenerateLink('final')}
              disabled={generating}
              className={btnPrimary}
            >
              <span className="material-symbols-outlined text-lg">
                {generating ? 'progress_activity' : 'link'}
              </span>
              {generating ? 'Generating…' : 'Generate Final Payment Link'}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 p-3 bg-surface-container-low rounded-lg">
              <span className="material-symbols-outlined text-green-600">check_circle</span>
              <a
                href={job.stripe_final_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-sm text-primary underline underline-offset-2 truncate"
              >
                {job.stripe_final_link}
              </a>
              <button
                type="button"
                onClick={() => handleCopy(job.stripe_final_link!, 'final')}
                className={btnSecondary}
              >
                <span className="material-symbols-outlined text-base">
                  {copied === 'final' ? 'check' : 'content_copy'}
                </span>
                {copied === 'final' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stage Advance */}
      {statusConfig.nextManualStatus && (
        <div className="border-t border-outline-variant/20 pt-4">
          <button
            type="button"
            onClick={handleAdvanceStatus}
            disabled={advancing}
            className={btnSecondary}
          >
            <span className="material-symbols-outlined text-base">
              {advancing ? 'progress_activity' : 'arrow_forward'}
            </span>
            {advancing ? 'Updating…' : statusConfig.nextManualLabel}
          </button>
        </div>
      )}
    </div>
  );
}
