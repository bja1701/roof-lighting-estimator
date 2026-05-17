/**
 * ScheduleCalendarPage — Task J full redesign
 *
 * Week view: columns = days, rows = hourly slots 6am–8pm.
 *   - Jobs with times appear as absolutely-positioned blocks in the time grid.
 *   - Jobs marked "anytime" appear as chips in an all-day row at the top.
 * Month view: grid of days, jobs appear as small chips on their date.
 * Clicking any chip opens a lightweight popover with job details + actions.
 * GCal events from the visible range are pulled on load and shown read-only.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, CalendarDays, Loader2,
  MapPin, Clock, ArrowRight, Calendar, RefreshCw,
} from 'lucide-react';
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth,
  endOfWeek, format, getDay, isSameDay, isSameMonth, isToday,
  parseISO, startOfMonth, startOfWeek, subMonths, subWeeks,
} from 'date-fns';
import { supabase } from '../lib/supabase';
import SharedLayout from '../components/SharedLayout';
import ScheduleModal from '../components/ScheduleModal';
import type { ScheduleValues } from '../components/ScheduleModal';
import type { Job } from '../types/job';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GCalEvent {
  id: string;
  summary: string;
  start: string;   // ISO datetime or date
  end: string;
  isAllDay: boolean;
}

interface PopoverState {
  job: Job;
  anchorRect: DOMRect;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_START  = 6;   // 6am
const HOUR_END    = 21;  // 9pm exclusive → slots 6am–8pm
const SLOT_HEIGHT = 56;  // px per hour
const HOURS       = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

const GCAL_PUSH_FN = 'https://bsbewwwflqjlxxovjgec.supabase.co/functions/v1/gcal-push';
const GCAL_PULL_FN = 'https://bsbewwwflqjlxxovjgec.supabase.co/functions/v1/gcal-pull';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTop(mins: number): number {
  return ((mins - HOUR_START * 60) / 60) * SLOT_HEIGHT;
}

function minutesToHeight(startMins: number, endMins: number): number {
  return ((endMins - startMins) / 60) * SLOT_HEIGHT;
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return 'Anytime';
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const hh   = h % 12 || 12;
    return m === 0 ? `${hh}${ampm}` : `${hh}:${String(m).padStart(2, '0')}${ampm}`;
  };
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

/** Parse a job's scheduled_date + times into JS Date objects suitable for comparisons. */
function jobDateObj(job: Job): Date | null {
  if (!job.scheduled_date) return null;
  return parseISO(job.scheduled_date);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface JobChipProps {
  job: Job;
  style?: React.CSSProperties;
  compact?: boolean;
  onClick: (job: Job, rect: DOMRect) => void;
}

function JobChip({ job, style, compact, onClick }: JobChipProps) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        if (ref.current) onClick(job, ref.current.getBoundingClientRect());
      }}
      className="text-left w-full overflow-hidden"
      style={{
        background: 'var(--color-primary)',
        color: '#fff',
        borderRadius: compact ? '4px' : '6px',
        padding: compact ? '2px 5px' : '4px 7px',
        fontSize: compact ? '11px' : '12px',
        fontWeight: 600,
        lineHeight: 1.3,
        cursor: 'pointer',
        border: 'none',
        ...style,
      }}
    >
      <div className="truncate">{job.name}</div>
      {!compact && (job.scheduled_start_time || job.scheduled_anytime) && (
        <div style={{ opacity: 0.8, fontSize: '10px', marginTop: 1 }}>
          {job.scheduled_anytime ? 'Anytime' : formatTimeRange(job.scheduled_start_time, job.scheduled_end_time)}
        </div>
      )}
    </button>
  );
}

interface GCalChipProps {
  event: GCalEvent;
  compact?: boolean;
}

function GCalChip({ event, compact }: GCalChipProps) {
  const timeLabel = event.isAllDay ? 'All day' : (() => {
    try {
      return format(new Date(event.start), 'h:mmaaa');
    } catch {
      return '';
    }
  })();
  return (
    <div
      className="overflow-hidden"
      style={{
        background: 'rgba(66,133,244,0.13)',
        color: '#2563eb',
        borderLeft: '3px solid #4285f4',
        borderRadius: compact ? '3px' : '5px',
        padding: compact ? '2px 5px' : '4px 7px',
        fontSize: compact ? '11px' : '12px',
        fontWeight: 600,
        lineHeight: 1.3,
      }}
    >
      <div className="truncate">{event.summary}</div>
      {!compact && <div style={{ opacity: 0.7, fontSize: '10px', marginTop: 1 }}>{timeLabel} · GCal</div>}
    </div>
  );
}

