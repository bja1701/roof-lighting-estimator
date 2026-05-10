import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle, CreditCard, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calcDiscountedPrice, discountLabel } from '../utils/discount';

const EDGE_FN_URL =
  'https://bsbewwwflqjlxxovjgec.supabase.co/functions/v1/create-portal-checkout';

const FINAL_EDGE_FN_URL =
  'https://bsbewwwflqjlxxovjgec.supabase.co/functions/v1/create-final-checkout';

interface Quote {
  id: string;
  label: string;
  total_linear_ft: number | null;
  total_price: number | null;
  notes: string | null;
  discount_amount: number | null;
  discount_type: string | null;
  discount_note: string | null;
}

interface ContractorProfile {
  company_name: string | null;
  full_name: string | null;
  logo_url: string | null;
}

interface JobData {
  id: string;
  user_id: string;
  address: string | null;
  status: string;
  deposit_percent: number;
  deposit_amount: number | null;
  deposit_paid_at: string | null;
  portal_token: string | null;
}

export default function ClientPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const deepLinkedEstimateId = searchParams.get('estimate');

  const [job, setJob] = useState<JobData | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [contractor, setContractor] = useState<ContractorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payingFinal, setPayingFinal] = useState(false);
  const [payFinalError, setPayFinalError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    fetchPortalData(token);
  }, [token]);

  const fetchPortalData = async (portalToken: string) => {
    setLoading(true);
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('id, user_id, address, status, deposit_percent, deposit_amount, deposit_paid_at, portal_token')
      .eq('portal_token', portalToken)
      .single();

    if (jobError || !jobData) { setNotFound(true); setLoading(false); return; }
    setJob(jobData as JobData);

    const [{ data: quotesData }, { data: profileData }] = await Promise.all([
      supabase
        .from('quotes')
        .select('id, label, total_linear_ft, total_price, notes, discount_amount, discount_type, discount_note')
        .eq('job_id', jobData.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('company_name, full_name, logo_url')
        .eq('id', jobData.user_id)
        .single(),
    ]);

    const loadedQuotes = (quotesData as Quote[]) ?? [];
    setQuotes(loadedQuotes);
    setContractor((profileData as ContractorProfile) ?? null);
    if (loadedQuotes.length > 0) {
      const preSelected =
        deepLinkedEstimateId && loadedQuotes.some(q => q.id === deepLinkedEstimateId)
          ? deepLinkedEstimateId
          : loadedQuotes[0].id;
      setSelectedQuoteId(preSelected);
    }
    setLoading(false);
  };

  const selectedQuote = quotes.find(q => q.id === selectedQuoteId) ?? null;
  const selectedEffectivePrice =
    selectedQuote?.total_price != null
      ? calcDiscountedPrice(selectedQuote.total_price, selectedQuote.discount_amount, selectedQuote.discount_type)
      : null;
  const depositDollars =
    selectedEffectivePrice != null && job
      ? selectedEffectivePrice * (job.deposit_percent / 100)
      : null;
  const finalDollars =
    selectedEffectivePrice != null && job
      ? selectedEffectivePrice - (
          job.deposit_amount != null
            ? job.deposit_amount
            : selectedEffectivePrice * (job.deposit_percent / 100)
        )
      : null;

  const handlePayFinal = async () => {
    if (!selectedQuoteId || !token) return;
    setPayingFinal(true);
    setPayFinalError(null);
    try {
      const res = await fetch(FINAL_EDGE_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal_token: token, quote_id: selectedQuoteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed');
      if (!data.checkout_url) throw new Error('No checkout URL returned');
      window.location.href = data.checkout_url;
    } catch (err) {
      setPayFinalError(err instanceof Error ? err.message : String(err));
      setPayingFinal(false);
    }
  };

  const handlePayDeposit = async () => {
    if (!selectedQuoteId || !token) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal_token: token, quote_id: selectedQuoteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed');
      if (!data.checkout_url) throw new Error('No checkout URL returned');
      window.location.href = data.checkout_url;
    } catch (err) {
      setPayError(err instanceof Error ? err.message : String(err));
      setPaying(false);
    }
  };

  const depositPaidStatuses = ['deposit_paid', 'scheduled', 'in_progress', 'complete', 'final_paid'];
  const isDepositPaid = job ? depositPaidStatuses.includes(job.status) : false;
  const isFinalPaid = job?.status === 'final_paid';
  const isReadyForFinal = job?.status === 'complete';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
        <div
          className="w-8 h-8 rounded-full animate-spin"
          style={{ border: '2px solid var(--color-border)', borderTopColor: 'var(--color-accent)' }}
        />
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-surface)' }}>
        <div className="text-center max-w-sm">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'var(--color-border)' }}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--color-slate)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
            Quote link not found
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-slate)' }}>
            This quote link is no longer valid. Please contact your contractor for an updated link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)', fontFamily: 'var(--font-body)', color: 'var(--color-ink)' }}>
      {/* Header */}
      <header
        className="px-4 py-5"
        style={{ background: 'var(--color-card)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="max-w-lg mx-auto flex items-center gap-4">
          {contractor?.logo_url && (
            <img
              src={contractor.logo_url}
              alt="Company logo"
              className="h-12 w-12 object-contain rounded-lg flex-shrink-0"
            />
          )}
          <div>
            <p className="font-bold text-lg leading-tight" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
              {contractor?.company_name || contractor?.full_name || 'Your Contractor'}
            </p>
            {job.address && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-slate)' }}>{job.address}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Final paid banner */}
        {isFinalPaid && (
          <SuccessBanner>
            <p className="font-bold" style={{ color: '#1a5c38' }}>Final payment received</p>
            <p className="text-sm mt-0.5" style={{ color: '#2d7a50' }}>
              Thank you — your account is settled in full!
            </p>
          </SuccessBanner>
        )}

        {/* Deposit paid, waiting for install */}
        {isDepositPaid && !isReadyForFinal && !isFinalPaid && (
          <SuccessBanner>
            <p className="font-bold" style={{ color: '#1a5c38' }}>Deposit received</p>
            <p className="text-sm mt-0.5" style={{ color: '#2d7a50' }}>
              We'll be in touch to schedule your install!
            </p>
          </SuccessBanner>
        )}

        {/* Final payment due */}
        {isReadyForFinal && !isFinalPaid && (
          <>
            <SuccessBanner compact>
              <p className="text-sm font-semibold" style={{ color: '#1a5c38' }}>
                Deposit received — installation complete
              </p>
            </SuccessBanner>

            <div>
              <h2
                className="text-lg font-bold mb-1"
                style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
              >
                Final Payment Due
              </h2>
              <p className="text-sm" style={{ color: 'var(--color-slate)' }}>
                Your installation is complete. Please pay the remaining balance to close out your project.
              </p>
            </div>

            {selectedQuote && (
              <PayCard>
                {finalDollars != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--color-slate)' }}>Remaining balance</span>
                    <span
                      className="font-bold text-base"
                      style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}
                    >
                      ${finalDollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {payFinalError && <ErrorBanner>{payFinalError}</ErrorBanner>}
                <PayButton onClick={handlePayFinal} loading={payingFinal}>
                  Pay Final Balance
                </PayButton>
                <StripeBadge />
              </PayCard>
            )}
          </>
        )}

        {/* Quote selection */}
        {!isDepositPaid && (
          <>
            <div>
              <h2
                className="text-lg font-bold mb-1"
                style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
              >
                Choose an estimate
              </h2>
              <p className="text-sm" style={{ color: 'var(--color-slate)' }}>
                Select the option that works best for you, then pay your deposit to get on the schedule.
              </p>
            </div>

            {quotes.length === 0 ? (
              <div
                className="rounded-xl p-8 text-center text-sm"
                style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', color: 'var(--color-slate)' }}
              >
                No estimates available yet. Check back soon.
              </div>
            ) : (
              <div className="space-y-3">
                {quotes.map(quote => {
                  const isSelected = quote.id === selectedQuoteId;
                  const effectivePrice = quote.total_price != null
                    ? calcDiscountedPrice(quote.total_price, quote.discount_amount, quote.discount_type)
                    : null;
                  const hasDiscount = effectivePrice != null && quote.total_price != null && effectivePrice < quote.total_price;

                  return (
                    <button
                      key={quote.id}
                      type="button"
                      onClick={() => setSelectedQuoteId(quote.id)}
                      className="w-full text-left rounded-xl transition-all"
                      style={{
                        background: isSelected ? 'rgba(217,111,10,0.05)' : 'var(--color-card)',
                        border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        padding: '20px',
                        boxShadow: isSelected ? '0 2px 8px rgba(217,111,10,0.12)' : undefined,
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-slate)'; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {/* Radio */}
                          <div
                            className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all"
                            style={{
                              borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border)',
                              background: isSelected ? 'var(--color-accent)' : 'transparent',
                            }}
                          >
                            {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                          <div>
                            <p className="font-bold" style={{ color: 'var(--color-ink)' }}>{quote.label}</p>
                            {quote.total_linear_ft != null && (
                              <p className="text-sm mt-0.5" style={{ color: 'var(--color-slate)' }}>
                                {Math.round(quote.total_linear_ft).toLocaleString()} linear ft
                              </p>
                            )}
                            {job.deposit_percent != null && effectivePrice != null && (
                              <p className="text-sm mt-0.5" style={{ color: 'var(--color-slate)' }}>
                                Deposit due: ${(effectivePrice * (job.deposit_percent / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            )}
                            {hasDiscount && quote.discount_amount != null && quote.discount_type != null && (
                              <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--color-success)' }}>
                                {discountLabel(quote.discount_amount, quote.discount_type, quote.total_price!)}
                              </p>
                            )}
                            {quote.discount_note && (
                              <p className="text-sm mt-0.5" style={{ color: 'var(--color-slate)' }}>
                                {quote.discount_note}
                              </p>
                            )}
                            {quote.notes && (
                              <p className="text-sm mt-1 leading-snug" style={{ color: 'var(--color-slate)' }}>
                                {quote.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {hasDiscount && quote.total_price != null && (
                            <p className="text-sm line-through" style={{ color: 'var(--color-slate)' }}>
                              ${quote.total_price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                          )}
                          {effectivePrice != null && (
                            <p className="font-bold text-lg" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}>
                              ${effectivePrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Pay deposit */}
            {selectedQuote && (
              <PayCard>
                {depositDollars != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--color-slate)' }}>
                      Deposit required ({job.deposit_percent}%)
                    </span>
                    <span
                      className="font-bold text-base"
                      style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}
                    >
                      ${depositDollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {payError && <ErrorBanner>{payError}</ErrorBanner>}
                <PayButton onClick={handlePayDeposit} loading={paying}>
                  Pay Deposit
                </PayButton>
                <StripeBadge />
              </PayCard>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-lg mx-auto px-4 pb-10 text-center">
        <p className="text-xs" style={{ color: 'var(--color-border)' }}>
          Powered by{' '}
          <span style={{ color: 'var(--color-slate)' }}>
            <span style={{ color: 'var(--color-primary)' }}>Eave</span>HQ
          </span>
        </p>
      </footer>
    </div>
  );
}

function SuccessBanner({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div
      className={`rounded-xl flex items-start gap-3 ${compact ? 'p-4' : 'p-5'}`}
      style={{ background: 'rgba(61,158,106,0.1)', border: '1px solid rgba(61,158,106,0.25)' }}
    >
      <CheckCircle size={compact ? 18 : 22} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-success)' }} />
      <div>{children}</div>
    </div>
  );
}

function PayCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}
    >
      {children}
    </div>
  );
}

function PayButton({ children, onClick, loading }: { children: React.ReactNode; onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-base active:scale-[0.98]"
      style={{
        background: loading ? 'var(--color-border)' : 'var(--color-accent)',
        color: loading ? 'var(--color-slate)' : '#fff',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font-display)',
        boxShadow: loading ? 'none' : '0 4px 14px rgba(217,111,10,0.35)',
      }}
    >
      {loading ? (
        <>
          <Loader2 size={20} className="animate-spin" />
          Preparing checkout…
        </>
      ) : (
        <>
          <CreditCard size={20} />
          {children}
        </>
      )}
    </button>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ background: 'rgba(201,64,64,0.08)', border: '1px solid rgba(201,64,64,0.25)' }}
    >
      <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{children}</p>
    </div>
  );
}

function StripeBadge() {
  return (
    <p className="text-center text-xs" style={{ color: 'var(--color-border)' }}>
      Secure payment powered by{' '}
      <span style={{ color: 'var(--color-slate)' }}>Stripe</span>
    </p>
  );
}
