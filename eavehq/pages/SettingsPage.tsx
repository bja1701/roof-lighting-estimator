import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Building2, DollarSign, Bell, CreditCard, Zap, Check, Upload, Image, ExternalLink, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { useUpgradeModal } from '../hooks/useUpgradeModal';
import SharedLayout from '../components/SharedLayout';
import ProWelcomeModal from '../components/ProWelcomeModal';
import { hasProAccess } from '../utils/estimatorAccess';

interface ConnectStatus {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled?: boolean;
}

const LOGO_MAX_BYTES = 10 * 1024 * 1024;
function formatMaxLogoMb() { return String(Math.round(LOGO_MAX_BYTES / (1024 * 1024))); }

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--color-slate)',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-ink)',
  fontSize: '0.875rem',
  outline: 'none',
  transition: 'border-color 150ms ease',
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { profile, fetchProfile, updateProfile } = useProfile();
  const { open: openUpgrade } = useUpgradeModal();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const upgradeSuccess = searchParams.get('upgrade') === 'success';
  const stripeParam = searchParams.get('stripe');

  const [showProModal, setShowProModal] = useState(upgradeSuccess);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(true);
  const [connectLinking, setConnectLinking] = useState(false);
  const [connectToast, setConnectToast] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [pendingActivation, setPendingActivation] = useState(upgradeSuccess);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!upgradeSuccess || !user) return;
    if (profile?.subscription_status === 'active') { setPendingActivation(false); return; }
    let attempts = 0;
    const MAX_ATTEMPTS = 7;
    pollRef.current = setInterval(async () => {
      attempts++;
      await fetchProfile(user.id);
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setPendingActivation(false);
      }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upgradeSuccess, user]);

  useEffect(() => {
    if (profile?.subscription_status === 'active' && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      setPendingActivation(false);
    }
  }, [profile?.subscription_status]);

  const handleCancelSubscription = async () => {
    setCanceling(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error: fnError } = await supabase.functions.invoke('cancel-subscription', {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setCanceling(false);
    setCancelConfirm(false);
    if (fnError || !data?.ok) { setError('Failed to cancel subscription. Please try again or contact support.'); return; }
    window.location.reload();
  };

  const checkConnectStatus = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error: fnError } = await supabase.functions.invoke('check-connect-status', {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (!fnError && data) setConnectStatus(data as ConnectStatus);
    setConnectLoading(false);
  }, []);

  useEffect(() => { void checkConnectStatus(); }, [checkConnectStatus]);

  useEffect(() => {
    if (stripeParam === 'success') {
      void checkConnectStatus().then(() => { setConnectToast(true); setTimeout(() => setConnectToast(false), 4000); });
    } else if (stripeParam === 'refresh') {
      void checkConnectStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectStripe = async () => {
    setConnectLinking(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error: fnError } = await supabase.functions.invoke('create-connect-link', {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setConnectLinking(false);
    if (fnError || !data?.url) { setError('Could not start Stripe onboarding. Please try again.'); return; }
    window.location.href = data.url;
  };

  const handleManageBilling = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error: fnError } = await supabase.functions.invoke('create-portal-session', {
      headers: { Authorization: `Bearer ${session?.access_token}` },
      body: { returnUrl: window.location.origin },
    });
    if (fnError || !data?.url) { setError('Could not open billing portal. Please try again or contact support.'); return; }
    window.location.href = data.url;
  }, []);

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [brandColor, setBrandColor] = useState('#f59e0b');
  const [pricePerFoot, setPricePerFoot] = useState(4.0);
  const [controllerFee, setControllerFee] = useState(300.0);
  const [includeController, setIncludeController] = useState(true);
  const [logoUrl, setLogoUrl] = useState('');
  const [followupDays, setFollowupDays] = useState(3);
  const [followupMax, setFollowupMax] = useState(2);
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
      setFollowupDays(profile.followup_days ?? 3);
      setFollowupMax(profile.followup_max ?? 2);
    }
  }, [profile]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setError('');
    if (file.size > LOGO_MAX_BYTES) {
      setError(`That file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Logos must be at most ${formatMaxLogoMb()} MB.`);
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
          ? 'Logo upload is blocked by Storage security rules. Run the logos bucket migration in Supabase.'
          : /exceeded the maximum|maximum allowed size|too large/i.test(msg)
            ? `File too large. Shrink the image under ${formatMaxLogoMb()} MB.`
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
      followup_days: followupDays,
      followup_max: followupMax,
    } as any);
    setSaving(false);
    if (err) { setError(err); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <>
      <SharedLayout>
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-10" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-ink)' }}>
          <div className="mb-12">
            <h1 className="font-black text-4xl tracking-tight mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
              Settings
            </h1>
            <p className="text-lg" style={{ color: 'var(--color-slate)' }}>
              Manage your company branding, pricing defaults, and account details.
            </p>
          </div>

          <div className="space-y-6">
            {/* Company Branding */}
            <Section icon={<Building2 size={16} />} title="Company Branding" subtitle="Shown on all PDF exports and proposals">
              <div className="mb-6">
                <label style={labelStyle}>Logo</label>
                <div className="flex items-center gap-5">
                  <div
                    className="w-20 h-20 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                  >
                    {logoUrl
                      ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                      : <Image size={28} style={{ color: 'var(--color-border)' }} />
                    }
                  </div>
                  <div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                      style={{ background: 'var(--color-surface)', color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                    >
                      <Upload size={15} />
                      {uploading ? 'Uploading…' : 'Upload Logo'}
                    </button>
                    <p className="text-xs mt-1.5" style={{ color: 'var(--color-slate)' }}>
                      PNG or JPG, max {formatMaxLogoMb()} MB.
                    </p>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label style={labelStyle}>Company Name</label>
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your Company" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Your Name</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Brighton Jones" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(801) 555-0100" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Brand Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={e => setBrandColor(e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer p-1"
                      style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                    />
                    <input
                      type="text"
                      value={brandColor}
                      onChange={e => setBrandColor(e.target.value)}
                      style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>
              </div>
            </Section>

            {/* Pricing Defaults */}
            <Section icon={<DollarSign size={16} />} title="Pricing Defaults" subtitle="Applied to all new estimates. Override per-estimate in the toolbar.">
              <div className="space-y-5">
                <div>
                  <label style={labelStyle}>Price per Linear Foot</label>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center rounded-lg overflow-hidden"
                      style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                    >
                      <span className="pl-4 text-sm" style={{ color: 'var(--color-slate)' }}>$</span>
                      <input
                        type="number" min={0} step={0.25} value={pricePerFoot}
                        onChange={e => setPricePerFoot(parseFloat(e.target.value) || 0)}
                        className="w-28 bg-transparent px-3 py-3 text-sm focus:outline-none"
                        style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                    <span className="text-sm" style={{ color: 'var(--color-slate)' }}>/ linear foot</span>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Controller Fee</label>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center rounded-lg overflow-hidden"
                      style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                    >
                      <span className="pl-4 text-sm" style={{ color: 'var(--color-slate)' }}>$</span>
                      <input
                        type="number" min={0} step={10} value={controllerFee}
                        onChange={e => setControllerFee(parseFloat(e.target.value) || 0)}
                        className="w-28 bg-transparent px-3 py-3 text-sm focus:outline-none"
                        style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                    <span className="text-sm" style={{ color: 'var(--color-slate)' }}>flat fee</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includeController}
                    onClick={() => setIncludeController(!includeController)}
                    className="relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none"
                    style={{ background: includeController ? 'var(--color-primary)' : 'var(--color-border)' }}
                  >
                    <span
                      className="pointer-events-none absolute left-0.5 top-0.5 block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
                      style={{ transform: includeController ? 'translateX(20px)' : 'translateX(0)' }}
                    />
                  </button>
                  <span className="text-sm" style={{ color: 'var(--color-ink)' }}>Include controller by default</span>
                </div>
              </div>
            </Section>

            {/* Auto Follow-up */}
            <Section icon={<Bell size={16} />} title="Auto Follow-up" subtitle="Automatically remind clients who haven't responded to their estimate.">
              <div className="space-y-5">
                <div>
                  <label style={labelStyle}>Send follow-up after X days of no response</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number" min={1} max={30} step={1} value={followupDays}
                      onChange={e => setFollowupDays(parseInt(e.target.value, 10) || 1)}
                      className="w-20 px-4 py-3 text-sm focus:outline-none rounded-lg"
                      style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}
                    />
                    <span className="text-sm" style={{ color: 'var(--color-slate)' }}>days</span>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Maximum follow-ups</label>
                  <select
                    value={followupMax}
                    onChange={e => setFollowupMax(parseInt(e.target.value, 10))}
                    className="w-32 px-4 py-3 text-sm focus:outline-none rounded-lg"
                    style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-ink)' }}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </select>
                </div>
              </div>
            </Section>

            {/* Payments */}
            <Section icon={<CreditCard size={16} />} title="Payments" subtitle="Receive client deposits directly into your account">
              {connectToast && (
                <div
                  className="mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium"
                  style={{ background: 'rgba(61,158,106,0.1)', border: '1px solid rgba(61,158,106,0.25)', color: '#1a5c38' }}
                >
                  <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
                  Stripe account connected successfully.
                </div>
              )}

              {connectLoading ? (
                <div className="flex items-center gap-2 text-sm py-2" style={{ color: 'var(--color-slate)' }}>
                  <Loader2 size={16} className="animate-spin" />
                  Checking status…
                </div>
              ) : connectStatus?.charges_enabled ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                      <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
                      Stripe Connected
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>
                      You're set up to accept payments. Clients pay directly to your account.
                    </p>
                  </div>
                  <a
                    href="https://dashboard.stripe.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                    style={{ color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    Manage on Stripe
                    <ExternalLink size={13} />
                  </a>
                </div>
              ) : connectStatus?.connected ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                      <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />
                      Stripe Setup Incomplete
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>
                      Finish setting up your Stripe account to start accepting payments.
                    </p>
                  </div>
                  <AccentButton onClick={() => void handleConnectStripe()} loading={connectLinking}>
                    {connectLinking ? 'Opening…' : 'Continue Setup'}
                  </AccentButton>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>Accept Client Payments</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>
                      Connect your Stripe account to receive deposits and final payments directly from clients.
                    </p>
                  </div>
                  <AccentButton onClick={() => void handleConnectStripe()} loading={connectLinking}>
                    {connectLinking ? 'Opening…' : 'Connect Stripe Account'}
                  </AccentButton>
                </div>
              )}
            </Section>

            {/* Plan & Billing */}
            <Section icon={<Zap size={16} />} title="Plan & Billing" subtitle="Your current subscription">
              {pendingActivation ? (
                <div className="flex items-center gap-3 py-2">
                  <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                  <span className="text-sm" style={{ color: 'var(--color-slate)' }}>Activating your plan…</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-ink)' }}>
                        {hasProAccess(profile) && <Zap size={14} style={{ color: 'var(--color-accent)' }} />}
                        {hasProAccess(profile) ? 'Pro Plan' : 'Free Plan'}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>
                        {profile?.subscription_status === 'active' && 'Unlimited estimates · $89/month'}
                        {profile?.subscription_status === 'canceling' && 'Cancels at end of billing period · still have full access'}
                        {!hasProAccess(profile) && `${profile?.estimates_used ?? 0} of 5 free estimates used`}
                      </div>
                      {upgradeSuccess && profile?.subscription_status !== 'active' && profile?.subscription_status !== 'canceling' && (
                        <p className="text-xs mt-1" style={{ color: 'var(--color-slate)' }}>
                          If your plan doesn't appear active within a minute, contact support.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {!hasProAccess(profile) ? (
                        <AccentButton onClick={openUpgrade}>Upgrade Plan</AccentButton>
                      ) : (
                        <>
                          <button
                            onClick={() => void handleManageBilling()}
                            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                            style={{ color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            Manage billing
                          </button>
                          {profile?.subscription_status === 'active' && (
                            <button
                              onClick={() => setCancelConfirm(true)}
                              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                              style={{ color: 'var(--color-destructive)', border: '1px solid rgba(201,64,64,0.25)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,64,64,0.06)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              Cancel subscription
                            </button>
                          )}
                          {profile?.subscription_status === 'canceling' && (
                            <span className="text-xs italic" style={{ color: 'var(--color-slate)' }}>Cancellation pending</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {cancelConfirm && (
                    <div
                      className="mt-5 rounded-xl p-4"
                      style={{ border: '1px solid rgba(201,64,64,0.2)', background: 'rgba(201,64,64,0.05)' }}
                    >
                      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-ink)' }}>
                        Cancel your Pro subscription?
                      </p>
                      <p className="text-xs mb-4" style={{ color: 'var(--color-slate)' }}>
                        You'll keep Pro access until the end of your current billing period. After that, you'll be limited to 5 estimates.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setCancelConfirm(false)}
                          disabled={canceling}
                          className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors"
                          style={{ background: 'var(--color-surface)', color: 'var(--color-slate)', border: '1px solid var(--color-border)' }}
                        >
                          Keep Pro
                        </button>
                        <button
                          onClick={() => void handleCancelSubscription()}
                          disabled={canceling}
                          className="flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                          style={{ background: 'var(--color-destructive)', color: '#fff' }}
                        >
                          {canceling && <Loader2 size={14} className="animate-spin" />}
                          {canceling ? 'Canceling…' : 'Yes, cancel'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Section>

            {error && (
              <div
                className="px-4 py-3 rounded-lg"
                style={{ background: 'rgba(201,64,64,0.08)', border: '1px solid rgba(201,64,64,0.2)' }}
              >
                <p className="text-sm font-medium" style={{ color: 'var(--color-destructive)' }}>{error}</p>
              </div>
            )}

            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 font-bold py-3 px-8 rounded-lg transition-all active:scale-95"
                style={{
                  background: saving ? 'var(--color-border)' : 'var(--color-accent)',
                  color: saving ? 'var(--color-slate)' : '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-display)',
                  boxShadow: saving ? 'none' : '0 4px 14px rgba(217,111,10,0.3)',
                }}
              >
                {saving ? 'Saving…' : 'Save Settings'}
                {!saving && <Check size={18} />}
              </button>
              {saved && (
                <span className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
                  <CheckCircle size={15} />
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

function Section({ icon, title, subtitle, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl p-8"
      style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(58,99,73,0.1)', color: 'var(--color-primary)' }}
        >
          {icon}
        </div>
        <div>
          <h2 className="font-bold text-base" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
            {title}
          </h2>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function AccentButton({ children, onClick, loading }: { children: React.ReactNode; onClick?: () => void; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all active:scale-95"
      style={{
        background: 'var(--color-accent)',
        color: '#fff',
        boxShadow: '0 2px 8px rgba(217,111,10,0.25)',
        opacity: loading ? 0.6 : 1,
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}
