import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import SharedLayout from '../components/SharedLayout';
import NewJobModal from '../components/NewJobModal';
import SetupChecklist from '../components/SetupChecklist';
import JobStatusBadge from '../components/JobStatusBadge';
import { useProfile } from '../hooks/useProfile';
import { Job, JobStatus } from '../types/job';

// ─── Filter types ────────────────────────────────────────────────────────────

type ListFilter = 'active' | 'completed' | 'archived';
type DashboardTab = 'list' | 'schedule';

const ACTIVE_STATUSES: JobStatus[] = ['estimate_sent', 'deposit_paid', 'scheduled', 'in_progress'];
const COMPLETED_STATUSES: JobStatus[] = ['complete', 'final_paid'];

function filterJobs(jobs: Job[], filter: ListFilter): Job[] {
  if (filter === 'active') return jobs.filter(j => ACTIVE_STATUSES.includes(j.status));
  if (filter === 'completed') return jobs.filter(j => COMPLETED_STATUSES.includes(j.status));
  // archived: no archived status yet — reserved bucket, show empty
  return [];
}

// ─── Weekly calendar helpers ─────────────────────────────────────────────────

function getWeekDates(anchor: Date): Date[] {
  const start = new Date(anchor);
  const day = start.getDay(); // 0=Sun
  start.setDate(start.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function WeeklyCalendar({ jobs, onJobClick }: { jobs: Job[]; onJobClick: (id: string) => void }) {
  const [anchor, setAnchor] = useState(new Date());
  const weekDates = getWeekDates(anchor);

  const prevWeek = () => {
    const d = new Date(anchor);
    d.setDate(d.getDate() - 7);
    setAnchor(d);
  };
  const nextWeek = () => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + 7);
    setAnchor(d);
  };

  const jobsForDay = (date: Date): Job[] =>
    jobs.filter(j => {
      if (!j.scheduled_date) return false;
      const jd = new Date(j.scheduled_date + 'T00:00:00');
      return isSameDay(jd, date);
    });

  const today = new Date();
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const weekLabel = `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div>
      {/* Week nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevWeek}
          className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-surface-container-low transition-colors min-h-[44px] min-w-[44px]"
          aria-label="Previous week"
        >
          <span className="material-symbols-outlined text-xl text-on-surface-variant">chevron_left</span>
        </button>
        <span className="text-sm font-semibold text-on-surface">{weekLabel}</span>
        <button
          type="button"
          onClick={nextWeek}
          className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-surface-container-low transition-colors min-h-[44px] min-w-[44px]"
          aria-label="Next week"
        >
          <span className="material-symbols-outlined text-xl text-on-surface-variant">chevron_right</span>
        </button>
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {weekDates.map((date, i) => {
          const isToday = isSameDay(date, today);
          const dayJobs = jobsForDay(date);
          return (
            <div key={i} className="flex flex-col min-h-[120px]">
              {/* Day header */}
              <div className={`text-center mb-1 rounded-lg py-1 ${isToday ? 'bg-primary text-white' : ''}`}>
                <p className={`text-[10px] font-label uppercase tracking-wider ${isToday ? 'text-white' : 'text-on-surface-variant'}`}>
                  {DAY_NAMES[i]}
                </p>
                <p className={`text-sm font-bold ${isToday ? 'text-white' : 'text-on-surface'}`}>
                  {date.getDate()}
                </p>
              </div>
              {/* Jobs */}
              <div className="flex flex-col gap-1 flex-1">
                {dayJobs.map(job => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => onJobClick(job.id)}
                    className="w-full text-left rounded-md bg-primary-container/20 border border-primary-container/30 px-1.5 py-1 text-[10px] sm:text-xs font-medium text-on-surface hover:bg-primary-container/40 transition-colors min-h-[44px] flex flex-col justify-center"
                    title={job.name}
                  >
                    <span className="block truncate">{job.name}</span>
                    {job.status !== 'estimate_sent' && <JobStatusBadge status={job.status} size="sm" />}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {jobs.filter(j => j.scheduled_date).length === 0 && (
        <p className="text-center text-on-surface-variant text-sm mt-8">
          No jobs with a scheduled date yet. Open a job and set a scheduled date to see it here.
        </p>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewJob, setShowNewJob] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ListFilter>('active');
  const [tab, setTab] = useState<DashboardTab>('list');
  const [estimateLimitBanner, setEstimateLimitBanner] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('jobs')
      .select('*, quotes(count)')
      .order('created_at', { ascending: false });
    if (error) console.error('[DashboardPage] fetchJobs error:', error);
    if (data) {
      const mapped = data.map((j: any) => ({ ...j, quote_count: j.quotes?.[0]?.count ?? 0 }));
      // Sort by scheduled_date client-side (nulls last) if the column exists
      mapped.sort((a: any, b: any) => {
        if (!a.scheduled_date && !b.scheduled_date) return 0;
        if (!a.scheduled_date) return 1;
        if (!b.scheduled_date) return -1;
        return a.scheduled_date < b.scheduled_date ? -1 : 1;
      });
      setJobs(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    const state = location.state as { reason?: string } | null | undefined;
    if (state?.reason !== 'estimate_limit') return;
    setEstimateLimitBanner(true);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  const visibleJobs = filterJobs(jobs, filter).filter(j =>
    j.name.toLowerCase().includes(search.toLowerCase()) ||
    (j.address ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (j.client_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const FILTERS: { key: ListFilter; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'archived', label: 'Archived' },
  ];

  return (
    <SharedLayout>
      <div className="px-4 sm:px-6 md:px-10 py-8 max-w-6xl mx-auto">
        <SetupChecklist profile={profile} />

        {estimateLimitBanner && (
          <div
            role="status"
            className="mb-6 flex flex-col gap-3 rounded-xl border border-outline-variant/20 bg-tertiary-container/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-on-surface">
              You&apos;ve used all <strong>5</strong> free estimates. The estimator is locked until you upgrade.
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
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-headline text-4xl font-black tracking-tight text-on-surface">Dashboard</h1>
            <p className="text-on-surface-variant text-sm mt-1">All your jobs in one place.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/clients')}
              className="flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest py-2.5 px-4 font-headline text-sm font-bold text-on-surface shadow-sm transition-colors hover:bg-surface-container-low min-h-[44px]"
            >
              <span className="material-symbols-outlined text-lg">contacts</span>
              Clients
            </button>
            <button
              type="button"
              onClick={() => setShowNewJob(true)}
              className="amber-gradient flex items-center gap-2 rounded-lg py-2.5 px-5 font-headline font-bold text-white shadow-md transition-all active:scale-95 min-h-[44px]"
            >
              <span className="material-symbols-outlined text-xl">add</span>
              New Job
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mb-6 bg-surface-container-low rounded-xl p-1 w-fit">
          {(['list', 'schedule'] as DashboardTab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all min-h-[40px] capitalize ${
                tab === t
                  ? 'bg-white shadow-sm text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t === 'list' ? 'List' : 'Schedule'}
            </button>
          ))}
        </div>

        {tab === 'list' ? (
          <>
            {/* Filter + Search */}
            <div className="mb-5 flex flex-col sm:flex-row gap-3">
              <div className="flex gap-1 bg-surface-container-low rounded-xl p-1">
                {FILTERS.map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all min-h-[40px] ${
                      filter === f.key
                        ? 'bg-white shadow-sm text-on-surface'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 relative min-w-0">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">search</span>
                <input
                  type="text"
                  placeholder="Search jobs, clients, addresses…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border-none rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-container text-on-surface placeholder:text-on-surface-variant/50 transition-all min-h-[44px]"
                />
              </div>
            </div>

            {/* Job list */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-surface-container-lowest rounded-xl shadow-sm p-4 animate-pulse">
                    <div className="h-4 bg-surface-container-low rounded w-1/3 mb-2" />
                    <div className="h-3 bg-surface-container-low rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : visibleJobs.length === 0 ? (
              <div className="text-center py-20 bg-surface-container-lowest rounded-2xl shadow-sm">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4 block">home_work</span>
                <h3 className="font-headline font-bold text-lg text-on-surface mb-1">
                  {filter === 'archived' ? 'No archived jobs' : `No ${filter} jobs`}
                </h3>
                <p className="text-on-surface-variant text-sm">
                  {filter === 'active' ? (
                    <>Create your first job to get started.</>
                  ) : filter === 'completed' ? (
                    <>Completed jobs will appear here.</>
                  ) : (
                    <>Archived jobs will appear here.</>
                  )}
                </p>
                {filter === 'active' && (
                  <button
                    onClick={() => setShowNewJob(true)}
                    className="mt-6 amber-gradient text-white font-headline font-bold py-3 px-8 rounded-lg shadow-md active:scale-95 transition-all min-h-[44px]"
                  >
                    Create First Job
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleJobs.map(job => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="w-full text-left bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 px-4 py-4 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center gap-3 min-h-[44px]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-headline font-bold text-on-surface text-base">{job.name}</h3>
                        {job.status !== 'estimate_sent' && <JobStatusBadge status={job.status} size="sm" />}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-on-surface-variant">
                        {job.client_name && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">person</span>
                            {job.client_name}
                          </span>
                        )}
                        {job.address && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">location_on</span>
                            {job.address}
                          </span>
                        )}
                        {job.scheduled_date && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">calendar_today</span>
                            {new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface-variant shrink-0">
                      <span className="text-xs">{job.quote_count ?? 0} estimate{(job.quote_count ?? 0) !== 1 ? 's' : ''}</span>
                      <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Schedule tab */
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 p-4 overflow-x-auto">
            <WeeklyCalendar jobs={jobs} onJobClick={id => navigate(`/jobs/${id}`)} />
          </div>
        )}
      </div>

      {showNewJob && (
        <NewJobModal
          onCreated={(jobId) => { setShowNewJob(false); void fetchJobs(); navigate(`/jobs/${jobId}`); }}
          onClose={() => setShowNewJob(false)}
        />
      )}
    </SharedLayout>
  );
}
