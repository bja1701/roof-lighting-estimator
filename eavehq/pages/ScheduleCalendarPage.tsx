import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { supabase } from '../lib/supabase';
import SharedLayout from '../components/SharedLayout';
import type { View } from 'react-big-calendar';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
});

interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  resource: string; // job id
}

export default function ScheduleCalendarPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('month');

  useEffect(() => {
    const fetchScheduled = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }

      const { data } = await supabase
        .from('jobs')
        .select('id, name, scheduled_date')
        .eq('status', 'scheduled')
        .eq('user_id', session.user.id)
        .not('scheduled_date', 'is', null);

      if (data) {
        setEvents(
          data.map(job => ({
            title: job.name as string,
            start: new Date(job.scheduled_date as string),
            end: new Date(job.scheduled_date as string),
            resource: job.id as string,
          }))
        );
      }
      setLoading(false);
    };

    void fetchScheduled();
  }, []);

  const handleSelectEvent = (event: CalendarEvent) => {
    navigate(`/jobs/${event.resource}`);
  };

  return (
    <SharedLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 pb-20 pt-8">
        <div className="flex items-center justify-between mb-6">
          <h1
            className="text-3xl font-black tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}
          >
            Schedule
          </h1>
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--color-border)' }}
          >
            {(['month', 'week'] as View[]).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
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

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-32" style={{ color: 'var(--color-slate)' }}>
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading schedule…</span>
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-card)',
              background: 'var(--color-card)',
            }}
          >
            <style>{`
              .rbc-calendar { background: var(--color-card); color: var(--color-ink); font-family: var(--font-body); }
              .rbc-header { background: var(--color-surface); color: var(--color-slate); border-color: var(--color-border); padding: 8px 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
              .rbc-month-view, .rbc-time-view { border-color: var(--color-border); }
              .rbc-day-bg + .rbc-day-bg { border-color: var(--color-border); }
              .rbc-month-row + .rbc-month-row { border-color: var(--color-border); }
              .rbc-off-range-bg { background: var(--color-surface); }
              .rbc-today { background: rgba(58,99,73,0.06); }
              .rbc-event { background: var(--color-primary); border: none; border-radius: 6px; font-size: 12px; font-weight: 600; padding: 2px 6px; cursor: pointer; }
              .rbc-event:focus { outline: 2px solid var(--color-accent); outline-offset: 1px; }
              .rbc-event.rbc-selected { background: var(--color-accent); color: var(--color-ink); }
              .rbc-toolbar { padding: 12px 16px; border-bottom: 1px solid var(--color-border); background: var(--color-card); }
              .rbc-toolbar button { color: var(--color-slate); border-color: var(--color-border); background: var(--color-surface); border-radius: 6px; font-family: var(--font-body); font-size: 13px; }
              .rbc-toolbar button:hover { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
              .rbc-toolbar button.rbc-active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
              .rbc-toolbar .rbc-toolbar-label { font-family: var(--font-display); font-weight: 700; font-size: 16px; color: var(--color-ink); }
              .rbc-date-cell { color: var(--color-slate); font-size: 12px; padding: 4px 6px; }
              .rbc-date-cell.rbc-now { color: var(--color-primary); font-weight: 700; }
              .rbc-time-slot { border-color: var(--color-border); }
              .rbc-timeslot-group { border-color: var(--color-border); }
              .rbc-time-gutter .rbc-label { color: var(--color-slate); font-size: 11px; }
              .rbc-current-time-indicator { background: var(--color-accent); }
            `}</style>
            <Calendar
              localizer={localizer}
              events={events}
              view={view}
              onView={setView}
              views={['month', 'week']}
              onSelectEvent={handleSelectEvent}
              style={{ height: 680 }}
              popup
            />
          </div>
        )}
      </div>
    </SharedLayout>
  );
}
