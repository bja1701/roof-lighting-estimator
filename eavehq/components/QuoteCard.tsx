import React, { useState } from 'react';
import { Profile } from '../hooks/useProfile';
import { isFreeTierEstimatorExhausted } from '../utils/estimatorAccess';
import { calcDiscountedPrice, discountLabel } from '../utils/discount';
import { supabase } from '../lib/supabase';

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
  discount_amount?: number | null;
  discount_type?: string | null;
}

interface Props {
  quote: Quote;
  profile: Profile | null;
  jobId: string;
  onDelete: () => void;
  onEdit: () => void;
  onDiscountChange?: (quoteId: string, discountAmount: number | null, discountType: string | null) => void;
}

export default function QuoteCard({ quote, profile, jobId, onDelete, onEdit, onDiscountChange }: Props) {
  const estimatorLocked = isFreeTierEstimatorExhausted(profile);

  const [discountEditing, setDiscountEditing] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>(
    (quote.discount_type as 'percent' | 'flat') ?? 'percent'
  );
  const [discountValue, setDiscountValue] = useState<string>(
    quote.discount_amount != null ? String(quote.discount_amount) : ''
  );
  const [applyToAll, setApplyToAll] = useState(false);
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);

  const handleDiscountSave = async () => {
    setDiscountSaving(true);
    setDiscountError(null);

    const parsed = discountValue.trim() === '' ? null : parseFloat(discountValue);
    if (discountValue.trim() !== '' && (isNaN(parsed!) || parsed! < 0)) {
      setDiscountError('Enter a valid positive number.');
      setDiscountSaving(false);
      return;
    }
    if (parsed != null && discountType === 'percent' && parsed > 100) {
      setDiscountError('Percent discount cannot exceed 100.');
      setDiscountSaving(false);
      return;
    }

    const updates = {
      discount_amount: parsed,
      discount_type: parsed != null ? discountType : null,
    };

    const { error } = await supabase.from('quotes').update(updates).eq('id', quote.id);
    if (error) {
      setDiscountError(error.message);
      setDiscountSaving(false);
      return;
    }

    if (applyToAll && parsed != null) {
      await supabase
        .from('quotes')
        .update(updates)
        .eq('job_id', jobId)
        .neq('id', quote.id);
    }

    onDiscountChange?.(quote.id, parsed, parsed != null ? discountType : null);
    setDiscountEditing(false);
    setDiscountSaving(false);
  };

  const handleDiscountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void handleDiscountSave();
    if (e.key === 'Escape') setDiscountEditing(false);
  };

  const rawPrice = quote.total_price ?? 0;
  const currentDiscountAmount = quote.discount_amount ?? null;
  const currentDiscountType = quote.discount_type ?? null;
  const discountedPrice = calcDiscountedPrice(rawPrice, currentDiscountAmount, currentDiscountType);
  const hasDiscount = currentDiscountAmount != null && discountedPrice < rawPrice;

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

        {/* Discount section */}
        <div className="mb-4">
          {discountEditing ? (
            <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4 space-y-3">
              <p className="text-[10px] font-label uppercase tracking-wider text-on-surface-variant font-bold">Discount</p>
              <div className="flex items-center gap-2">
                {/* Type toggle */}
                <div className="flex bg-surface-container rounded-md overflow-hidden border border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`px-3 py-1.5 text-sm font-bold transition-colors ${discountType === 'percent' ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('flat')}
                    className={`px-3 py-1.5 text-sm font-bold transition-colors ${discountType === 'flat' ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    $
                  </button>
                </div>
                <input
                  type="number"
                  min={0}
                  step={discountType === 'percent' ? 1 : 0.01}
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  onKeyDown={handleDiscountKeyDown}
                  autoFocus
                  placeholder="0"
                  className="w-24 rounded-lg border border-outline-variant/40 bg-surface-container px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
                {discountValue.trim() !== '' && (
                  <button
                    type="button"
                    onClick={() => setDiscountValue('')}
                    className="text-xs text-on-surface-variant hover:text-error transition-colors"
                    title="Remove discount"
                  >
                    Clear
                  </button>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={e => setApplyToAll(e.target.checked)}
                  className="rounded border-outline-variant/40 text-primary focus:ring-primary-container"
                />
                <span className="text-xs text-on-surface-variant">Apply to all estimates on this job</span>
              </label>
              {discountError && (
                <p className="text-xs text-error">{discountError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDiscountEditing(false)}
                  disabled={discountSaving}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleDiscountSave()}
                  disabled={discountSaving}
                  className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {discountSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDiscountEditing(true)}
              className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-sm">sell</span>
              {hasDiscount && currentDiscountAmount != null && currentDiscountType != null
                ? discountLabel(currentDiscountAmount, currentDiscountType, rawPrice)
                : 'Add discount'}
            </button>
          )}
        </div>

        {/* Totals footer */}
        <div className="flex justify-between items-end pt-6 border-t border-slate-100">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-label">Total Footage</p>
            <p className="text-lg font-headline font-bold text-on-surface">{(quote.total_linear_ft ?? 0).toFixed(1)} ft</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-label">Estimated Total</p>
            {hasDiscount ? (
              <>
                <p className="text-sm text-on-surface-variant line-through">
                  ${rawPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-4xl font-headline font-black text-primary-container tracking-tight">
                  ${discountedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </>
            ) : (
              <p className="text-4xl font-headline font-black text-primary-container tracking-tight">
                ${rawPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
