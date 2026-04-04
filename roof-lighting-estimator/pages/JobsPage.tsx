import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useProfile } from '../hooks/useProfile';
import SharedLayout from '../components/SharedLayout';
import NewJobModal from '../components/NewJobModal';

interface Job {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  created_at: string;
  quote_count?: number;
}

const STATUS_COLORS: Record<number, { label: string; cls: string }> = {
  0: { label: 'No Estimates', cls: 'bg-surface-container text-on-surface-variant' },
  1: { label: 'In Progress', cls: 'bg-secondary-container text-on-secondary-container' },
};

function getStatusChip(count: number) {
  if (count === 0) return STATUS_COLORS[0];
  if (count >= 1) return { label: `${count} Estimate${count > 1 ? 's' : ''}`, cls: 'bg-tertiary-container/30 text-tertiary' };
  return STATUS_COLORS[0];
}

// Roof image bank — rotate through for visual interest
const CARD_IMAGES = [
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1513584684374-8bab748fbf90?w=400&h=200&fit=crop',
];

export default function JobsPage() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewJob, setShowNewJob] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchJobs(); }, []);

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

  return (
    <SharedLayout>
      <div className="px-6 md:px-10 py-10 max-w-6xl mx-auto">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="font-headline font-black text-5xl tracking-tight text-on-surface mb-2">Jobs</h1>
            <p className="text-lg text-on-surface-variant">Manage your active roofing projects, client estimates, and site documentation.</p>
          </div>
          <div className="flex flex-col items-end gap-4">
            {profile?.subscription_tier === 'free' && (
              <div className="w-64 bg-surface-container rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-label uppercase tracking-wider text-secondary">Usage Tier</span>
                  <span className="text-xs font-bold text-on-surface">{profile.estimates_used ?? 0} / 5 estimates</span>
                </div>
                <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                  <div
                    className="amber-gradient h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((profile.estimates_used ?? 0) / 5) * 100)}%` }}
                  />
                </div>
                {(profile.estimates_used ?? 0) >= 5 && (
                  <p className="text-[10px] text-error mt-2 font-medium">Limit reached — contact us to upgrade</p>
                )}
              </div>
            )}
            <button
              onClick={() => setShowNewJob(true)}
              className="amber-gradient text-white font-headline font-bold py-3 px-6 rounded-lg shadow-md flex items-center gap-2 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-xl">add</span>
              New Job
            </button>
          </div>
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
            {filtered.map((job, idx) => {
              const chip = getStatusChip(job.quote_count ?? 0);
              return (
                <div
                  key={job.id}
                  className="group bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-outline-variant/10 cursor-pointer"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  {/* Image header */}
                  <div className="h-32 w-full overflow-hidden relative bg-surface-container-low">
                    <img
                      src={CARD_IMAGES[idx % CARD_IMAGES.length]}
                      alt={job.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${chip.cls}`}>
                      {chip.label}
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
    </SharedLayout>
  );
}
