import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import SharedLayout from '../components/SharedLayout';
import NewJobModal from '../components/NewJobModal';
import { streetViewStaticImageUrl } from '../utils/streetViewStatic';
import JobStatusBadge from '../components/JobStatusBadge';
import { Job } from '../types/job';

/** Street View Static thumbnail from job address, or placeholder when missing / unavailable. */
function JobCardCover({
  address,
  jobName,
  mapsApiKey,
}: {
  address: string | null;
  jobName: string;
  mapsApiKey: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const url =
    mapsApiKey && address?.trim()
      ? streetViewStaticImageUrl({
          location: address.trim(),
          apiKey: mapsApiKey,
          width: 640,
          height: 360,
        })
      : '';

  if (!url || imgFailed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-container-low">
        <span className="material-symbols-outlined text-5xl text-on-surface-variant/35" aria-hidden>
          roofing
        </span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={`Street View near ${jobName}`}
      className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
      onError={() => setImgFailed(true)}
      loading="lazy"
      decoding="async"
    />
  );
}

export default function JobsPage() {
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
  const navigate = useNavigate();
  const location = useLocation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewJob, setShowNewJob] = useState(false);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [jobPendingDelete, setJobPendingDelete] = useState<Job | null>(null);
  const [estimateLimitBanner, setEstimateLimitBanner] = useState(false);

  useEffect(() => { fetchJobs(); }, []);

  useEffect(() => {
    const state = location.state as { reason?: string } | null | undefined;
    if (state?.reason !== 'estimate_limit') return;
    setEstimateLimitBanner(true);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (!jobPendingDelete || deletingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setJobPendingDelete(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jobPendingDelete, deletingId]);

  const fetchJobs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('jobs')
      .select('*, quotes(count)')
      .order('created_at', { ascending: false });
    if (data) {
      setJobs(data.map((j: any) => ({ ...j, quote_count: j.quotes?.[0]?.count ?? 0 })));
    }
    setLoading(false);
  };

  const filtered = jobs.filter(j =>
    j.name.toLowerCase().includes(search.toLowerCase()) ||
    (j.address ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openDeleteConfirm = (job: Job, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setJobPendingDelete(job);
  };

  const cancelDeleteConfirm = () => {
    if (deletingId) return;
    setJobPendingDelete(null);
  };

  const confirmDeleteJob = async () => {
    const job = jobPendingDelete;
    if (!job) return;
    setDeletingId(job.id);
    const { error } = await supabase.from('jobs').delete().eq('id', job.id);
    setDeletingId(null);
    if (error) {
      alert(error.message);
      return;
    }
    setJobs((list) => list.filter((j) => j.id !== job.id));
    setJobPendingDelete(null);
  };

  return (
    <SharedLayout>
      <div className="px-6 md:px-10 py-10 max-w-6xl mx-auto">
        {estimateLimitBanner && (
          <div
            role="status"
            className="mb-6 flex flex-col gap-3 rounded-xl border border-outline-variant/20 bg-tertiary-container/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-on-surface">
              You&apos;ve used all <strong>5</strong> free estimates. The estimator is locked until you upgrade your plan.
            </p>
            <button
              type="button"
              onClick={() => setEstimateLimitBanner(false)}
              className="shrink-0 rounded-lg bg-surface-container-lowest px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low"
            >
              Dismiss
            </button>
          </div>
        )}
        {/* Page header */}
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="mb-2 font-headline text-5xl font-black tracking-tight text-on-surface">Jobs</h1>
            <p className="max-w-2xl text-lg text-on-surface-variant">
              Manage your active roofing projects, client estimates, and site documentation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewJob(true)}
            className="amber-gradient flex shrink-0 items-center gap-2 self-start rounded-lg py-3 px-6 font-headline font-bold text-white shadow-md transition-all active:scale-95 sm:self-center"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            New Job
          </button>
        </div>

        {/* Search + filter bar */}
        <div className="mb-8 flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[260px] relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">search</span>
            <input
              type="text"
              placeholder="Search by client name, address, or job…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest border-none rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-container text-on-surface placeholder:text-on-surface-variant/50 transition-all"
            />
          </div>
        </div>

        {/* Jobs Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden animate-pulse">
                <div className="h-32 bg-surface-container-low" />
                <div className="p-6 space-y-3">
                  <div className="h-4 bg-surface-container-low rounded w-3/4" />
                  <div className="h-3 bg-surface-container-low rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-surface-container-lowest rounded-2xl shadow-sm">
            <div className="w-16 h-16 bg-surface-container rounded-2xl mx-auto mb-5 flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant text-3xl">home_work</span>
            </div>
            <h3 className="font-headline font-bold text-xl text-on-surface mb-2">No jobs yet</h3>
            <p className="text-on-surface-variant text-sm mb-6">Create your first job to start estimating rooflines</p>
            <button
              onClick={() => setShowNewJob(true)}
              className="amber-gradient text-white font-headline font-bold py-3 px-8 rounded-lg shadow-md active:scale-95 transition-all"
            >
              Create First Job
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((job) => {
              return (
                <div
                  key={job.id}
                  className="group bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-outline-variant/10 cursor-pointer"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  <div className="relative h-32 w-full overflow-hidden bg-surface-container-low">
                    <JobCardCover address={job.address} jobName={job.name} mapsApiKey={mapsApiKey} />
                    <button
                      type="button"
                      aria-label={`Delete job ${job.name}`}
                      disabled={deletingId === job.id}
                      onClick={(e) => openDeleteConfirm(job, e)}
                      className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 bg-white/95 text-error opacity-0 shadow-sm backdrop-blur-sm pointer-events-none transition-all duration-200 hover:bg-error-container/25 group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error disabled:pointer-events-none"
                      title="Delete job"
                    >
                      <span
                        className={`material-symbols-outlined text-xl ${deletingId === job.id ? 'animate-spin' : ''}`}
                      >
                        {deletingId === job.id ? 'progress_activity' : 'delete'}
                      </span>
                    </button>
                    <div className="absolute top-3 right-3">
                      <JobStatusBadge status={job.status ?? 'estimate_sent'} size="sm" />
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-headline font-bold text-on-surface mb-1">{job.name}</h3>
                    {job.address && (
                      <p className="text-sm text-on-surface-variant flex items-center gap-1 mb-4">
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        {job.address}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 mb-5">
                      <div>
                        <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant mb-1">Created</p>
                        <p className="text-sm font-semibold text-on-surface">
                          {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant mb-1">Estimates</p>
                        <p className="text-sm font-semibold text-on-surface">{job.quote_count ?? 0} saved</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between w-full py-3 px-4 bg-surface-container-low text-primary font-bold rounded-lg group-hover:bg-primary group-hover:text-white transition-all">
                      <span>View Details</span>
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNewJob && (
        <NewJobModal
          onCreated={(jobId) => { setShowNewJob(false); fetchJobs(); navigate(`/jobs/${jobId}`); }}
          onClose={() => setShowNewJob(false)}
        />
      )}

      {jobPendingDelete && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-inverse-surface/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-job-title"
          onClick={(e) => e.target === e.currentTarget && cancelDeleteConfirm()}
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-lowest shadow-[0px_20px_40px_rgba(17,28,45,0.15)]">
            <div className="h-1 w-full bg-error" />
            <div className="p-7">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-error-container/40">
                  <span className="material-symbols-outlined text-error text-2xl">delete_forever</span>
                </div>
                <h2 id="delete-job-title" className="font-headline text-xl font-bold text-on-surface">
                  Delete job?
                </h2>
              </div>
              <p className="mb-2 text-on-surface-variant">
                <span className="font-semibold text-on-surface">“{jobPendingDelete.name}”</span> will be removed permanently.
              </p>
              {(jobPendingDelete.quote_count ?? 0) > 0 && (
                <p className="mb-6 text-sm text-error">
                  This also deletes {jobPendingDelete.quote_count} saved estimate
                  {(jobPendingDelete.quote_count ?? 0) === 1 ? '' : 's'}.
                </p>
              )}
              {(jobPendingDelete.quote_count ?? 0) === 0 && <p className="mb-6 text-sm text-on-surface-variant">This cannot be undone.</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelDeleteConfirm}
                  disabled={!!deletingId}
                  className="flex-1 rounded-lg bg-surface-container-low py-3 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteJob()}
                  disabled={!!deletingId}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-error/50 bg-error py-3 text-sm font-headline font-bold text-white transition-colors hover:bg-error/90 disabled:opacity-50"
                >
                  {deletingId ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                      Deleting…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">delete</span>
                      Delete job
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SharedLayout>
  );
}
