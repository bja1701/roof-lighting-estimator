import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { useUpgradeModal } from '../hooks/useUpgradeModal';
import SharedLayout from '../components/SharedLayout';
import ProWelcomeModal from '../components/ProWelcomeModal';

const labelCls = 'block text-[11px] font-label font-bold uppercase tracking-wider text-on-surface-variant mb-1.5';
const inputCls = 'w-full px-4 py-3 bg-surface-container-low border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-sm placeholder:text-outline/50 transition-all';

/** Must stay in sync with storage.buckets.file_size_limit for `logos` (see supabase migrations). */
const LOGO_MAX_BYTES = 10 * 1024 * 1024;

function formatMaxLogoMb() {
  return String(Math.round(LOGO_MAX_BYTES / (1024 * 1024)));
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { open: openUpgrade } = useUpgradeModal();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upgradeSuccess = new URLSearchParams(window.location.search).get('upgrade') === 'success';
  const [showProModal, setShowProModal] = useState(upgradeSuccess);
  const [canceling, setCanceling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const handleCancelSubscription = async () => {
    setCanceling(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error: fnError } = await supabase.functions.invoke('cancel-subscription', {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setCanceling(false);
    setCancelConfirm(false);
    if (fnError || !data?.ok) {
      setError('Failed to cancel subscription. Please try again or contact support.');
      return;
    }
    // Profile will reflect canceled state on next fetch
    window.location.reload();
  };

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [brandColor, setBrandColor] = useState('#f59e0b');
  const [pricePerFoot, setPricePerFoot] = useState(4.0);
  const [controllerFee, setControllerFee] = useState(300.0);
  const [includeController, setIncludeController] = useState(true);
  const [logoUrl, setLogoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setCompanyName(profile.company_name ?? '');
      setPhone(profile.phone ?? '');
      setBrandColor(profile.brand_color ?? '#f59e0b');
      setPricePerFoot(profile.price_per_foot ?? 4.0);
      setControllerFee(profile.controller_fee ?? 300.0);
      setIncludeController(profile.include_controller ?? true);
      setLogoUrl(profile.logo_url ?? '');
    }
  }, [profile]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setError('');
    if (file.size > LOGO_MAX_BYTES) {
      setError(
        `That file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Logos must be at most ${formatMaxLogoMb()} MB (use a smaller image or export a compressed PNG/JPG).`
      );
      setUploading(false);
      e.target.value = '';
      return;
    }
    const ext = file.name.split('.').pop();
    const path = `${user.id}/logo.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (uploadErr) {
      const msg = uploadErr.message ?? '';
      setError(
        /row-level security|rls/i.test(msg)
          ? 'Logo upload is blocked by Storage security rules. In Supabase: open SQL Editor and run the migration `supabase/migrations/20260404130000_storage_logos_bucket.sql` (creates the `logos` bucket and policies).'
          : /exceeded the maximum|maximum allowed size|too large/i.test(msg)
            ? `Supabase is rejecting this file size. In Dashboard → SQL, run \`supabase/migrations/20260404140000_storage_logos_file_size_limit.sql\` (sets the logos bucket to ${formatMaxLogoMb()} MB), or shrink the image under ${formatMaxLogoMb()} MB.`
            : msg
      );
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
    setLogoUrl(urlData.publicUrl);
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const { error: err } = await updateProfile({
      full_name: fullName || null,
      company_name: companyName || null,
      phone: phone || null,
      brand_color: brandColor,
      price_per_foot: pricePerFoot,
      controller_fee: controllerFee,
      include_controller: includeController,
      logo_url: logoUrl || null,
    } as any);
    setSaving(false);
    if (err) { setError(err); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <>
    <SharedLayout>
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-10">
        {/* Page header */}
        <div className="mb-12">
          <h1 className="font-headline font-black text-5xl tracking-tight text-on-surface mb-2">Settings</h1>
          <p className="text-lg text-on-surface-variant">Manage your company branding, pricing defaults, and account details.</p>
        </div>

        <div className="space-y-8">
          {/* Company Branding */}
          <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-primary-container/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-container text-base">business</span>
              </div>
              <div>
                <h2 className="font-headline font-bold text-on-surface">Company Branding</h2>
                <p className="text-xs text-on-surface-variant">Shown on all PDF exports and proposals</p>
              </div>
            </div>

            {/* Logo upload */}
            <div className="mb-6">
              <label className={labelCls}>Logo</label>
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 bg-surface-container-low rounded-xl flex items-center justify-center overflow-hidden border border-outline-variant/10">
                  {logoUrl
                    ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    : <span className="material-symbols-outlined text-on-surface-variant text-3xl">image</span>
                  }
                </div>
                <div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-4 py-2.5 bg-surface-container-low text-primary font-semibold text-sm rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">upload</span>
                    {uploading ? 'Uploading…' : 'Upload Logo'}
                  </button>
                  <p className="text-xs text-on-surface-variant mt-1.5">
                    PNG or JPG, max {formatMaxLogoMb()} MB. Shown on PDF exports.
                  </p>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>Company Name</label>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your Company" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Your Name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Brighton Jones" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(801) 555-0100" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Brand Accent Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={e => setBrandColor(e.target.value)}
                    className="w-12 h-12 rounded-lg border border-outline-variant/20 bg-surface-container-low cursor-pointer p-1"
                  />
                  <input type="text" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="flex-1 px-4 py-3 bg-surface-container-low border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-sm font-label transition-all" />
                </div>
              </div>
            </div>
          </section>

          {/* Pricing Defaults */}
          <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 p-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-primary-container/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-container text-base">sell</span>
              </div>
              <div>
                <h2 className="font-headline font-bold text-on-surface">Pricing Defaults</h2>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant mb-6">Applied to all new estimates. You can override per-estimate in the toolbar.</p>

            <div className="space-y-5">
              <div>
                <label className={labelCls}>Price per Linear Foot</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/10 focus-within:ring-2 focus-within:ring-primary-container transition-all">
                    <span className="pl-4 text-on-surface-variant text-sm">$</span>
                    <input
                      type="number" min={0} step={0.25} value={pricePerFoot}
                      onChange={e => setPricePerFoot(parseFloat(e.target.value) || 0)}
                      className="w-28 bg-transparent px-3 py-3 text-sm text-on-surface focus:outline-none"
                    />
                  </div>
                  <span className="text-on-surface-variant text-sm">/ linear foot</span>
                </div>
              </div>
              <div>
                <label className={labelCls}>Controller Fee</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/10 focus-within:ring-2 focus-within:ring-primary-container transition-all">
                    <span className="pl-4 text-on-surface-variant text-sm">$</span>
                    <input
                      type="number" min={0} step={10} value={controllerFee}
                      onChange={e => setControllerFee(parseFloat(e.target.value) || 0)}
                      className="w-28 bg-transparent px-3 py-3 text-sm text-on-surface focus:outline-none"
                    />
                  </div>
                  <span className="text-on-surface-variant text-sm">flat fee</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeController}
                  onClick={() => setIncludeController(!includeController)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-white ${includeController ? 'bg-primary-container' : 'bg-surface-container-high'}`}
                >
                  <span
                    className={`pointer-events-none absolute left-0.5 top-0.5 block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out ${includeController ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
                <span className="text-sm text-on-surface">Include controller by default</span>
              </div>
            </div>
          </section>

          {/* Plan & Billing */}
          <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-primary-container/10 rounded-lg flex items-center justify-content">
                <span className="material-symbols-outlined text-primary-container text-base">workspace_premium</span>
              </div>
              <div>
                <h2 className="font-headline font-bold text-on-surface">Plan & Billing</h2>
                <p className="text-xs text-on-surface-variant">Your current subscription</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  {profile?.subscription_status === 'active' && (
                    <span className="material-symbols-outlined text-amber-500 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                  )}
                  {profile?.subscription_status === 'active' ? 'Pro Plan' : 'Free Plan'}
                </div>
                <div className="text-xs text-on-surface-variant mt-0.5">
                  {profile?.subscription_status === 'active'
                    ? 'Unlimited estimates · $89/month'
                    : `${profile?.estimates_used ?? 0} of 5 free estimates used`}
                </div>
              </div>
              {profile?.subscription_status !== 'active' ? (
                <button
                  onClick={openUpgrade}
                  className="px-5 py-2.5 amber-gradient text-white font-semibold text-sm rounded-lg shadow-sm active:scale-95 transition-all"
                >
                  Upgrade Plan
                </button>
              ) : (
                <button
                  onClick={() => setCancelConfirm(true)}
                  className="px-4 py-2 text-sm font-medium text-error border border-error/30 rounded-lg hover:bg-error-container/20 transition-colors"
                >
                  Cancel subscription
                </button>
              )}
            </div>

            {/* Cancel confirmation */}
            {cancelConfirm && (
              <div className="mt-5 rounded-xl border border-error/20 bg-error-container/10 p-4">
                <p className="text-sm font-semibold text-on-surface mb-1">Cancel your Pro subscription?</p>
                <p className="text-xs text-on-surface-variant mb-4">
                  You'll keep Pro access until the end of your current billing period. After that, you'll be limited to 5 estimates.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCancelConfirm(false)}
                    disabled={canceling}
                    className="flex-1 py-2 text-sm font-medium rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
                  >
                    Keep Pro
                  </button>
                  <button
                    onClick={() => void handleCancelSubscription()}
                    disabled={canceling}
                    className="flex-1 py-2 text-sm font-bold rounded-lg bg-error text-white hover:bg-error/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {canceling && <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>}
                    {canceling ? 'Canceling…' : 'Yes, cancel'}
                  </button>
                </div>
              </div>
            )}
          </section>

          {error && (
            <div className="bg-error-container/30 border-l-4 border-error p-4 rounded-r-lg">
              <p className="text-sm text-error font-medium">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="amber-gradient text-white font-headline font-bold py-3 px-8 rounded-lg shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? 'Saving…' : 'Save Settings'}
              {!saving && <span className="material-symbols-outlined text-xl">check</span>}
            </button>
            {saved && (
              <span className="text-sm text-tertiary font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-base">check_circle</span>
                Saved!
              </span>
            )}
          </div>
        </div>
      </div>
    </SharedLayout>
    {showProModal && <ProWelcomeModal onClose={() => setShowProModal(false)} />}
    </>
  );
}
