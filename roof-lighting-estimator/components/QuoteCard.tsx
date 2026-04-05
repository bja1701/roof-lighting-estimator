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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function QuoteCard({ quote, job, profile, onDelete, onEdit }: Props) {
  const estimatorLocked = isFreeTierEstimatorExhausted(profile);

  const handlePrint = () => {
    const accent = profile?.brand_color ?? '#d97706';
    const companyName = escapeHtml(profile?.company_name ?? 'Roof Estimator');
    const userName = escapeHtml(profile?.full_name ?? '');
    const phone = escapeHtml(profile?.phone ?? '');
    const email = escapeHtml(profile?.email ?? '');
    const logoUrl = profile?.logo_url ?? '';
    const jobName = escapeHtml(job.name);
    const jobAddr = job.address ? escapeHtml(job.address) : '';
    const quoteLabel = escapeHtml(quote.label);
    const notesHtml = quote.notes?.trim()
      ? `<div class="notes"><h4>Notes</h4><p>${escapeHtml(quote.notes.trim())}</p></div>`
      : '';

    const footage = quote.total_linear_ft ?? 0;
    const total = quote.total_price ?? 0;
    const ppf = quote.price_per_foot ?? 4;
    const ctrlFee = quote.controller_fee ?? 0;
    const hasController = !!(quote.include_controller && ctrlFee > 0);
    const lightingSubtotal = hasController ? Math.max(0, total - ctrlFee) : total;

    const fmt = (n: number) =>
      n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const summaryRows = `
      <div class="row"><span class="k">Estimated roof perimeter</span><span class="v">${footage.toFixed(1)} linear ft</span></div>
      <div class="row"><span class="k">Lighting subtotal <span class="hint">(@ $${fmt(ppf)}/ft)</span></span><span class="v">$${fmt(lightingSubtotal)}</span></div>
      ${
        hasController
          ? `<div class="row"><span class="k">Controller &amp; installation</span><span class="v">$${fmt(ctrlFee)}</span></div>`
          : ''
      }
    `;

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${jobName} — ${quoteLabel}</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#f1f5f9;padding:36px 24px}
.sheet{max-width:640px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 25px 50px -12px rgba(15,23,42,.12)}
.topbar{height:5px;background:${accent}}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding:32px 36px 28px;background:linear-gradient(180deg,#fafafa 0%,#fff 60%)}
.logo{max-height:64px;max-width:180px;object-fit:contain;display:block}
.mark{width:56px;height:56px;border-radius:14px;background:${accent};flex-shrink:0}
.co{text-align:right}
.co h1{font-size:1.25rem;font-weight:800;letter-spacing:-.02em;color:#0f172a}
.co p{font-size:.8rem;color:#64748b;margin-top:4px;line-height:1.45}
.co .date{margin-top:10px;font-weight:600;color:#475569}
.body{padding:8px 36px 36px}
.prepared{font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;font-weight:700;margin-bottom:20px}
.jobline{font-size:1.35rem;font-weight:800;letter-spacing:-.03em;color:#0f172a;line-height:1.25}
.addr{font-size:.9rem;color:#64748b;margin-top:8px;line-height:1.5}
.divider{height:1px;background:#e2e8f0;margin:28px 0}
.est-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;font-weight:700}
.est-title{font-size:1.05rem;font-weight:700;color:#334155;margin-top:6px}
.summary{margin-top:24px;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#f8fafc}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:.9rem}
.row:last-of-type{border-bottom:none}
.row .k{color:#475569}
.row .v{font-weight:700;color:#0f172a;white-space:nowrap}
.hint{font-weight:400;color:#94a3b8;font-size:.8rem}
.total-wrap{padding:28px 24px 32px;text-align:center;background:#fff;border-top:1px solid #e2e8f0}
.total-wrap .lbl{font-size:.75rem;text-transform:uppercase;letter-spacing:.14em;color:#64748b;font-weight:700}
.total-wrap .amt{font-size:2.75rem;font-weight:800;letter-spacing:-.04em;color:${accent};margin-top:8px;line-height:1}
.total-wrap .sub{font-size:.85rem;color:#94a3b8;margin-top:10px}
.notes{margin:24px 36px 0;padding:18px 20px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0}
.notes h4{font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:8px}
.notes p{font-size:.875rem;color:#475569;line-height:1.55;white-space:pre-wrap}
.foot{padding:24px 36px 32px;text-align:center;font-size:.75rem;color:#94a3b8;line-height:1.6;border-top:1px solid #f1f5f9}
@media print{body{background:#fff;padding:0}.sheet{border:none;box-shadow:none;border-radius:0;max-width:none}}
</style></head><body><div class="sheet"><div class="topbar"></div><div class="head"><div>${
      logoUrl
        ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt=""/>`
        : `<div class="mark" aria-hidden="true"></div>`
    }</div><div class="co"><h1>${companyName}</h1>${
      userName ? `<p>${userName}</p>` : ''
    }${phone ? `<p>${phone}</p>` : ''}${email ? `<p>${email}</p>` : ''}<p class="date">${escapeHtml(
      dateStr
    )}</p></div></div><div class="body"><p class="prepared">Estimate prepared for</p><p class="jobline">${jobName}</p>${
      jobAddr ? `<p class="addr">${jobAddr}</p>` : ''
    }<div class="divider"></div><p class="est-label">Estimate</p><p class="est-title">${quoteLabel}</p><div class="summary">${summaryRows}</div><div class="total-wrap"><p class="lbl">Total investment</p><p class="amt">$${fmt(
      total
    )}</p><p class="sub">Good for discussion; final pricing may vary with site conditions.</p></div></div>${notesHtml}<div class="foot">Thank you for considering ${companyName} for your project.</div></div><script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}<\/script></body></html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
  };

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
