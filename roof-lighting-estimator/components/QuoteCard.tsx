import React from 'react';
import { Profile } from '../hooks/useProfile';

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

interface Job {
  id: string;
  name: string;
  address: string | null;
}

interface Props {
  quote: Quote;
  job: Job;
  profile: Profile | null;
  onDelete: () => void;
  onEdit: () => void;
}

export default function QuoteCard({ quote, job, profile, onDelete, onEdit }: Props) {
  const handlePrint = () => {
    const lineItemsHtml = (quote.line_items ?? []).map((item: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.type ?? 'Segment'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.pitch ?? '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${(item.length3d ?? 0).toFixed(1)} ft</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">$${((item.length3d ?? 0) * (quote.price_per_foot ?? 4)).toFixed(2)}</td>
      </tr>
    `).join('');
    const accentColor = profile?.brand_color ?? '#f59e0b';
    const companyName = profile?.company_name ?? 'Roof Estimator';
    const userName = profile?.full_name ?? '';
    const phone = profile?.phone ?? '';
    const email = profile?.email ?? '';
    const logoUrl = profile?.logo_url ?? '';
    const controllerLine = quote.include_controller && (quote.controller_fee ?? 0) > 0
      ? `<tr><td colspan="3" style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">Controller</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">$${(quote.controller_fee ?? 0).toFixed(2)}</td></tr>`
      : '';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${job.name} — ${quote.label}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;padding:40px;max-width:700px;margin:0 auto}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}.logo{max-height:56px;max-width:160px;object-fit:contain}.company{text-align:right}.company h2{font-size:18px;font-weight:700;color:#111}.company p{font-size:12px;color:#6b7280;margin-top:2px}.divider{height:3px;background:${accentColor};margin:24px 0;border-radius:2px}.meta{display:flex;justify-content:space-between;margin-bottom:24px}.meta-block h3{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;font-weight:600;margin-bottom:4px}.meta-block p{font-size:14px;color:#111;font-weight:500}.meta-block p.sub{font-size:12px;color:#6b7280;font-weight:400}table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px}thead th{padding:8px 12px;text-align:left;background:#f9fafb;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;font-weight:600}thead th:last-child,thead th:nth-child(3),thead th:nth-child(4){text-align:right}.total-row td{padding:10px 12px;font-weight:700;font-size:14px;border-top:2px solid #111}.total-row td:last-child{text-align:right;color:${accentColor}}.notes{margin-top:20px;padding:12px 16px;background:#f9fafb;border-radius:8px;font-size:12px;color:#6b7280}.footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#9ca3af}.accent-bar{height:4px;background:${accentColor};border-radius:2px;margin-top:32px}@media print{body{padding:20px}}</style></head><body><div class="header"><div>${logoUrl ? `<img class="logo" src="${logoUrl}" alt="Logo" />` : `<div style="width:48px;height:48px;background:${accentColor};border-radius:8px;"></div>`}</div><div class="company"><h2>${companyName}</h2>${userName ? `<p>${userName}</p>` : ''}${phone ? `<p>${phone}</p>` : ''}${email ? `<p>${email}</p>` : ''}<p>Date: ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</p></div></div><div class="divider"></div><div class="meta"><div class="meta-block"><h3>Job</h3><p>${job.name}</p>${job.address ? `<p class="sub">${job.address}</p>` : ''}</div><div class="meta-block" style="text-align:right"><h3>Estimate</h3><p>${quote.label}</p></div></div><table><thead><tr><th>Section</th><th style="text-align:center">Pitch</th><th style="text-align:right">Linear Ft</th><th style="text-align:right">Total</th></tr></thead><tbody>${lineItemsHtml}${controllerLine}<tr class="total-row"><td colspan="2">TOTAL</td><td style="text-align:right">${(quote.total_linear_ft ?? 0).toFixed(1)} ft</td><td>$${(quote.total_price ?? 0).toFixed(2)}</td></tr></tbody></table>${quote.notes ? `<div class="notes"><strong>Notes:</strong> ${quote.notes}</div>` : ''}<div class="accent-bar"></div><div class="footer">Thank you for your business.</div><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script></body></html>`);
    printWindow.document.close();
  };

  const quoteCount = quote.line_items?.length ?? 0;

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
              onClick={onEdit}
              className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-primary-container transition-colors"
              title="Edit in estimator"
            >
              <span className="material-symbols-outlined text-sm">edit</span>
            </button>
            <button
              onClick={handlePrint}
              className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-primary transition-colors"
              title="Download PDF"
            >
              <span className="material-symbols-outlined text-sm">download</span>
            </button>
            <button
              onClick={onDelete}
              className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-error transition-colors"
              title="Delete estimate"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
        </div>

        {/* Line items preview */}
        {quoteCount > 0 && (
          <div className="space-y-2 mb-8">
            {quote.line_items.slice(0, 3).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-sm text-on-surface-variant">
                <span className="w-1.5 h-1.5 rounded-full bg-outline-variant flex-shrink-0"></span>
                <span className="truncate capitalize">{item.type ?? 'Segment'}{item.pitch ? ` · ${item.pitch}` : ''}</span>
                <span className="ml-auto font-medium text-on-surface">{(item.length3d ?? 0).toFixed(1)} ft</span>
              </div>
            ))}
            {quoteCount > 3 && (
              <p className="text-xs text-on-surface-variant/60 pl-4">+{quoteCount - 3} more segments</p>
            )}
          </div>
        )}

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
