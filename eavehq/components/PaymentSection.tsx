import {
	ArrowRight,
	Check,
	CheckCircle2,
	Copy,
	CreditCard,
	Link,
	Loader2,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Job, JobStatus } from '../types/job';
import { JOB_STATUS_CONFIG } from '../utils/jobStatus';

interface Props {
	job: Job;
	onStatusChange: (newStatus: JobStatus) => void;
	onJobUpdate: (updates: Partial<Job>) => void;
}

const inputStyle: React.CSSProperties = {
	padding: '8px 12px',
	background: 'var(--color-surface)',
	border: '1px solid var(--color-border)',
	borderRadius: 'var(--radius-md)',
	color: 'var(--color-ink)',
	fontSize: '0.875rem',
	outline: 'none',
	width: '5rem',
};

const labelStyle: React.CSSProperties = {
	display: 'block',
	fontSize: '11px',
	fontWeight: 700,
	textTransform: 'uppercase' as const,
	letterSpacing: '0.1em',
	color: 'var(--color-slate)',
	marginBottom: '4px',
};

export default function PaymentSection({
	job,
	onStatusChange,
	onJobUpdate,
}: Props) {
	const [depositPercent, setDepositPercent] = useState(
		job.deposit_percent ?? 50
	);
	const [generating, setGenerating] = useState(false);
	const [advancing, setAdvancing] = useState(false);
	const [copied, setCopied] = useState<'deposit' | 'final' | null>(null);
	const [error, setError] = useState<string | null>(null);

	const statusConfig =
		JOB_STATUS_CONFIG[job.status] ?? JOB_STATUS_CONFIG.estimate_sent;

	const handleGenerateLink = async (type: 'deposit' | 'final') => {
		setGenerating(true);
		setError(null);
		try {
			const { data, error: fnError } = await supabase.functions.invoke(
				'create-payment-link',
				{
					body: { jobId: job.id, depositPercent, type },
				}
			);
			if (fnError) throw new Error(fnError.message);
			if (data?.error) throw new Error(data.error);
			const url: string = data.url;
			if (type === 'deposit') {
				onJobUpdate({
					stripe_deposit_link: url,
					deposit_percent: depositPercent,
				});
			} else {
				onJobUpdate({ stripe_final_link: url });
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setGenerating(false);
		}
	};

	const handleCopy = async (url: string, type: 'deposit' | 'final') => {
		await navigator.clipboard.writeText(url);
		setCopied(type);
		setTimeout(() => setCopied(null), 2000);
	};

	const handleAdvanceStatus = async () => {
		const next = statusConfig.nextManualStatus;
		if (!next) return;
		setAdvancing(true);
		setError(null);
		const { error: dbError } = await supabase
			.from('jobs')
			.update({ status: next })
			.eq('id', job.id);
		setAdvancing(false);
		if (dbError) {
			setError(dbError.message);
			return;
		}
		onStatusChange(next);
	};

	return (
		<div
			className="rounded-xl p-6 space-y-5"
			style={{
				background: 'var(--color-card)',
				border: '1px solid var(--color-border)',
				boxShadow: 'var(--shadow-card)',
			}}
		>
			<h2
				className="font-bold text-lg flex items-center gap-2"
				style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}
			>
				<CreditCard size={18} style={{ color: 'var(--color-primary)' }} />
				Payment
			</h2>

			{error && (
				<div
					className="px-4 py-3 rounded-lg"
					style={{
						background: 'rgba(201,64,64,0.08)',
						border: '1px solid rgba(201,64,64,0.2)',
					}}
				>
					<p
						className="text-sm font-medium"
						style={{ color: 'var(--color-destructive)' }}
					>
						{error}
					</p>
				</div>
			)}

			{/* Deposit Link */}
			<div className="space-y-3">
				<p style={labelStyle}>Deposit Link</p>

				{!job.stripe_deposit_link ? (
					<div className="flex flex-wrap items-end gap-3">
						<div>
							<label style={labelStyle}>Deposit %</label>
							<div className="flex items-center gap-2">
								<input
									type="number"
									min={1}
									max={100}
									value={depositPercent}
									onChange={(e) => setDepositPercent(Number(e.target.value))}
									style={inputStyle}
								/>
								<span
									className="text-sm"
									style={{ color: 'var(--color-slate)' }}
								>
									%
								</span>
							</div>
						</div>
						<button
							type="button"
							onClick={() => handleGenerateLink('deposit')}
							disabled={generating}
							className="flex items-center gap-2 font-bold py-3 px-5 rounded-lg transition-all active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
							style={{
								background: 'var(--color-accent)',
								color: '#fff',
								fontFamily: 'var(--font-display)',
								boxShadow: '0 2px 8px rgba(217,111,10,0.3)',
							}}
						>
							{generating ? (
								<Loader2 size={16} className="animate-spin" />
							) : (
								<Link size={16} />
							)}
							{generating ? 'Generating…' : 'Generate Deposit Link'}
						</button>
					</div>
				) : (
					<div
						className="flex flex-wrap items-center gap-3 p-3 rounded-lg"
						style={{
							background: 'var(--color-surface)',
							border: '1px solid var(--color-border)',
						}}
					>
						<CheckCircle2
							size={16}
							style={{ color: 'var(--color-success)', flexShrink: 0 }}
						/>
						<a
							href={job.stripe_deposit_link}
							target="_blank"
							rel="noopener noreferrer"
							className="flex-1 text-sm truncate underline underline-offset-2 transition-opacity hover:opacity-75"
							style={{ color: 'var(--color-primary)' }}
						>
							{job.stripe_deposit_link}
						</a>
						<button
							type="button"
							onClick={() => handleCopy(job.stripe_deposit_link!, 'deposit')}
							className="flex items-center gap-1.5 text-sm font-bold py-2 px-3 rounded-lg transition-colors"
							style={{
								background: 'var(--color-card)',
								color: 'var(--color-slate)',
								border: '1px solid var(--color-border)',
							}}
							onMouseEnter={(e) =>
								(e.currentTarget.style.color = 'var(--color-ink)')
							}
							onMouseLeave={(e) =>
								(e.currentTarget.style.color = 'var(--color-slate)')
							}
						>
							{copied === 'deposit' ? (
								<Check size={14} style={{ color: 'var(--color-success)' }} />
							) : (
								<Copy size={14} />
							)}
							{copied === 'deposit' ? 'Copied!' : 'Copy'}
						</button>
					</div>
				)}

				{job.deposit_amount != null && (
					<p className="text-xs" style={{ color: 'var(--color-slate)' }}>
						Deposit:{' '}
						<span
							className="font-semibold"
							style={{
								color: 'var(--color-ink)',
								fontFamily: 'var(--font-mono)',
							}}
						>
							${job.deposit_amount.toFixed(2)}
						</span>
						{job.final_amount != null && (
							<>
								{' · '}Remaining:{' '}
								<span
									className="font-semibold"
									style={{
										color: 'var(--color-ink)',
										fontFamily: 'var(--font-mono)',
									}}
								>
									${job.final_amount.toFixed(2)}
								</span>
							</>
						)}
					</p>
				)}
			</div>

			{/* Final Payment Link */}
			{(job.status === 'complete' || job.stripe_final_link) && (
				<div
					className="space-y-3 pt-4"
					style={{ borderTop: '1px solid var(--color-border)' }}
				>
					<p style={labelStyle}>Final Payment Link</p>
					{!job.stripe_final_link ? (
						<button
							type="button"
							onClick={() => handleGenerateLink('final')}
							disabled={generating}
							className="flex items-center gap-2 font-bold py-3 px-5 rounded-lg transition-all active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
							style={{
								background: 'var(--color-accent)',
								color: '#fff',
								fontFamily: 'var(--font-display)',
								boxShadow: '0 2px 8px rgba(217,111,10,0.3)',
							}}
						>
							{generating ? (
								<Loader2 size={16} className="animate-spin" />
							) : (
								<Link size={16} />
							)}
							{generating ? 'Generating…' : 'Generate Final Payment Link'}
						</button>
					) : (
						<div
							className="flex flex-wrap items-center gap-3 p-3 rounded-lg"
							style={{
								background: 'var(--color-surface)',
								border: '1px solid var(--color-border)',
							}}
						>
							<CheckCircle2
								size={16}
								style={{ color: 'var(--color-success)', flexShrink: 0 }}
							/>
							<a
								href={job.stripe_final_link}
								target="_blank"
								rel="noopener noreferrer"
								className="flex-1 text-sm truncate underline underline-offset-2 transition-opacity hover:opacity-75"
								style={{ color: 'var(--color-primary)' }}
							>
								{job.stripe_final_link}
							</a>
							<button
								type="button"
								onClick={() => handleCopy(job.stripe_final_link!, 'final')}
								className="flex items-center gap-1.5 text-sm font-bold py-2 px-3 rounded-lg transition-colors"
								style={{
									background: 'var(--color-card)',
									color: 'var(--color-slate)',
									border: '1px solid var(--color-border)',
								}}
								onMouseEnter={(e) =>
									(e.currentTarget.style.color = 'var(--color-ink)')
								}
								onMouseLeave={(e) =>
									(e.currentTarget.style.color = 'var(--color-slate)')
								}
							>
								{copied === 'final' ? (
									<Check size={14} style={{ color: 'var(--color-success)' }} />
								) : (
									<Copy size={14} />
								)}
								{copied === 'final' ? 'Copied!' : 'Copy'}
							</button>
						</div>
					)}
				</div>
			)}

			{/* Stage Advance */}
			{statusConfig.nextManualStatus && (
				<div
					className="pt-4"
					style={{ borderTop: '1px solid var(--color-border)' }}
				>
					<button
						type="button"
						onClick={handleAdvanceStatus}
						disabled={advancing}
						className="flex items-center gap-2 font-bold py-3 px-5 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
						style={{
							background: 'var(--color-surface)',
							color: 'var(--color-ink)',
							border: '1px solid var(--color-border)',
						}}
						onMouseEnter={(e) =>
							(e.currentTarget.style.background = 'var(--color-border)')
						}
						onMouseLeave={(e) =>
							(e.currentTarget.style.background = 'var(--color-surface)')
						}
					>
						{advancing ? (
							<Loader2 size={16} className="animate-spin" />
						) : (
							<ArrowRight size={16} />
						)}
						{advancing ? 'Updating…' : statusConfig.nextManualLabel}
					</button>
				</div>
			)}
		</div>
	);
}
