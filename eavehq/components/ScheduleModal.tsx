/**
 * ScheduleModal
 * Modal for picking a scheduled date + optional start/end times for a job.
 * Used from JobDetailPage when advancing status to "scheduled", and from
 * the schedule popover "Reschedule" action.
 */
import React, { useEffect, useState } from 'react';
import { Loader2, X, Calendar, Clock } from 'lucide-react';

export interface ScheduleValues {
  date: string;          // ISO date string "YYYY-MM-DD"
  startTime: string;     // "HH:MM" 24h, or ""
  endTime: string;       // "HH:MM" 24h, or ""
  anytime: boolean;
}

interface Props {
  open: boolean;
  initialValues?: Partial<ScheduleValues>;
  saving?: boolean;
  onConfirm: (values: ScheduleValues) => void;
  onCancel: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

export default function ScheduleModal({ open, initialValues, saving, onConfirm, onCancel }: Props) {
  const [date, setDate]           = useState(initialValues?.date ?? today());
  const [startTime, setStartTime] = useState(initialValues?.startTime ?? '');
  const [endTime, setEndTime]     = useState(initialValues?.endTime ?? '');
  const [anytime, setAnytime]     = useState(initialValues?.anytime ?? false);
  const [error, setError]         = useState<string | null>(null);

  // Sync with external initial values when modal opens
  useEffect(() => {
    if (!open) return;
    setDate(initialValues?.date ?? today());
    setStartTime(initialValues?.startTime ?? '');
    setEndTime(initialValues?.endTime ?? '');
    setAnytime(initialValues?.anytime ?? false);
    setError(null);
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    if (!date) { setError('Date is required.'); return; }
    if (!anytime && endTime && startTime && endTime <= startTime) {
      setError('End time must be after start time.');
      return;
    }
    setError(null);
    onConfirm({
      date,
      startTime: anytime ? '' : startTime,
      endTime: anytime ? '' : endTime,
      anytime,
    });
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(26,26,26,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
  };
  const cardStyle: React.CSSProperties = {
    background: 'var(--color-card)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-modal)',
    width: '100%',
    maxWidth: '380px',
    padding: '1.5rem',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface)',
    color: 'var(--color-ink)',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-body)',
    outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--color-slate)',
    marginBottom: '5px',
  };

  return (
    <div style={overlayStyle} onClick={onCancel} aria-modal role="dialog">
      <div style={cardStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.125rem', color: 'var(--color-ink)' }}>
            Schedule Job
          </h2>
          <button onClick={onCancel} style={{ color: 'var(--color-slate)', lineHeight: 1 }}>
            <X size={18} />
          </button>
        </div>

        {/* Date */}
        <div className="mb-4">
          <label style={labelStyle}>
            <span className="inline-flex items-center gap-1.5"><Calendar size={11} />Date</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Anytime toggle */}
        <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={anytime}
            onChange={e => setAnytime(e.target.checked)}
            className="w-4 h-4 rounded"
            style={{ accentColor: 'var(--color-primary)' }}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
            All day / anytime
          </span>
        </label>

        {/* Times */}
        {!anytime && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label style={labelStyle}>
                <span className="inline-flex items-center gap-1.5"><Clock size={11} />Start</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                <span className="inline-flex items-center gap-1.5"><Clock size={11} />End</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs mb-3" style={{ color: 'var(--color-destructive)' }}>{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--color-surface)', color: 'var(--color-slate)', border: '1px solid var(--color-border)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !date}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--color-primary)', color: '#fff' }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
