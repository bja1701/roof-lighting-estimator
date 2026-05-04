import {
	AlertTriangle,
	ArrowRight,
	Building2,
	Home,
	Loader2,
	MapPin,
	Plus,
	Search,
	Trash2,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import JobStatusBadge from '../components/JobStatusBadge';
import NewJobModal from '../components/NewJobModal';
import SetupChecklist from '../components/SetupChecklist';
import SharedLayout from '../components/SharedLayout';
import { useProfile } from '../hooks/useProfile';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import type { Job } from '../types/job';
import { streetViewStaticImageUrl } from '../utils/streetViewStatic';

function JobCardCover({
	address,
	jobName,
	mapsApiKey,
}: {
	address: string | null;
	jobName: string;
	mapsApiKey: string;
}) {
	const [imgFailed, setImgFailed] = useState(false);
	const url =
		mapsApiKey && address?.trim()
			? streetViewStaticImageUrl({
					location: address.trim(),
					apiKey: mapsApiKey,
					width: 640,
					height: 360,
				})
			: '';

	if (!url || imgFailed) {
		return (
			<div
				className="flex h-full w-full items-center justify-center"
				style={{ background: 'var(--color-surface)' }}
			>
				<Home size={36} style={{ color: 'var(--color-border)' }} aria-hidden />
			</div>
		);
	}

	return (
		<img
			src={url}
			alt={`Street View near ${jobName}`}
			className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
			onError={() => setImgFailed(true)}
			loading="lazy"
			decoding="async"
		/>
	);
}

export default function JobsPage() {
	const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
	const navigate = useNavigate();
	const location = useLocation();
	const { profile } = useProfile();
	const { toast } = useToast();
	const [jobs, setJobs] = useState<Job[]>([]);
	const [loading, setLoading] = useState(true);
	const [showNewJob, setShowNewJob] = useState(false);
	const [search, setSearch] = useState('');
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [jobPendingDelete, setJobPendingDelete] = useState<Job | null>(null);
	const [estimateLimitBanner, setEstimateLimitBanner] = useState(false);

	useEffect(() => {
		fetchJobs();
	}, []);

	useEffect(() => {
		const state = location.state as { reason?: string } | null | undefined;
		if (state?.reason !== 'estimate_limit') return;
		setEstimateLimitBanner(true);
		navigate(`${location.pathname}${location.search}`, {
			replace: true,
			state: null,
		});
	}, [location.pathname, location.search, location.state, navigate]);

	useEffect(() => {
		if (!jobPendingDelete || deletingId) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setJobPendingDelete(null);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [jobPendingDelete, deletingId]);

	const fetchJobs = async () => {
		setLoading(true);
		const { data } = await supabase
			.from('jobs')
			.select('*, quotes(count)')
			.order('created_at', { ascending: false });
		if (data)
			setJobs(
				data.map((j: any) => ({ ...j, quote_count: j.quotes?.[0]?.count ?? 0 }))
			);
		setLoading(false);
	};

	const filtered = jobs.filter(
		(j) =>
			j.name.toLowerCase().includes(search.toLowerCase()) ||
			(j.address ?? '').toLowerCase().includes(search.toLowerCase())
	);

	const openDeleteConfirm = (job: Job, e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setJobPendingDelete(job);
	};
	const cancelDeleteConfirm = () => {
		if (deletingId) return;
		setJobPendingDelete(null);
	};

	const confirmDeleteJob = async () => {
		const job = jobPendingDelete;
		if (!job) return;
		setDeletingId(job.id);
		const { error } = await supabase.from('jobs').delete().eq('id', job.id);
		setDeletingId(null);
		if (error) {
			toast(error.message, 'error');
			return;
		}
		setJobs((list) => list.filter((j) => j.id !== job.id));
		setJobPendingDelete(null);
		toast(`"${job.name}" deleted`, 'success');
	};

	return (
		<SharedLayout>
			<div className="px-4 sm:px-6 md:px-8 py-8 max-w-6xl mx-auto">
				<SetupChecklist profile={profile} />

				{estimateLimitBanner && (
					<div
						role="status"
						className="mb-6 flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
						style={{
							background: '#fff8f0',
							border: '1px solid var(--color-warning)',
						}}
					>
						<div className="flex items-start gap-3">
							<AlertTriangle
								size={18}
								style={{
									color: 'var(--color-warning)',
									flexShrink: 0,
									marginTop: 1,
								}}
							/>
							<p className="text-sm" style={{ color: 'var(--color-ink)' }}>
								You've used all <strong>5</strong> free estimates. Upgrade to
								unlock the estimator.
							</p>
						</div>
						<button
							type="button"
							onClick={() => setEstimateLimitBanner(false)}
							className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
							style={{
								background: 'var(--color-surface)',
								color: 'var(--color-slate)',
							}}
						>
							Dismiss
						</button>
					</div>
				)}

				{/* Page header */}
				<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1
							className="text-4xl font-black tracking-tight"
							style={{
								fontFamily: 'var(--font-display)',
								color: 'var(--color-ink)',
							}}
						>
							Jobs
						</h1>
						<p className="mt-1 text-sm" style={{ color: 'var(--color-slate)' }}>
							{jobs.length > 0
								? `${jobs.length} job${jobs.length === 1 ? '' : 's'}`
								: 'No jobs yet'}
						</p>
					</div>
					<button
						type="button"
						onClick={() => setShowNewJob(true)}
						className="flex shrink-0 items-center gap-2 self-start rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity sm:self-center"
						style={{ background: 'var(--color-accent)', color: '#fff' }}
						onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
						onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
					>
						<Plus size={16} />
						New Job
					</button>
				</div>

				{/* Search */}
				<div className="mb-6 relative">
					<Search
						size={16}
						className="absolute left-3.5 top-1/2 -translate-y-1/2"
						style={{ color: 'var(--color-slate)' }}
					/>
					<input
						type="text"
						placeholder="Search jobs…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm transition-all outline-none"
						style={{
							background: 'var(--color-card)',
							border: '1.5px solid var(--color-border)',
							color: 'var(--color-ink)',
							fontFamily: 'var(--font-body)',
						}}
						onFocus={(e) =>
							(e.currentTarget.style.borderColor = 'var(--color-primary)')
						}
						onBlur={(e) =>
							(e.currentTarget.style.borderColor = 'var(--color-border)')
						}
					/>
				</div>

				{/* Jobs list */}
				{loading ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
						{[1, 2, 3].map((i) => (
							<div
								key={i}
								className="rounded-xl overflow-hidden animate-pulse"
								style={{
									background: 'var(--color-card)',
									border: '1px solid var(--color-border)',
								}}
							>
								<div
									className="h-28"
									style={{ background: 'var(--color-surface)' }}
								/>
								<div className="p-4 space-y-2.5">
									<div
										className="h-4 rounded"
										style={{ background: 'var(--color-surface)', width: '70%' }}
									/>
									<div
										className="h-3 rounded"
										style={{ background: 'var(--color-surface)', width: '50%' }}
									/>
								</div>
							</div>
						))}
					</div>
				) : filtered.length === 0 ? (
					<div
						className="flex flex-col items-center justify-center py-20 rounded-2xl"
						style={{
							background: 'var(--color-card)',
							border: '1px solid var(--color-border)',
						}}
					>
						<div
							className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
							style={{ background: 'var(--color-surface)' }}
						>
							<Building2 size={26} style={{ color: 'var(--color-border)' }} />
						</div>
						<h3
							className="font-semibold text-lg mb-1"
							style={{
								fontFamily: 'var(--font-display)',
								color: 'var(--color-ink)',
							}}
						>
							{search ? 'No matching jobs' : 'No jobs yet'}
						</h3>
						<p className="text-sm mb-6" style={{ color: 'var(--color-slate)' }}>
							{search
								? 'Try a different search term'
								: 'Create your first job to start estimating rooflines'}
						</p>
						{!search && (
							<button
								type="button"
								onClick={() => setShowNewJob(true)}
								className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
								style={{ background: 'var(--color-accent)', color: '#fff' }}
								onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
								onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
							>
								<Plus size={15} />
								Create first job
							</button>
						)}
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
						{filtered.map((job) => (
							<div
								key={job.id}
								className="group rounded-xl overflow-hidden cursor-pointer transition-all duration-200"
								style={{
									background: 'var(--color-card)',
									border: '1px solid var(--color-border)',
									boxShadow: 'var(--shadow-card)',
								}}
								onClick={() => navigate(`/jobs/${job.id}`)}
								onMouseEnter={(e) =>
									(e.currentTarget.style.boxShadow = 'var(--shadow-dropdown)')
								}
								onMouseLeave={(e) =>
									(e.currentTarget.style.boxShadow = 'var(--shadow-card)')
								}
							>
								{/* Thumbnail */}
								<div
									className="relative h-28 w-full overflow-hidden"
									style={{ background: 'var(--color-surface)' }}
								>
									<JobCardCover
										address={job.address}
										jobName={job.name}
										mapsApiKey={mapsApiKey}
									/>
									<button
										type="button"
										aria-label={`Delete ${job.name}`}
										disabled={deletingId === job.id}
										onClick={(e) => openDeleteConfirm(job, e)}
										className="absolute left-2.5 top-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-lg opacity-0 pointer-events-none shadow transition-all group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none disabled:pointer-events-none"
										style={{
											background: 'var(--color-card)',
											color: 'var(--color-destructive)',
											border: '1px solid rgba(201,64,64,0.18)',
										}}
									>
										{deletingId === job.id ? (
											<Loader2 size={15} className="animate-spin" />
										) : (
											<Trash2 size={15} />
										)}
									</button>
									{(job.status ?? 'estimate_sent') !== 'estimate_sent' && (
										<div className="absolute top-2.5 right-2.5">
											<JobStatusBadge
												status={job.status ?? 'estimate_sent'}
												size="sm"
											/>
										</div>
									)}
								</div>

								{/* Card body */}
								<div className="p-4">
									<h3
										className="font-semibold text-base leading-snug mb-1"
										style={{
											fontFamily: 'var(--font-display)',
											color: 'var(--color-ink)',
										}}
									>
										{job.name}
									</h3>
									{job.address && (
										<p
											className="text-xs flex items-center gap-1 mb-3"
											style={{ color: 'var(--color-slate)' }}
										>
											<MapPin size={11} className="flex-shrink-0" />
											<span className="truncate">{job.address}</span>
										</p>
									)}
									<div
										className="flex items-center justify-between pt-3"
										style={{ borderTop: '1px solid var(--color-border)' }}
									>
										<div className="flex items-center gap-4">
											<div>
												<p
													className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
													style={{ color: 'var(--color-slate)' }}
												>
													Created
												</p>
												<p
													className="text-xs font-semibold"
													style={{ color: 'var(--color-ink)' }}
												>
													{new Date(job.created_at).toLocaleDateString(
														'en-US',
														{ month: 'short', day: 'numeric' }
													)}
												</p>
											</div>
											<div>
												<p
													className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
													style={{ color: 'var(--color-slate)' }}
												>
													Estimates
												</p>
												<p
													className="text-xs font-semibold"
													style={{ color: 'var(--color-ink)' }}
												>
													{job.quote_count ?? 0}
												</p>
											</div>
										</div>
										<ArrowRight
											size={16}
											style={{
												color: 'var(--color-primary)',
												transition: 'transform 150ms ease-out',
											}}
											className="group-hover:translate-x-0.5 transition-transform"
										/>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{showNewJob && (
				<NewJobModal
					onCreated={(jobId) => {
						setShowNewJob(false);
						fetchJobs();
						navigate(`/jobs/${jobId}`);
					}}
					onClose={() => setShowNewJob(false)}
				/>
			)}

			{/* Delete confirm dialog */}
			{jobPendingDelete && (
				<div
					className="fixed inset-0 z-[100] flex items-center justify-center px-4"
					style={{ background: 'rgba(31,61,44,0.75)' }}
					role="dialog"
					aria-modal="true"
					aria-labelledby="delete-job-title"
					onClick={(e) => e.target === e.currentTarget && cancelDeleteConfirm()}
				>
					<div
						className="w-full max-w-md overflow-hidden rounded-xl"
						style={{
							background: 'var(--color-card)',
							boxShadow: 'var(--shadow-modal)',
						}}
					>
						<div className="p-6">
							<div className="mb-4 flex items-center gap-3">
								<div
									className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
									style={{ background: 'rgba(201,64,64,0.08)' }}
								>
									<Trash2
										size={20}
										style={{ color: 'var(--color-destructive)' }}
									/>
								</div>
								<h2
									id="delete-job-title"
									className="text-lg font-bold"
									style={{
										fontFamily: 'var(--font-display)',
										color: 'var(--color-ink)',
									}}
								>
									Delete job?
								</h2>
							</div>
							<p
								className="mb-2 text-sm"
								style={{ color: 'var(--color-slate)' }}
							>
								<span
									className="font-semibold"
									style={{ color: 'var(--color-ink)' }}
								>
									"{jobPendingDelete.name}"
								</span>{' '}
								will be removed permanently.
							</p>
							{(jobPendingDelete.quote_count ?? 0) > 0 ? (
								<p
									className="mb-5 text-sm"
									style={{ color: 'var(--color-destructive)' }}
								>
									This also deletes {jobPendingDelete.quote_count} saved
									estimate{(jobPendingDelete.quote_count ?? 0) === 1 ? '' : 's'}
									.
								</p>
							) : (
								<p
									className="mb-5 text-sm"
									style={{ color: 'var(--color-slate)' }}
								>
									This cannot be undone.
								</p>
							)}
							<div className="flex gap-3">
								<button
									type="button"
									onClick={cancelDeleteConfirm}
									disabled={!!deletingId}
									className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
									style={{
										background: 'var(--color-surface)',
										color: 'var(--color-slate)',
										border: '1px solid var(--color-border)',
									}}
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={() => void confirmDeleteJob()}
									disabled={!!deletingId}
									className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
									style={{
										background: 'var(--color-destructive)',
										color: '#fff',
									}}
									onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
									onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
								>
									{deletingId ? (
										<>
											<Loader2 size={15} className="animate-spin" /> Deleting…
										</>
									) : (
										<>
											<Trash2 size={15} /> Delete job
										</>
									)}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</SharedLayout>
	);
}
