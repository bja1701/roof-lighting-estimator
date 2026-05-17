import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ContractorProfile {
  company_name: string | null;
  full_name: string | null;
  logo_url: string | null;
}

export default function ClientPortalFinalSuccessPage() {
  const { token } = useParams<{ token: string }>();
  const [contractor, setContractor] = useState<ContractorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetchContractor(token);
  }, [token]);

  const fetchContractor = async (portalToken: string) => {
    const { data: jobData } = await supabase
      .from('jobs')
      .select('user_id')
      .eq('portal_token', portalToken)
      .single();

    if (jobData?.user_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_name, full_name, logo_url')
        .eq('id', jobData.user_id)
        .single();
      setContractor((profileData as ContractorProfile) ?? null);
    }
    setLoading(false);
  };

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

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--color-surface)', fontFamily: 'var(--font-body)', color: 'var(--color-ink)' }}
    >
      <div className="max-w-sm w-full text-center space-y-5">
        <div
          className="w-20 h-20 rounded-full mx-auto flex items-center justify-center"
          style={{ background: 'rgba(61,158,106,0.12)' }}
        >
          <CheckCircle size={40} style={{ color: 'var(--color-success)' }} />
        </div>

        {contractor?.logo_url && (
          <img
            src={contractor.logo_url}
            alt="Company logo"
            className="h-12 w-auto object-contain mx-auto"
          />
        )}

        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
          >
            Final payment received!
          </h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--color-slate)' }}>
            {contractor?.company_name || contractor?.full_name ? (
              <>
                <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                  {contractor.company_name || contractor.full_name}
                </span>{' '}
                thanks you — your account is settled in full.
              </>
            ) : (
              'Your account is settled in full. Thank you for your business!'
            )}
          </p>
        </div>

        <p className="text-xs" style={{ color: 'var(--color-border)' }}>
          You'll receive a confirmation email from Stripe. Keep it for your records.
        </p>

        <p className="text-xs" style={{ color: 'var(--color-border)' }}>
          Powered by{' '}
          <span style={{ color: 'var(--color-primary)' }}>Eave</span>
          <span style={{ color: 'var(--color-slate)' }}>HQ</span>
        </p>
      </div>
    </div>
  );
}
