export type JobStatus =
  | 'estimate_sent'
  | 'deposit_paid'
  | 'scheduled'
  | 'in_progress'
  | 'complete'
  | 'final_paid';

export interface Job {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  notes: string | null;
  created_at: string;
  // Phase 1 — payment + pipeline
  status: JobStatus;
  deposit_percent: number;
  deposit_amount: number | null;
  final_amount: number | null;
  stripe_deposit_link: string | null;
  stripe_final_link: string | null;
  stripe_customer_id: string | null;
  deposit_paid_at: string | null;
  final_paid_at: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  // Phase 1 — client portal
  portal_token: string | null;
  // Task 5 — email tracking
  estimate_sent_at: string | null;
  client_opened_at: string | null;
  followup_count: number;
  // Joined from quotes(count) in list queries
  quote_count?: number;
}
