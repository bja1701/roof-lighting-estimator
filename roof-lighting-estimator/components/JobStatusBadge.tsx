import React from 'react';
import { JobStatus } from '../types/job';
import { JOB_STATUS_CONFIG } from '../utils/jobStatus';

interface Props {
  status: JobStatus;
  size?: 'sm' | 'md';
}

export default function JobStatusBadge({ status, size = 'md' }: Props) {
  const config = JOB_STATUS_CONFIG[status] ?? JOB_STATUS_CONFIG['estimate_sent'];
  const sizeCls = size === 'sm'
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-3 py-1 text-xs';
  return (
    <span className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider ${sizeCls} ${config.badgeCls}`}>
      {config.label}
    </span>
  );
}
