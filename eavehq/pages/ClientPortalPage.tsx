import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
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
}

interface ContractorProfile {
  company_name: string | null;
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

    if (jobError || !jobData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setJob(jobData as JobData);

    const [{ data: quotesData }, { data: profileData }] = await Promise.all([
      supabase
        .from('quotes')
        .select('id, label, total_linear_ft, total_price, notes, discount_amount, discount_type')
        .eq('job_id', jobData.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('company_name, logo_url')
        .eq('id', jobData.user_id)
        .single(),
    ]);

    const loadedQuotes = (quotesData as Quote[]) ?? [];
    setQuotes(loadedQuotes);
    setContractor((profileData as ContractorProfile) ?? null);
    if (loadedQuotes.length > 0) {
      // If the URL contains ?estimate=<id> and that id exists in this job's quotes, pre-select it.
      // Otherwise fall back to the first quote.
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
      ? calcDiscountedPrice(
          selectedQuote.total_price,
          selectedQuote.discount_amount,
          selectedQuote.discount_type,
        )
      : null;
  const depositDollars =
    selectedEffectivePrice != null && job
      ? (selectedEffectivePrice * (job.deposit_percent / 100))
      : null;

  // For final payment: use stored deposit_amount if available, else estimate from percent
  // Base final calculation on the discounted price
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Quote link not found</h1>
          <p className="text-gray-500 text-sm">This quote link is no longer valid. Please contact your contractor for an updated link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          {contractor?.logo_url && (
            <img
              src={contractor.logo_url}
              alt="Company logo"
              className="h-12 w-12 object-contain rounded-lg flex-shrink-0"
            />
          )}
          <div>
            <p className="font-bold text-gray-900 text-lg leading-tight">
              {contractor?.company_name ?? 'Your Contractor'}
            </p>
            {job.address && (
              <p className="text-gray-500 text-sm mt-0.5">{job.address}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Final payment received banner */}
        {isFinalPaid && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3">
            <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-bold text-green-800">Final payment received</p>
              <p className="text-green-700 text-sm mt-0.5">
                Thank you — your account is settled in full!
              </p>
            </div>
          </div>
        )}

        {/* Deposit paid banner — show when deposit paid but job not yet complete/final */}
        {isDepositPaid && !isReadyForFinal && !isFinalPaid && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3">
            <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-bold text-green-800">Deposit received</p>
              <p className="text-green-700 text-sm mt-0.5">
                We'll be in touch to schedule your install!
              </p>
            </div>
          </div>
        )}

        {/* Final payment due — job is complete, awaiting final payment */}
        {isReadyForFinal && !isFinalPaid && (
          <>
            {/* Deposit already paid banner above final section */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-800 text-sm font-semibold">Deposit received — installation complete</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Final Payment Due</h2>
              <p className="text-gray-500 text-sm">Your installation is complete. Please pay the remaining balance to close out your project.</p>
            </div>

            {selectedQuote && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                {finalDollars != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Remaining balance</span>
                    <span className="font-bold text-gray-900 text-base">
                      ${finalDollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {payFinalError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <p className="text-red-700 text-sm">{payFinalError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePayFinal}
                  disabled={payingFinal}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-base"
                >
                  {payingFinal ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Preparing checkout…
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Pay Final Balance
                    </>
                  )}
                </button>

                <p className="text-center text-gray-400 text-xs">
                  Secure payment powered by Stripe
                </p>
              </div>
            )}
          </>
        )}

        {/* Quote selection — only when deposit not yet paid */}
        {!isDepositPaid && (
          <>
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Choose an estimate</h2>
              <p className="text-gray-500 text-sm">Select the option that works best for you, then pay your deposit to get on the schedule.</p>
            </div>

            {quotes.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
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
                      className={[
                        'w-full text-left rounded-xl border-2 p-5 transition-all',
                        isSelected
                          ? 'border-amber-500 bg-amber-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={[
                            'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                            isSelected ? 'border-amber-500 bg-amber-500' : 'border-gray-300',
                          ].join(' ')}>
                            {isSelected && (
                              <div className="w-2 h-2 bg-white rounded-full" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{quote.label}</p>
                            {quote.total_linear_ft != null && (
                              <p className="text-gray-500 text-sm mt-0.5">
                                {Math.round(quote.total_linear_ft).toLocaleString()} linear ft
                              </p>
                            )}
                            {job.deposit_percent != null && effectivePrice != null && (
                              <p className="text-gray-500 text-sm mt-0.5">
                                Deposit due: ${(effectivePrice * (job.deposit_percent / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            )}
                            {hasDiscount && quote.discount_amount != null && quote.discount_type != null && (
                              <p className="text-green-600 text-sm font-semibold mt-0.5">
                                {discountLabel(quote.discount_amount, quote.discount_type, quote.total_price!)}
                              </p>
                            )}
                            {quote.notes && (
                              <p className="text-gray-500 text-sm mt-1 leading-snug">{quote.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {hasDiscount && quote.total_price != null && (
                            <p className="text-gray-400 text-sm line-through">
                              ${quote.total_price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                          )}
                          {effectivePrice != null && (
                            <p className="font-bold text-gray-900 text-lg">
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

            {/* Deposit summary + pay button */}
            {selectedQuote && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                {depositDollars != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      Deposit required ({job.deposit_percent}%)
                    </span>
                    <span className="font-bold text-gray-900 text-base">
                      ${depositDollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {payError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <p className="text-red-700 text-sm">{payError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePayDeposit}
                  disabled={paying}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-base"
                >
                  {paying ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Preparing checkout…
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Pay Deposit
                    </>
                  )}
                </button>

                <p className="text-center text-gray-400 text-xs">
                  Secure payment powered by Stripe
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
