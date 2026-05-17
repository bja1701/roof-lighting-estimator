import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

const FOUNDERS_PRICE = '$44.50/mo';
const FOUNDERS_PAYMENT_LINK = import.meta.env.VITE_FOUNDERS_PAYMENT_LINK as string | undefined;

const BENEFITS = [
  'Satellite-based roofline estimates without spreadsheet cleanup',
  'Client-ready quote options with deposit collection',
  'Job tracking from estimate sent to final payment',
  'Founding-member rate locked in while EaveHQ grows',
];

export default function FoundersPage() {
  const hasPaymentLink = Boolean(FOUNDERS_PAYMENT_LINK?.trim());

  return (
    <main
      className="min-h-screen px-4 py-10 sm:px-6 lg:px-8"
      style={{ background: 'var(--color-surface)', color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }}
    >
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div
              className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
              style={{ background: 'rgba(58,99,73,0.1)', color: 'var(--color-primary)' }}
            >
              <Sparkles size={14} aria-hidden="true" />
              Founding Member Offer
            </div>
            <h1
              className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl"
              style={{ fontFamily: 'var(--font-display)', lineHeight: 1.05 }}
            >
              The field-service command center for roofline lighting contractors.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8" style={{ color: 'var(--color-slate)' }}>
              EaveHQ helps permanent lighting contractors quote faster, collect deposits, and keep every job moving without duct-taping together maps, PDFs, invoices, and notes.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              {hasPaymentLink ? (
                <a
                  href={FOUNDERS_PAYMENT_LINK}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-bold text-white transition-opacity"
                  style={{ background: 'var(--color-accent)' }}
                >
                  Claim founders rate
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex min-h-[48px] cursor-not-allowed items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-bold text-white opacity-60"
                  style={{ background: 'var(--color-accent)' }}
                >
                  Payment link coming soon
                </button>
              )}
              <p className="text-sm" style={{ color: 'var(--color-slate)' }}>
                Founders price: <span style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}>{FOUNDERS_PRICE}</span>
              </p>
            </div>
          </div>

          <aside
            className="rounded-2xl p-6"
            style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="mb-6 flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: 'var(--color-primary)', color: '#fff' }}
              >
                <ShieldCheck size={22} aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>Built for the job site</h2>
                <p className="text-sm" style={{ color: 'var(--color-slate)' }}>Fast enough for the truck cab, polished enough for the homeowner.</p>
              </div>
            </div>

            <ul className="space-y-4">
              {BENEFITS.map(benefit => (
                <li key={benefit} className="flex gap-3 text-sm leading-6">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" style={{ color: 'var(--color-success)' }} />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            {!hasPaymentLink && (
              <p className="mt-6 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--color-surface)', color: 'var(--color-slate)' }}>
                Set <span style={{ fontFamily: 'var(--font-mono)' }}>VITE_FOUNDERS_PAYMENT_LINK</span> after the Stripe live migration to enable checkout.
              </p>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
