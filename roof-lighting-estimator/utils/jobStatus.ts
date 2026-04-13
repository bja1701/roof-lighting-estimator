import { JobStatus } from '../types/job';

interface StatusConfig {
  label: string;
  badgeCls: string;
  nextManualStatus: JobStatus | null;
  nextManualLabel: string | null;
}

export const JOB_STATUS_CONFIG: Record<JobStatus, StatusConfig> = {
  estimate_sent: {
    label: 'Estimate Sent',
    badgeCls: 'bg-surface-container text-on-surface-variant',
    nextManualStatus: null,
    nextManualLabel: null,
  },
  deposit_paid: {
    label: 'Deposit Paid',
    badgeCls: 'bg-secondary-container text-on-secondary-container',
    nextManualStatus: 'scheduled',
    nextManualLabel: 'Mark as Scheduled',
  },
  scheduled: {
    label: 'Scheduled',
    badgeCls: 'bg-tertiary-container/50 text-tertiary',
    nextManualStatus: 'in_progress',
    nextManualLabel: 'Mark In Progress',
  },
  in_progress: {
    label: 'In Progress',
    badgeCls: 'bg-primary-container/30 text-primary',
    nextManualStatus: 'complete',
    nextManualLabel: 'Mark Complete',
  },
  complete: {
    label: 'Complete',
    badgeCls: 'bg-primary-container/60 text-primary',
    nextManualStatus: null,
    nextManualLabel: null,
  },
  final_paid: {
    label: 'Final Paid',
    badgeCls: 'bg-green-100 text-green-800',
    nextManualStatus: 'reviewed',
    nextManualLabel: 'Mark Reviewed',
  },
  reviewed: {
    label: 'Reviewed',
    badgeCls: 'bg-surface-container-lowest border border-outline-variant/30 text-on-surface-variant',
    nextManualStatus: null,
    nextManualLabel: null,
  },
};
