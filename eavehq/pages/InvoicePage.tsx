import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { calcDiscountedPrice, discountLabel } from '../utils/discount';

interface LineItem {
  id: string;
  type: string;
  pitch: string;
  length3d?: number;
  cost?: number;
}

interface Quote {
  id: string;
  label: string;
  total_linear_ft: number | null;
  total_price: number | null;
  price_per_foot: number | null;
  controller_fee: number | null;
  notes: string | null;
  line_items: LineItem[];
  discount_amount: number | null;
  discount_type: string | null;
  created_at: string;
}

interface JobData {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  deposit_percent: number;
  client_name: string | null;
  created_at: string;
}

interface ContractorProfile {
  company_name: string | null;
  full_name: string | null;
  logo_url: string | null;
}

export default function InvoicePage() {
  const { token } = useParams<{ token: string }>();

  const [job, setJob] = useState<JobData | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [contractor, setContractor] = useState<ContractorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    void fetchData(token);
  }, [token]);

  const fetchData = async (portalToken: string) => {
    setLoading(true);

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('id, user_id, name, address, deposit_percent, client_name, created_at')
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
        .select('id, label, total_linear_ft, total_price, price_per_foot, controller_fee, notes, line_items, discount_amount, discount_type, created_at')
        .eq('job_id', jobData.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('company_name, full_name, logo_url')
        .eq('id', jobData.user_id)
        .single(),
    ]);

    setQuotes((quotesData as Quote[]) ?? []);
    setContractor((profileData as ContractorProfile) ?? null);
    setLoading(false);
  };

  const contractorName = contractor?.company_name ?? contractor?.full_name ?? 'Your Contractor';
  const dateSent = job
    ? new Date(job.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

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
          <h1 className="text-xl font-bold text-gray-800 mb-2">Invoice not found</h1>
          <p className="text-gray-500 text-sm">This link is no longer valid. Please contact your contractor.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .invoice-card { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 py-10 px-4">
        {/* Download button — hidden on print */}
        <div className="max-w-3xl mx-auto mb-6 flex justify-end no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-5 rounded-lg transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Download as PDF
          </button>
        </div>

        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 invoice-card overflow-hidden">
          {/* Header */}
          <div className="bg-gray-900 px-8 py-7 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {contractor?.logo_url && (
                  <img
                    src={contractor.logo_url}
                    alt="Company logo"
                    className="h-14 w-14 object-contain rounded-lg bg-white p-1 flex-shrink-0"
                  />
                )}
                <div>
                  <p className="text-xl font-bold leading-tight">{contractorName}</p>
                  <p className="text-gray-400 text-sm mt-0.5">Estimate Invoice</p>
                </div>
              </div>
              <div className="text-right text-sm text-gray-400 flex-shrink-0">
                <p className="text-white font-bold text-lg">{job.name}</p>
                {job.address && <p className="mt-0.5">{job.address}</p>}
                {job.client_name && <p className="mt-0.5">Client: {job.client_name}</p>}
                <p className="mt-0.5">Date: {dateSent}</p>
              </div>
            </div>
          </div>

          {/* Estimates */}
          <div className="px-8 py-8 space-y-8">
            {quotes.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No estimates available.</p>
            ) : (
              quotes.map((quote, idx) => {
                const rawPrice = quote.total_price ?? 0;
                const effectivePrice = calcDiscountedPrice(rawPrice, quote.discount_amount, quote.discount_type);
                const hasDiscount = effectivePrice < rawPrice;
                const depositDue = effectivePrice * (job.deposit_percent / 100);
                const lineItems: LineItem[] = Array.isArray(quote.line_items) ? quote.line_items : [];

                return (
                  <div key={quote.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Option header */}
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                          Option {idx + 1}
                        </span>
                        <h2 className="text-lg font-bold text-gray-900 mt-0.5">{quote.label}</h2>
                      </div>
                      <div className="text-right">
                        {hasDiscount && (
                          <p className="text-sm text-gray-400 line-through">
                            ${rawPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        )}
                        <p className="text-2xl font-black text-amber-500">
                          ${effectivePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        {hasDiscount && quote.discount_amount != null && quote.discount_type != null && (
                          <p className="text-xs font-semibold text-green-600 mt-0.5">
                            {discountLabel(quote.discount_amount, quote.discount_type, rawPrice)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="px-6 py-5 space-y-4">
                      {/* Notes */}
                      {quote.notes && (
                        <p className="text-sm text-gray-600 leading-relaxed">{quote.notes}</p>
                      )}

                      {/* Line items breakdown */}
                      {lineItems.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Line Items</p>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="text-left py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Type</th>
                                <th className="text-left py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Pitch</th>
                                <th className="text-right py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Length (ft)</th>
                                <th className="text-right py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lineItems.map((item) => (
                                <tr key={item.id} className="border-b border-gray-50">
                                  <td className="py-1.5 text-gray-700 capitalize">{item.type}</td>
                                  <td className="py-1.5 text-gray-500">{item.pitch}</td>
                                  <td className="py-1.5 text-right text-gray-700">
                                    {item.length3d != null ? item.length3d.toFixed(1) : '—'}
                                  </td>
                                  <td className="py-1.5 text-right text-gray-700">
                                    {item.cost != null
                                      ? `$${item.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                      : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Summary row */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <div className="text-sm">
                          <span className="text-gray-500">Total linear ft: </span>
                          <span className="font-semibold text-gray-800">
                            {quote.total_linear_ft != null ? `${quote.total_linear_ft.toFixed(1)} ft` : '—'}
                          </span>
                          {quote.price_per_foot != null && (
                            <span className="text-gray-400 ml-2">@ ${quote.price_per_foot}/ft</span>
                          )}
                          {quote.controller_fee != null && quote.controller_fee > 0 && (
                            <span className="text-gray-400 ml-2">+ ${quote.controller_fee} controller</span>
                          )}
                        </div>
                        <div className="text-sm text-right">
                          <span className="text-gray-500">Deposit ({job.deposit_percent}%): </span>
                          <span className="font-bold text-gray-800">
                            ${depositDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-8 py-5 bg-gray-50">
            <p className="text-sm text-gray-500 text-center">
              Questions? Contact <span className="font-semibold text-gray-700">{contractorName}</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