// ─── Popover ─────────────────────────────────────────────────────────────────

interface JobPopoverProps {
  job: Job;
  anchorRect: DOMRect;
  onClose: () => void;
  onViewJob: (id: string) => void;
  onReschedule: (job: Job) => void;
}

function JobPopover({ job, anchorRect, onClose, onViewJob, onReschedule }: JobPopoverProps) {
  const popRef = useRef<HTMLDivElement>(null);

  // Position: try below anchor, fall back above if not enough space
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    const pop = popRef.current;
    if (!pop) return;
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    let top = anchorRect.bottom + margin + window.scrollY;
    let left = anchorRect.left + window.scrollX;

    if (top + ph > vh + window.scrollY - margin) {
      top = anchorRect.top + window.scrollY - ph - margin;
    }
    if (left + pw > vw - margin) {
      left = vw - pw - margin;
    }
    if (left < margin) left = margin;

    setPos({ top, left });
  }, [anchorRect]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={popRef}
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        zIndex: 300,
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-dropdown)',
        padding: '1rem',
        width: '240px',
      }}
    >
      <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-ink)', marginBottom: '6px' }}>
        {job.name}
      </p>
      {job.address && (
        <p className="flex items-start gap-1.5 text-xs mb-1" style={{ color: 'var(--color-slate)' }}>
          <MapPin size={11} style={{ marginTop: 2, flexShrink: 0 }} />
          {job.address}
        </p>
      )}
      <p className="flex items-center gap-1.5 text-xs mb-4" style={{ color: 'var(--color-slate)' }}>
        <Clock size={11} />
        {job.scheduled_date
          ? format(parseISO(job.scheduled_date), 'MMM d, yyyy')
          : '—'}
        {!job.scheduled_anytime && job.scheduled_start_time && (
          <> · {formatTimeRange(job.scheduled_start_time, job.scheduled_end_time)}</>
        )}
        {job.scheduled_anytime && <> · Anytime</>}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onViewJob(job.id)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ background: 'var(--color-primary)', color: '#fff' }}
        >
          <ArrowRight size={12} />
          View Job
        </button>
        <button
          type="button"
          onClick={() => { onClose(); onReschedule(job); }}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ background: 'var(--color-surface)', color: 'var(--color-slate)', border: '1px solid var(--color-border)' }}
        >
          <Calendar size={12} />
          Reschedule
        </button>
      </div>
    </div>
  );
}

// ─── Week view ────────────────────────────────────────────────────────────────

interface WeekViewProps {
  weekStart: Date;
  jobs: Job[];
  gcalEvents: GCalEvent[];
  onChipClick: (job: Job, rect: DOMRect) => void;
}

