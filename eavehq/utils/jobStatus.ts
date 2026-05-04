import { JobStatus } from '../types/job';

interface StatusConfig {
  label: string;
  badgeStyle: {
    background: string;
    color: string;
  };
  nextManualStatus: JobStatus | null;
  nextManualLabel: string | null;
}

export const JOB_STATUS_CONFIG: Record<JobStatus, StatusConfig> = {
  estimate_sent: {
    label: 'Estimate Sent',
    badgeStyle: {
      background: 'rgba(90,96,112,0.12)',
      color: 'var(--color-slate)',
    },
    nextManualStatus: 'scheduled',
    nextManualLabel: 'Mark as Scheduled',
  },
  deposit_paid: {
    label: 'Deposit Paid',
    badgeStyle: {
      background: 'rgba(61,158,106,0.12)',
      color: 'var(--color-success)',
    },
    nextManualStatus: 'scheduled',
    nextManualLabel: 'Mark as Scheduled',
  },
  scheduled: {
    label: 'Scheduled',
    badgeStyle: {
      background: 'rgba(58,99,73,0.12)',
      color: 'var(--color-primary)',
    },
    nextManualStatus: 'in_progress',
    nextManualLabel: 'Mark as Started',
  },
  in_progress: {
    label: 'In Progress',
    badgeStyle: {
      background: 'rgba(217,111,10,0.12)',
      color: 'var(--color-accent)',
    },
    nextManualStatus: 'complete',
    nextManualLabel: 'Mark Complete',
  },
  complete: {
    label: 'Complete',
    badgeStyle: {
      background: 'rgba(61,158,106,0.12)',
      color: 'var(--color-success)',
    },
    nextManualStatus: null,
    nextManualLabel: null,
  },
  final_paid: {
    label: 'Final Paid',
    badgeStyle: {
      background: 'rgba(61,158,106,0.16)',
      color: 'var(--color-success)',
    },
    nextManualStatus: null,
    nextManualLabel: null,
  },
};
