/**
 * Client-facing estimate PDF (print / Save as PDF).
 * Layout inspired by field-service quote UIs: clear hierarchy, comparison when multiple options.
 */

import type { Profile } from '../hooks/useProfile';

export type PdfQuote = {
  id: string;
  label: string;
  notes: string | null;
  total_linear_ft: number | null;
  total_price: number | null;
  price_per_foot: number | null;
  controller_fee: number | null;
  include_controller: boolean | null;
  created_at: string;
};

export type PdfJob = {
  name: string;
  address: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function quoteRef(jobName: string, quoteId: string): string {
  const short = quoteId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const slug = jobName
    .slice(0, 12)
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();
  return `${slug || 'JOB'}-${short}`;
}

function sectionForQuote(quote: PdfQuote, optionIndex: number, accent: string): string {
  const label = escapeHtml(quote.label);
  const footage = quote.total_linear_ft ?? 0;
  const total = quote.total_price ?? 0;
  const ppf = quote.price_per_foot ?? 4;
  const ctrlFee = quote.controller_fee ?? 0;
  const hasController = !!(quote.include_controller && ctrlFee > 0);
  const lightingSubtotal = hasController ? Math.max(0, total - ctrlFee) : total;
  const notesBlock = quote.notes?.trim()
    ? `<div class="opt-notes"><strong>Notes</strong><p>${escapeHtml(quote.notes.trim())}</p></div>`
    : '';

  return `
  <section class="opt-block">
    <div class="opt-head">
      <span class="opt-badge">Option ${optionIndex}</span>
      <h2 class="opt-title">${label}</h2>
      <p class="opt-meta">Saved ${new Date(quote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
    </div>
    <table class="breakdown">
      <tbody>
        <tr><td class="d">Roof perimeter (3D)</td><td class="a">${footage.toFixed(1)} lin. ft</td></tr>
        <tr><td class="d">Lighting <span class="muted">@ $${fmtMoney(ppf)}/ft</span></td><td class="a">$${fmtMoney(lightingSubtotal)}</td></tr>
        ${
          hasController
            ? `<tr><td class="d">Controller package</td><td class="a">$${fmtMoney(ctrlFee)}</td></tr>`
            : ''
        }
      </tbody>
    </table>
    <div class="opt-total">
      <span class="opt-total-label">Option total</span>
      <span class="opt-total-amt" style="color:${accent}">$${fmtMoney(total)}</span>
    </div>
    ${notesBlock}
  </section>`;
}

function comparisonTable(quotes: PdfQuote[], accent: string): string {
  if (quotes.length < 2) return '';
  const rows = quotes
    .map(
      (q, i) => `
    <tr>
      <td class="c-name"><span class="c-dot" style="background:${accent}"></span> Option ${i + 1}: ${escapeHtml(q.label)}</td>
      <td class="c-num">${(q.total_linear_ft ?? 0).toFixed(1)} ft</td>
      <td class="c-num c-strong">$${fmtMoney(q.total_price ?? 0)}</td>
    </tr>`
    )
    .join('');
  return `
  <div class="compare-wrap">
    <h3 class="compare-h">Compare options</h3>
    <table class="compare">
      <thead><tr><th>Estimate</th><th>Footage</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

export function buildClientQuotePdfHtml(job: PdfJob, profile: Profile | null, quotes: PdfQuote[]): string {
  const accent = profile?.brand_color ?? '#d97706';
  const company = escapeHtml(profile?.company_name ?? 'EaveHQ');
  const rep = escapeHtml(profile?.full_name ?? '');
  const phone = escapeHtml(profile?.phone ?? '');
  const email = escapeHtml(profile?.email ?? '');
  const logoUrl = profile?.logo_url ?? '';
  const jobName = escapeHtml(job.name);
  const jobAddr = job.address ? escapeHtml(job.address) : '';
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const ref = quoteRef(job.name, quotes[0]?.id ?? 'x');

  const sections = quotes.map((q, i) => sectionForQuote(q, i + 1, accent)).join('');
  const compare = comparisonTable(quotes, accent);

  const css = `
:root { --ink:#111827; --muted:#6b7280; --line:#e5e7eb; --paper:#ffffff; --soft:#f9fafb; }
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,-apple-system,Roboto,'Helvetica Neue',sans-serif;color:var(--ink);background:#fff;font-size:14px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc{max-width:720px;margin:0 auto;padding:48px 40px 56px}
.doc-header{display:flex;justify-content:space-between;align-items:flex-start;gap:32px;padding-bottom:28px;border-bottom:2px solid var(--ink);margin-bottom:32px}
.doc-logo img{max-height:52px;max-width:200px;object-fit:contain;display:block}
.doc-logo-fallback{width:48px;height:48px;border-radius:10px;background:${accent}}
.doc-co{text-align:right}
.doc-co .co-name{font-size:20px;font-weight:800;letter-spacing:-0.02em;color:var(--ink)}
.doc-co .co-line{font-size:12px;color:var(--muted);margin-top:4px}
.doc-title-row{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px;margin-bottom:28px}
.doc-title{font-size:11px;font-weight:700;letter-spacing:0.2em;color:var(--muted)}
.doc-title-big{font-size:28px;font-weight:800;letter-spacing:-0.03em;margin-top:4px;color:var(--ink)}
.doc-ref{font-size:12px;color:var(--muted);text-align:right}
.doc-ref strong{display:block;font-size:13px;color:var(--ink);font-weight:700;margin-bottom:2px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px}
@media(max-width:600px){.two-col{grid-template-columns:1fr}}
.box{border:1px solid var(--line);border-radius:8px;padding:18px 20px;background:var(--soft)}
.box h4{font-size:10px;font-weight:700;letter-spacing:0.14em;color:var(--muted);margin-bottom:10px}
.box .primary{font-size:16px;font-weight:700;color:var(--ink)}
.box .secondary{font-size:13px;color:var(--muted);margin-top:6px;line-height:1.45}
.compare-wrap{margin-bottom:36px}
.compare-h{font-size:11px;font-weight:700;letter-spacing:0.12em;color:var(--muted);margin-bottom:12px}
.compare{width:100%;border-collapse:collapse;font-size:13px}
.compare th{text-align:left;padding:10px 12px;background:var(--soft);border:1px solid var(--line);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted)}
.compare td{padding:12px;border:1px solid var(--line);vertical-align:middle}
.compare .c-name{font-weight:600}
.compare .c-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:8px;vertical-align:middle}
.compare .c-num{text-align:right;font-variant-numeric:tabular-nums}
.compare .c-strong{font-weight:800}
.opt-block{margin-bottom:40px;padding-bottom:36px;border-bottom:1px solid var(--line)}
.opt-block:last-of-type{border-bottom:none;margin-bottom:0;padding-bottom:0}
.opt-head{margin-bottom:16px}
.opt-badge{display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.1em;color:#fff;background:var(--ink);padding:4px 10px;border-radius:4px;margin-bottom:8px}
.opt-title{font-size:20px;font-weight:800;letter-spacing:-0.02em}
.opt-meta{font-size:12px;color:var(--muted);margin-top:4px}
.breakdown{width:100%;border-collapse:collapse;margin-bottom:16px}
.breakdown td{padding:10px 0;border-bottom:1px solid var(--line);font-size:13px}
.breakdown tr:last-child td{border-bottom:none}
.breakdown .d{color:var(--muted)}
.breakdown .a{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.breakdown .muted{font-weight:400;color:#9ca3af;font-size:12px}
.opt-total{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;background:var(--soft);border-radius:8px;border:1px solid var(--line)}
.opt-total-label{font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--muted);text-transform:uppercase}
.opt-total-amt{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}
.opt-notes{margin-top:16px;padding:14px 16px;background:#fff;border:1px dashed var(--line);border-radius:8px;font-size:13px;color:var(--muted)}
.opt-notes strong{display:block;font-size:10px;letter-spacing:0.1em;color:var(--muted);margin-bottom:6px;text-transform:uppercase}
.opt-notes p{white-space:pre-wrap;color:var(--ink)}
.doc-footer{margin-top:48px;padding-top:24px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);text-align:center;line-height:1.6}
.doc-footer strong{color:var(--ink)}
@media print{
  body{background:#fff}
  .doc{padding:24px 32px;max-width:none}
  .opt-block{break-inside:avoid}
  .compare-wrap{break-inside:avoid}
}
`;

  const title = quotes.length > 1 ? 'Estimate options' : 'Estimate';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${jobName} — ${escapeHtml(
    title
  )}</title><style>${css}</style></head><body><div class="doc">
  <header class="doc-header">
    <div class="doc-logo">${
      logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" alt=""/>`
        : `<div class="doc-logo-fallback" style="background:${accent}" aria-hidden="true"></div>`
    }</div>
    <div class="doc-co">
      <div class="co-name">${company}</div>
      ${rep ? `<div class="co-line">${rep}</div>` : ''}
      ${phone ? `<div class="co-line">${phone}</div>` : ''}
      ${email ? `<div class="co-line">${email}</div>` : ''}
    </div>
  </header>
  <div class="doc-title-row">
    <div>
      <div class="doc-title">QUOTE</div>
      <div class="doc-title-big">${escapeHtml(title)}</div>
    </div>
    <div class="doc-ref">
      <strong>Reference</strong>
      ${escapeHtml(ref)}<br/>
      ${escapeHtml(dateStr)}
    </div>
  </div>
  <div class="two-col">
    <div class="box">
      <h4>Service location</h4>
      <div class="primary">${jobName}</div>
      ${jobAddr ? `<div class="secondary">${jobAddr}</div>` : '<div class="secondary">Address on file as needed</div>'}
    </div>
    <div class="box">
      <h4>Prepared by</h4>
      <div class="primary">${company}</div>
      ${rep ? `<div class="secondary">${rep}</div>` : ''}
      <div class="secondary">Questions? Reply to this quote or call the number above.</div>
    </div>
  </div>
  ${compare}
  ${sections}
  <footer class="doc-footer">
    <p>Pricing is an estimate based on satellite measurements and your selected options. <strong>Final price</strong> may change after a site visit.</p>
    <p style="margin-top:10px">Thank you for your business.</p>
  </footer>
</div><script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}<\/script></body></html>`;
}

/** Opens print dialog in a new tab. Returns false if the browser blocked the pop-up. */
export function printClientQuotePdf(html: string): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