function WeekView({ weekStart, jobs, gcalEvents, onChipClick }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Sort jobs into all-day and timed buckets per day
  const jobsForDay = (day: Date) =>
    jobs.filter(j => j.scheduled_date && isSameDay(parseISO(j.scheduled_date), day));

  const allDayJobs = (day: Date) =>
    jobsForDay(day).filter(j => j.scheduled_anytime || !j.scheduled_start_time);

  const timedJobs = (day: Date) =>
    jobsForDay(day).filter(j => !j.scheduled_anytime && !!j.scheduled_start_time);

  const gcalForDay = (day: Date) =>
    gcalEvents.filter(ev => {
      try {
        const d = ev.isAllDay ? parseISO(ev.start) : new Date(ev.start);
        return isSameDay(d, day);
      } catch { return false; }
    });

  const allDayGcal = (day: Date) => gcalForDay(day).filter(ev => ev.isAllDay);
  const timedGcal  = (day: Date) => gcalForDay(day).filter(ev => !ev.isAllDay);

  const totalHeight = (HOUR_END - HOUR_START) * SLOT_HEIGHT;

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 640 }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)' }}>
          <div />
          {days.map(day => (
            <div
              key={day.toISOString()}
              style={{
                padding: '8px 4px',
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: isToday(day) ? 'var(--color-primary)' : 'var(--color-slate)',
                borderLeft: '1px solid var(--color-border)',
              }}
            >
              <div>{format(day, 'EEE')}</div>
              <div
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24, borderRadius: '50%', fontSize: '13px', fontWeight: 800,
                  marginTop: 2,
                  background: isToday(day) ? 'var(--color-primary)' : 'transparent',
                  color: isToday(day) ? '#fff' : 'var(--color-ink)',
                }}
              >
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* All-day row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '48px repeat(7, 1fr)',
            borderBottom: '1px solid var(--color-border)',
            minHeight: 28,
          }}
        >
          <div style={{ fontSize: '9px', color: 'var(--color-slate)', padding: '4px 4px 0', textAlign: 'right', fontWeight: 700, textTransform: 'uppercase' }}>
            All day
          </div>
          {days.map(day => {
            const aJobs  = allDayJobs(day);
            const aGcal  = allDayGcal(day);
            return (
              <div
                key={day.toISOString()}
                style={{ borderLeft: '1px solid var(--color-border)', padding: '3px 3px', display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                {aJobs.map(j => (
                  <JobChip key={j.id} job={j} compact onClick={onChipClick} />
                ))}
                {aGcal.map(ev => (
                  <GCalChip key={ev.id} event={ev} compact />
                ))}
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', position: 'relative' }}>
          {/* Hour labels */}
          <div style={{ position: 'relative', height: totalHeight }}>
            {HOURS.map(h => (
              <div
                key={h}
                style={{
                  position: 'absolute',
                  top: (h - HOUR_START) * SLOT_HEIGHT - 7,
                  right: 6,
                  fontSize: '10px',
                  color: 'var(--color-slate)',
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                {h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(day => {
            const tJobs = timedJobs(day);
            const tGcal = timedGcal(day);
            return (
              <div
                key={day.toISOString()}
                style={{
                  borderLeft: '1px solid var(--color-border)',
                  position: 'relative',
                  height: totalHeight,
                  background: isToday(day) ? 'rgba(58,99,73,0.03)' : undefined,
                }}
              >
                {/* Hour grid lines */}
                {HOURS.map(h => (
                  <div
                    key={h}
                    style={{
                      position: 'absolute',
                      top: (h - HOUR_START) * SLOT_HEIGHT,
                      left: 0, right: 0,
                      borderTop: '1px solid var(--color-border)',
                    }}
                  />
                ))}

                {/* Timed job blocks */}
                {tJobs.map(job => {
                  const startMins = timeToMinutes(job.scheduled_start_time!);
                  const endMins   = job.scheduled_end_time
                    ? timeToMinutes(job.scheduled_end_time)
                    : startMins + 60;
                  const clampedStart = Math.max(startMins, HOUR_START * 60);
                  const clampedEnd   = Math.min(endMins, HOUR_END * 60);
                  if (clampedEnd <= clampedStart) return null;
                  return (
                    <div
                      key={job.id}
                      style={{
                        position: 'absolute',
                        top: minutesToTop(clampedStart),
                        left: 3, right: 3,
                        height: Math.max(minutesToHeight(clampedStart, clampedEnd), 20),
                      }}
                    >
                      <JobChip job={job} style={{ height: '100%' }} onClick={onChipClick} />
                    </div>
                  );
                })}

                {/* Timed GCal blocks */}
                {tGcal.map(ev => {
                  try {
                    const s = new Date(ev.start);
                    const e = new Date(ev.end);
                    const startMins = s.getHours() * 60 + s.getMinutes();
                    const endMins   = e.getHours() * 60 + e.getMinutes() || startMins + 60;
                    const clampedStart = Math.max(startMins, HOUR_START * 60);
                    const clampedEnd   = Math.min(endMins, HOUR_END * 60);
                    if (clampedEnd <= clampedStart) return null;
                    return (
                      <div
                        key={ev.id}
                        style={{
                          position: 'absolute',
                          top: minutesToTop(clampedStart),
                          left: 3, right: 3,
                          height: Math.max(minutesToHeight(clampedStart, clampedEnd), 20),
                        }}
                      >
                        <GCalChip event={ev} />
                      </div>
                    );
                  } catch { return null; }
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Month view ───────────────────────────────────────────────────────────────

interface MonthViewProps {
  month: Date;
  jobs: Job[];
  gcalEvents: GCalEvent[];
  onChipClick: (job: Job, rect: DOMRect) => void;
}

function MonthView({ month, jobs, gcalEvents, onChipClick }: MonthViewProps) {
  const monthStart = startOfMonth(month);
  const monthEnd   = endOfMonth(month);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd    = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const jobsForDay = (day: Date) =>
    jobs.filter(j => j.scheduled_date && isSameDay(parseISO(j.scheduled_date), day));

  const gcalForDay = (day: Date) =>
    gcalEvents.filter(ev => {
      try {
        const d = ev.isAllDay ? parseISO(ev.start) : new Date(ev.start);
        return isSameDay(d, day);
      } catch { return false; }
    });

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)' }}>
        {DOW.map(d => (
          <div
            key={d}
            style={{
              padding: '6px 4px',
              textAlign: 'center',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-slate)',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map(day => {
          const dayJobs  = jobsForDay(day);
          const dayGcal  = gcalForDay(day);
          const inMonth  = isSameMonth(day, month);
          return (
            <div
              key={day.toISOString()}
              style={{
                minHeight: 88,
                padding: '4px',
                borderRight: '1px solid var(--color-border)',
                borderBottom: '1px solid var(--color-border)',
                background: isToday(day)
                  ? 'rgba(58,99,73,0.05)'
                  : !inMonth ? 'var(--color-surface)' : undefined,
              }}
            >
              {/* Day number */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22, height: 22,
                  borderRadius: '50%',
                  fontSize: '12px',
                  fontWeight: isToday(day) ? 800 : 500,
                  marginBottom: 3,
                  background: isToday(day) ? 'var(--color-primary)' : 'transparent',
                  color: isToday(day) ? '#fff' : inMonth ? 'var(--color-ink)' : 'var(--color-border)',
                }}
              >
                {format(day, 'd')}
              </div>
              {/* Chips — show max 2, then "+N more" */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {dayJobs.slice(0, 2).map(j => (
                  <JobChip key={j.id} job={j} compact onClick={onChipClick} />
                ))}
                {dayGcal.slice(0, Math.max(0, 2 - dayJobs.length)).map(ev => (
                  <GCalChip key={ev.id} event={ev} compact />
                ))}
                {(dayJobs.length + dayGcal.length > 2) && (
                  <div style={{ fontSize: '10px', color: 'var(--color-slate)', fontWeight: 600, paddingLeft: 2 }}>
                    +{dayJobs.length + dayGcal.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type CalView = 'week' | 'month';

export default function ScheduleCalendarPage() {
  const navigate = useNavigate();

  const [view, setView]         = useState<CalView>('week');
  const [anchor, setAnchor]     = useState<Date>(new Date());
  const [jobs, setJobs]         = useState<Job[]>([]);
  const [gcalEvents, setGcal]   = useState<GCalEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [gcalLoading, setGcalL] = useState(false);
  const [popover, setPopover]   = useState<PopoverState | null>(null);

  // Reschedule modal state
  const [rescheduleJob, setRescheduleJob]   = useState<Job | null>(null);
  const [rescheduleSaving, setReschSaving]  = useState(false);

  // Derived visible range
  const visibleRange = (() => {
    if (view === 'week') {
      const ws = startOfWeek(anchor, { weekStartsOn: 0 });
      return { start: ws, end: endOfWeek(anchor, { weekStartsOn: 0 }) };
    }
    const ms = startOfMonth(anchor);
    return {
      start: startOfWeek(ms, { weekStartsOn: 0 }),
      end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 }),
    };
  })();

  // Fetch scheduled jobs (any status with a scheduled_date)
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }

    const { data } = await supabase
      .from('jobs')
      .select('id, name, address, status, scheduled_date, scheduled_start_time, scheduled_end_time, scheduled_anytime, gcal_event_id, client_id')
      .eq('user_id', session.user.id)
      .not('scheduled_date', 'is', null);

    setJobs((data ?? []) as Job[]);
    setLoading(false);
  }, []);

  // Fetch GCal events for visible range
  const fetchGcal = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setGcalL(true);
    try {
      const res = await fetch(
        `${GCAL_PULL_FN}?start=${visibleRange.start.toISOString()}&end=${addDays(visibleRange.end, 1).toISOString()}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (res.ok) {
        const body = await res.json() as { events: GCalEvent[] };
        setGcal(body.events ?? []);
      }
    } catch { /* GCal not connected — silently skip */ }
    setGcalL(false);
  }, [visibleRange.start.toISOString(), visibleRange.end.toISOString()]);

  useEffect(() => { void fetchJobs(); }, [fetchJobs]);
  useEffect(() => { void fetchGcal(); }, [fetchGcal]);

  // Navigation
  const goBack = () => {
    setAnchor(prev => view === 'week' ? subWeeks(prev, 1) : subMonths(prev, 1));
    setPopover(null);
  };
  const goForward = () => {
    setAnchor(prev => view === 'week' ? addWeeks(prev, 1) : addMonths(prev, 1));
    setPopover(null);
  };
  const goToday = () => { setAnchor(new Date()); setPopover(null); };

  // Chip click
  const handleChipClick = (job: Job, rect: DOMRect) => {
    setPopover(prev => prev?.job.id === job.id ? null : { job, anchorRect: rect });
  };

  // Reschedule save
  const handleRescheduleSave = async (values: ScheduleValues) => {
    if (!rescheduleJob) return;
    setReschSaving(true);
    const { error } = await supabase
      .from('jobs')
      .update({
        scheduled_date: values.date,
        scheduled_start_time: values.startTime || null,
        scheduled_end_time: values.endTime || null,
        scheduled_anytime: values.anytime,
      })
      .eq('id', rescheduleJob.id);
    setReschSaving(false);
    if (error) return;

    // Update local state
    setJobs(prev => prev.map(j =>
      j.id === rescheduleJob.id
        ? { ...j, scheduled_date: values.date, scheduled_start_time: values.startTime || null, scheduled_end_time: values.endTime || null, scheduled_anytime: values.anytime }
        : j,
    ));

    // Push to GCal in the background
    void pushToGcal(rescheduleJob.id);

    setRescheduleJob(null);
  };

  const pushToGcal = async (jobId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    try {
      await fetch(GCAL_PUSH_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ job_id: jobId }),
      });
    } catch { /* silent */ }
  };

  // Title label
  const titleLabel = view === 'week'
    ? (() => {
        const ws = startOfWeek(anchor, { weekStartsOn: 0 });
        const we = endOfWeek(anchor, { weekStartsOn: 0 });
        return isSameMonth(ws, we)
          ? `${format(ws, 'MMM d')} – ${format(we, 'd, yyyy')}`
          : `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`;
      })()
    : format(anchor, 'MMMM yyyy');

  return (
    <SharedLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 pb-20 pt-8">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h1
            className="text-3xl font-black tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}
          >
            Schedule
          </h1>

          <div className="flex items-center gap-2">
            {gcalLoading && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-slate)' }} />}

            {/* Navigation */}
            <button
              type="button"
              onClick={goBack}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-slate)', border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
            >
              <ChevronLeft size={16} />
            </button>
            <span
              className="text-sm font-semibold min-w-[160px] text-center"
              style={{ color: 'var(--color-ink)' }}
            >
              {titleLabel}
            </span>
            <button
              type="button"
              onClick={goForward}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-slate)', border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
            >
              <ChevronRight size={16} />
            </button>

            {/* Today */}
            <button
              type="button"
              onClick={goToday}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
              style={{ color: 'var(--color-slate)', border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
            >
              Today
            </button>

            {/* Refresh GCal */}
            <button
              type="button"
              onClick={() => void fetchGcal()}
              title="Refresh Google Calendar"
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-slate)', border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
            >
              <RefreshCw size={14} />
            </button>

            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
              {(['week', 'month'] as CalView[]).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setView(v); setPopover(null); }}
                  className="px-4 py-1.5 text-sm font-semibold capitalize transition-colors"
                  style={
                    view === v
                      ? { background: 'var(--color-primary)', color: '#fff' }
                      : { background: 'var(--color-card)', color: 'var(--color-slate)' }
                  }
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar card */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-32" style={{ color: 'var(--color-slate)' }}>
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading schedule…</span>
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)', background: 'var(--color-card)' }}
          >
            {view === 'week' ? (
              <WeekView
                weekStart={startOfWeek(anchor, { weekStartsOn: 0 })}
                jobs={jobs}
                gcalEvents={gcalEvents}
                onChipClick={handleChipClick}
              />
            ) : (
              <MonthView
                month={anchor}
                jobs={jobs}
                gcalEvents={gcalEvents}
                onChipClick={handleChipClick}
              />
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && jobs.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16" style={{ color: 'var(--color-slate)' }}>
            <CalendarDays size={36} style={{ opacity: 0.3 }} />
            <p className="text-sm font-medium">No scheduled jobs yet.</p>
            <p className="text-xs">Mark a job as Scheduled from its detail page to see it here.</p>
          </div>
        )}

        {/* Job popover */}
        {popover && (
          <JobPopover
            job={popover.job}
            anchorRect={popover.anchorRect}
            onClose={() => setPopover(null)}
            onViewJob={id => { setPopover(null); navigate(`/jobs/${id}`); }}
            onReschedule={job => { setPopover(null); setRescheduleJob(job); }}
          />
        )}

        {/* Reschedule modal */}
        <ScheduleModal
          open={!!rescheduleJob}
          initialValues={rescheduleJob ? {
            date: rescheduleJob.scheduled_date ?? undefined,
            startTime: rescheduleJob.scheduled_start_time ?? undefined,
            endTime: rescheduleJob.scheduled_end_time ?? undefined,
            anytime: rescheduleJob.scheduled_anytime,
          } : undefined}
          saving={rescheduleSaving}
          onConfirm={handleRescheduleSave}
          onCancel={() => setRescheduleJob(null)}
        />
      </div>
    </SharedLayout>
  );
}
