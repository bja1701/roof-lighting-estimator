import React from 'react';
import { Profile } from '../hooks/useProfile';
import { isFreeTierEstimatorExhausted } from '../utils/estimatorAccess';

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
  created_at: string;
}

interface Props {
  quote: Quote;
  profile: Profile | null;
  onDelete: () => void;
  onEdit: () => void;
}

export default function QuoteCard({ quote, profile, onDelete, onEdit }: Props) {
  const estimatorLocked = isFreeTierEstimatorExhausted(profile);

  return (
    <div className="bg-surface-container-lowest p-1 rounded-xl shadow-sm border border-outline-variant/10 hover:shadow-md transition-shadow group">
      <div className="p-6">
        {/* Header row */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[10px] font-label uppercase tracking-wider font-bold">
              Draft
            </span>
            <h3 className="text-2xl font-headline font-bold text-on-surface mt-3">{quote.label}</h3>
            <p className="text-xs text-on-surface-variant mt-1">
              {new Date(quote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          {/* Action icons — fade in on hover */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onEdit}
              disabled={estimatorLocked}
              className="p-2 rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary-container disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
              title={
                estimatorLocked
                  ? 'Free estimate limit reached (5/5). Upgrade to edit in the estimator.'
                  : 'Edit in estimator'
              }
            >
              <span className="material-symbols-outlined text-sm">edit</span>
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-error transition-colors"
              title="Delete estimate"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
        </div>

        {/* Totals footer */}
        <div className="flex justify-between items-end pt-6 border-t border-slate-100">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-label">Total Footage</p>
            <p className="text-lg font-headline font-bold text-on-surface">{(quote.total_linear_ft ?? 0).toFixed(1)} ft</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-label">Estimated Total</p>
            <p className="text-4xl font-headline font-black text-primary-container tracking-tight">${(quote.total_price ?? 0).toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
