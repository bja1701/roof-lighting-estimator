import React, { useEffect, useMemo, useState } from 'react';
import type { Profile } from '../hooks/useProfile';
import { buildClientQuotePdfHtml, printClientQuotePdf, type PdfJob, type PdfQuote } from '../utils/clientQuotePdf';

interface Props {
  open: boolean;
  onClose: () => void;
  job: PdfJob;
  quotes: PdfQuote[];
  profile: Profile | null;
}

export default function ClientQuoteModal({ open, onClose, job, quotes, profile }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [printHint, setPrintHint] = useState('');

  useEffect(() => {
    if (open) {
      setPrintHint('');
      if (quotes.length) setSelectedIds(new Set(quotes.map((q) => q.id)));
    }
  }, [open, quotes]);

  const orderedSelected = useMemo(() => {
    return quotes.filter((q) => selectedIds.has(q.id));
  }, [quotes, selectedIds]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(quotes.map((q) => q.id)));
  const clearAll = () => setSelectedIds(new Set());

  const handlePrint = () => {
    if (!orderedSelected.length) return;
    setPrintHint('');
    const html = buildClientQuotePdfHtml(job, profile, orderedSelected);
    if (!printClientQuotePdf(html)) {
      setPrintHint('Allow pop-ups for this site, then try again.');
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-inverse-surface/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-quote-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-lowest shadow-[0px_20px_40px_rgba(17,28,45,0.15)]">
        <div className="h-1 w-full amber-gradient" />
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 id="client-quote-title" className="font-headline text-xl font-bold text-on-surface">
                Client quote PDF
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Pick which estimates to include. One document—your client can compare options or save a single quote.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="rounded-lg bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-primary hover:bg-surface-container"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
            >
              Clear
            </button>
          </div>

          <ul className="mb-6 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-outline-variant/15 bg-surface-container-low/50 p-2">
            {quotes.map((q) => {
              const checked = selectedIds.has(q.id);
              return (
                <li key={q.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-container-lowest">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(q.id)}
                      className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary-container"
                    />
                    <span className="min-w-0 flex-1 font-medium text-on-surface">{q.label}</span>
                    <span className="shrink-0 text-sm font-bold text-primary-container">
                      ${(q.total_price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {orderedSelected.length === 0 && (
            <p className="mb-4 text-sm text-error">Select at least one estimate.</p>
          )}
          {printHint ? <p className="mb-4 text-sm text-error">{printHint}</p> : null}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-surface-container-low py-3 text-sm font-semibold text-on-surface-variant hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={orderedSelected.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg amber-gradient py-3 text-sm font-headline font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
              Preview &amp; print
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] text-on-surface-variant">
            Use your browser’s print dialog to save as PDF.
          </p>
        </div>
      </div>
    </div>
  );
}
