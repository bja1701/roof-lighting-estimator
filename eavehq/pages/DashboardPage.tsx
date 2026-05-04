import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Home, MapPin, Plus, Search, User, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SharedLayout from '../components/SharedLayout';
import NewJobModal from '../components/NewJobModal';
import SetupChecklist from '../components/SetupChecklist';
import JobStatusBadge from '../components/JobStatusBadge';
import JobStreetViewImage from '../components/JobStreetViewImage';
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
          className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors min-h-[44px] min-w-[44px]"
          style={{ color: 'var(--color-slate)' }}
          aria-label="Previous week"
        >
          <ChevronLeft size={20} aria-hidden="true" style={{ color: 'var(--color-slate)' }} />
        </button>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>{weekLabel}</span>
        <button
          type="button"
          onClick={nextWeek}
          className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors min-h-[44px] min-w-[44px]"
          style={{ color: 'var(--color-slate)' }}
          aria-label="Next week"
        >
          <ChevronRight size={20} aria-hidden="true" style={{ color: 'var(--color-slate)' }} />
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
              <div
                className="text-center mb-1 rounded-lg py-1"
                style={isToday ? { background: 'var(--color-primary)', color: '#fff' } : undefined}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: isToday ? '#fff' : 'var(--color-slate)' }}
                >
                  {DAY_NAMES[i]}
                </p>
                <p className="text-sm font-bold" style={{ color: isToday ? '#fff' : 'var(--color-ink)' }}>
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
                    className="w-full text-left rounded-md px-1.5 py-1 text-[10px] sm:text-xs font-medium transition-colors min-h-[44px] flex flex-col justify-center"
                    style={{
                      background: 'rgba(58,99,73,0.1)',
                      border: '1px solid rgba(58,99,73,0.18)',
                      color: 'var(--color-ink)',
                    }}
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
        <p className="text-center text-sm mt-8" style={{ color: 'var(--color-slate)' }}>
          No jobs with a scheduled date yet. Open a job and set a scheduled date to see it here.
        </p>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
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
            className="mb-6 flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            style={{ background: 'rgba(196,122,26,0.12)', border: '1px solid rgba(196,122,26,0.22)' }}
          >
            <p className="text-sm" style={{ color: 'var(--color-ink)' }}>
              You&apos;ve used all <strong>5</strong> free estimates. The estimator is locked until you upgrade.
            </p>
            <button
              type="button"
              onClick={() => setEstimateLimitBanner(false)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              style={{ background: 'var(--color-card)', color: 'var(--color-slate)' }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Page header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1
              className="text-4xl font-black tracking-tight"
              style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
            >
              Dashboard
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-slate)' }}>All your jobs in one place.</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              onClick={() => navigate('/clients')}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold leading-none transition-colors sm:flex-none"
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-ink)',
                boxShadow: 'var(--shadow-card)',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-card)')}
            >
              <Users size={17} aria-hidden="true" style={{ color: 'var(--color-primary)' }} />
              Clients
            </button>
            <button
              type="button"
              onClick={() => setShowNewJob(true)}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold leading-none text-white transition-opacity active:scale-[0.98] sm:flex-none"
              style={{
                background: 'var(--color-accent)',
                boxShadow: '0 2px 8px rgba(217,111,10,0.28)',
                fontFamily: 'var(--font-body)',
              }}
            >
              <Plus size={18} aria-hidden="true" />
              New Job
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mb-6 rounded-xl p-1 w-fit" style={{ background: 'var(--color-surface)' }}>
          {(['list', 'schedule'] as DashboardTab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all min-h-[40px] capitalize"
              style={{
                background: tab === t ? 'var(--color-card)' : 'transparent',
                boxShadow: tab === t ? 'var(--shadow-card)' : 'none',
                color: tab === t ? 'var(--color-ink)' : 'var(--color-slate)',
              }}
            >
              {t === 'list' ? 'List' : 'Schedule'}
            </button>
          ))}
        </div>

        {tab === 'list' ? (
          <>
            {/* Filter + Search */}
            <div className="mb-5 flex flex-col sm:flex-row gap-3">
              <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--color-surface)' }}>
                {FILTERS.map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all min-h-[40px]"
                    style={{
                      background: filter === f.key ? 'var(--color-card)' : 'transparent',
                      boxShadow: filter === f.key ? 'var(--shadow-card)' : 'none',
                      color: filter === f.key ? 'var(--color-ink)' : 'var(--color-slate)',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="relative min-w-0 flex-1">
                <Search
                  size={18}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-slate)' }}
                />
                <input
                  type="text"
                  placeholder="Search jobs, clients, addresses…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="min-h-[48px] w-full rounded-xl py-3 pl-12 pr-4 text-sm outline-none transition-all placeholder:text-stone-400"
                  style={{
                    background: 'var(--color-card)',
                    border: '1.5px solid var(--color-border)',
                    color: 'var(--color-ink)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(58,99,73,0.14)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                  }}
                />
              </div>
            </div>

            {/* Job list */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="rounded-xl p-4 animate-pulse"
                    style={{ background: 'var(--color-card)', boxShadow: 'var(--shadow-card)' }}
                  >
                    <div className="h-4 rounded w-1/3 mb-2" style={{ background: 'var(--color-surface)' }} />
                    <div className="h-3 rounded w-1/2" style={{ background: 'var(--color-surface)' }} />
                  </div>
                ))}
              </div>
            ) : visibleJobs.length === 0 ? (
              <div
                className="text-center py-20 rounded-2xl"
                style={{ background: 'var(--color-card)', boxShadow: 'var(--shadow-card)' }}
              >
                <Home className="mx-auto mb-4" size={44} aria-hidden="true" style={{ color: 'rgba(90,96,112,0.32)' }} />
                <h3
                  className="font-bold text-lg mb-1"
                  style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
                >
                  {filter === 'archived' ? 'No archived jobs' : `No ${filter} jobs`}
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-slate)' }}>
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
                    className="mt-6 text-white font-bold py-3 px-8 rounded-lg active:scale-95 transition-all min-h-[44px]"
                    style={{ background: 'var(--color-accent)', fontFamily: 'var(--font-display)' }}
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
                    className="group flex min-h-[64px] w-full flex-col gap-3 rounded-xl px-4 py-4 text-left transition-colors sm:flex-row sm:items-center"
                    style={{
                      background: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      boxShadow: 'var(--shadow-card)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3
                          className="font-bold text-base"
                          style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
                        >
                          {job.name}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--color-slate)' }}>
                        {job.client_name && (
                          <span className="flex items-center gap-1">
                            <User size={13} aria-hidden="true" />
                            {job.client_name}
                          </span>
                        )}
                        {job.address && (
                          <span className="flex items-center gap-1">
                            <MapPin size={13} aria-hidden="true" />
                            {job.address}
                          </span>
                        )}
                        {job.scheduled_date && (
                          <span className="flex items-center gap-1">
                            <CalendarDays size={13} aria-hidden="true" />
                            {new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex w-full shrink-0 items-center justify-end gap-3 self-start sm:w-[300px] sm:self-center">
                      {job.address && (
                        <div
                          className="h-16 w-28 shrink-0 overflow-hidden rounded-lg"
                          style={{ border: '1px solid var(--color-border)' }}
                        >
                          <JobStreetViewImage
                            address={job.address}
                            jobName={job.name}
                            mapsApiKey={mapsApiKey}
                            width={210}
                            height={120}
                            className="h-full w-full"
                            imageClassName="h-full w-full object-cover scale-150"
                            fallbackIconSize={22}
                          />
                        </div>
                      )}
                      <div className="flex w-[120px] shrink-0 flex-col items-center gap-1">
                        <JobStatusBadge status={job.status} size="sm" />
                        <span
                          className="w-full rounded-md px-2 py-1 text-center text-xs font-medium tabular-nums whitespace-nowrap"
                          style={{
                            background: 'var(--color-surface)',
                            color: 'var(--color-slate)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {job.quote_count ?? 0} estimate{(job.quote_count ?? 0) !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
                        style={{
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-primary)',
                          background: 'var(--color-card)',
                        }}
                      >
                        <ChevronRight size={18} aria-hidden="true" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Schedule tab */
          <div
            className="rounded-xl p-4 overflow-x-auto"
            style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
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
