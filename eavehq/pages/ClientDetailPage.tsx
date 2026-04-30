import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import SharedLayout from '../components/SharedLayout';
import JobStatusBadge from '../components/JobStatusBadge';
import { Client } from '../types/client';
import { Job } from '../types/job';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) void fetchData(id);
  }, [id]);

  const fetchData = async (clientId: string) => {
    setLoading(true);
    const [{ data: clientData }, { data: jobsData }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase
        .from('jobs')
        .select('*, quotes(count)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
    ]);
    setClient(clientData ?? null);
    setJobs((jobsData ?? []).map((j: any) => ({ ...j, quote_count: j.quotes?.[0]?.count ?? 0 })));
    setLoading(false);
  };

  if (loading) {
    return (
      <SharedLayout>
        <div className="flex items-center justify-center py-32 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
          Loading…
        </div>
      </SharedLayout>
    );
  }

  if (!client) {
    return (
      <SharedLayout>
        <div className="flex items-center justify-center py-32 text-on-surface-variant">Client not found.</div>
      </SharedLayout>
    );
  }

  const fullAddress = [client.address_street, client.address_city, client.address_zip].filter(Boolean).join(', ');

  return (
    <SharedLayout>
      <div className="px-4 sm:px-6 md:px-10 py-8 max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-on-surface-variant text-sm font-label uppercase tracking-widest mb-6">
          <button
            onClick={() => navigate('/clients')}
            className="hover:text-primary transition-colors flex items-center gap-1 min-h-[44px]"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Clients
          </button>
          <span>/</span>
          <span className="text-on-surface font-bold">{client.name}</span>
        </nav>

        {/* Client card */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-14 h-14 rounded-2xl amber-gradient flex items-center justify-center shrink-0">
              <span className="text-white font-headline font-bold text-2xl">
                {client.name[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-headline text-3xl font-black text-on-surface tracking-tight mb-1">{client.name}</h1>
              {client.company_name && (
                <p className="text-on-surface-variant text-sm mb-3">{client.company_name}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {client.email && (
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-base text-primary-container">email</span>
                    <a href={`mailto:${client.email}`} className="hover:text-primary transition-colors">{client.email}</a>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-base text-primary-container">phone</span>
                    <a href={`tel:${client.phone}`} className="hover:text-primary transition-colors">{client.phone}</a>
                  </div>
                )}
                {fullAddress && (
                  <div className="flex items-center gap-2 text-on-surface-variant sm:col-span-2">
                    <span className="material-symbols-outlined text-base text-primary-container">location_on</span>
                    <span>{fullAddress}</span>
                  </div>
                )}
              </div>
              {client.notes && (
                <div className="mt-4 p-3 bg-surface-container-low rounded-lg text-sm text-on-surface-variant">
                  {client.notes}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Job history */}
        <h2 className="font-headline font-bold text-lg text-on-surface mb-4">Job History</h2>
        {jobs.length === 0 ? (
          <div className="text-center py-16 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-3 block">home_work</span>
            <p className="text-on-surface-variant text-sm">No jobs linked to this client yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map(job => (
              <button
                key={job.id}
                type="button"
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="w-full text-left bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 px-4 py-4 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center gap-2 min-h-[44px]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-headline font-bold text-on-surface">{job.name}</span>
                    <JobStatusBadge status={job.status} size="sm" />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-on-surface-variant">
                    {job.address && (
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        {job.address}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">calendar_today</span>
                      {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span>{job.quote_count ?? 0} estimate{(job.quote_count ?? 0) !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-lg shrink-0">chevron_right</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </SharedLayout>
  );
}
