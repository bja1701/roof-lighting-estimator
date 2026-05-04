import {
	ArrowLeft,
	CalendarDays,
	ChevronRight,
	Home,
	Loader2,
	Mail,
	MapPin,
	Phone,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import JobStatusBadge from '../components/JobStatusBadge';
import SharedLayout from '../components/SharedLayout';
import { supabase } from '../lib/supabase';
import type { Client } from '../types/client';
import type { Job } from '../types/job';

export default function ClientDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const [client, setClient] = useState<Client | null>(null);
	const [jobs, setJobs] = useState<Job[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (id) void fetchData(id);
	}, [id]);

	const fetchData = async (clientId: string) => {
		setLoading(true);
		const [{ data: clientData }, { data: jobsData }] = await Promise.all([
			supabase.from('clients').select('*').eq('id', clientId).single(),
			supabase
				.from('jobs')
				.select('*, quotes(count)')
				.eq('client_id', clientId)
				.order('created_at', { ascending: false }),
		]);
		setClient(clientData ?? null);
		setJobs(
			(jobsData ?? []).map((j: any) => ({
				...j,
				quote_count: j.quotes?.[0]?.count ?? 0,
			}))
		);
		setLoading(false);
	};

	if (loading) {
		return (
			<SharedLayout>
				<div
					className="flex items-center justify-center py-32"
					style={{ color: 'var(--color-slate)' }}
				>
					<Loader2 className="mr-2 animate-spin" size={18} aria-hidden="true" />
					Loading…
				</div>
			</SharedLayout>
		);
	}

	if (!client) {
		return (
			<SharedLayout>
				<div
					className="flex items-center justify-center py-32"
					style={{ color: 'var(--color-slate)' }}
				>
					Client not found.
				</div>
			</SharedLayout>
		);
	}

	const fullAddress = [
		client.address_street,
		client.address_city,
		client.address_zip,
	]
		.filter(Boolean)
		.join(', ');

	return (
		<SharedLayout>
			<div className="px-4 sm:px-6 md:px-10 py-8 max-w-4xl mx-auto">
				{/* Breadcrumb */}
				<nav
					className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest mb-6"
					style={{ color: 'var(--color-slate)' }}
				>
					<button
						type="button"
						onClick={() => navigate('/clients')}
						className="transition-colors flex items-center gap-1 min-h-[44px]"
						style={{ color: 'var(--color-primary)' }}
					>
						<ArrowLeft size={15} aria-hidden="true" />
						Clients
					</button>
					<span>/</span>
					<span className="font-bold" style={{ color: 'var(--color-ink)' }}>
						{client.name}
					</span>
				</nav>

				{/* Client card */}
				<div
					className="rounded-2xl p-6 mb-8"
					style={{
						background: 'var(--color-card)',
						border: '1px solid var(--color-border)',
						boxShadow: 'var(--shadow-card)',
					}}
				>
					<div className="flex flex-col sm:flex-row sm:items-start gap-4">
						<div
							className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
							style={{ background: 'var(--color-primary)' }}
						>
							<span
								className="text-white font-bold text-2xl"
								style={{ fontFamily: 'var(--font-display)' }}
							>
								{client.name[0]?.toUpperCase() ?? '?'}
							</span>
						</div>
						<div className="flex-1 min-w-0">
							<h1
								className="text-4xl font-black tracking-tight mb-1"
								style={{
									color: 'var(--color-ink)',
									fontFamily: 'var(--font-display)',
								}}
							>
								{client.name}
							</h1>
							{client.company_name && (
								<p
									className="text-sm mb-3"
									style={{ color: 'var(--color-slate)' }}
								>
									{client.company_name}
								</p>
							)}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
								{client.email && (
									<div
										className="flex items-center gap-2"
										style={{ color: 'var(--color-slate)' }}
									>
										<Mail
											size={15}
											aria-hidden="true"
											style={{ color: 'var(--color-primary)' }}
										/>
										<a
											href={`mailto:${client.email}`}
											className="transition-colors"
										>
											{client.email}
										</a>
									</div>
								)}
								{client.phone && (
									<div
										className="flex items-center gap-2"
										style={{ color: 'var(--color-slate)' }}
									>
										<Phone
											size={15}
											aria-hidden="true"
											style={{ color: 'var(--color-primary)' }}
										/>
										<a
											href={`tel:${client.phone}`}
											className="transition-colors"
										>
											{client.phone}
										</a>
									</div>
								)}
								{fullAddress && (
									<div
										className="flex items-center gap-2 sm:col-span-2"
										style={{ color: 'var(--color-slate)' }}
									>
										<MapPin
											size={15}
											aria-hidden="true"
											style={{ color: 'var(--color-primary)' }}
										/>
										<span>{fullAddress}</span>
									</div>
								)}
							</div>
							{client.notes && (
								<div
									className="mt-4 p-3 rounded-lg text-sm"
									style={{
										background: 'var(--color-surface)',
										color: 'var(--color-slate)',
									}}
								>
									{client.notes}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Job history */}
				<h2
					className="font-bold text-lg mb-4"
					style={{
						color: 'var(--color-ink)',
						fontFamily: 'var(--font-display)',
					}}
				>
					Job History
				</h2>
				{jobs.length === 0 ? (
					<div
						className="text-center py-16 rounded-2xl"
						style={{
							background: 'var(--color-card)',
							border: '1px solid var(--color-border)',
							boxShadow: 'var(--shadow-card)',
						}}
					>
						<Home
							className="mx-auto mb-3"
							size={40}
							aria-hidden="true"
							style={{ color: 'rgba(90,96,112,0.3)' }}
						/>
						<p className="text-sm" style={{ color: 'var(--color-slate)' }}>
							No jobs linked to this client yet.
						</p>
					</div>
				) : (
					<div className="space-y-2">
						{jobs.map((job) => (
							<button
								key={job.id}
								type="button"
								onClick={() => navigate(`/jobs/${job.id}`)}
								className="w-full text-left rounded-xl px-4 py-4 transition-all flex flex-col sm:flex-row sm:items-center gap-2 min-h-[44px]"
								style={{
									background: 'var(--color-card)',
									border: '1px solid var(--color-border)',
									boxShadow: 'var(--shadow-card)',
								}}
							>
								<div className="flex-1 min-w-0">
									<div className="flex flex-wrap items-center gap-2 mb-1">
										<span
											className="font-bold"
											style={{
												color: 'var(--color-ink)',
												fontFamily: 'var(--font-display)',
											}}
										>
											{job.name}
										</span>
										<JobStatusBadge status={job.status} size="sm" />
									</div>
									<div
										className="flex flex-wrap gap-3 text-xs"
										style={{ color: 'var(--color-slate)' }}
									>
										{job.address && (
											<span className="flex items-center gap-1">
												<MapPin size={13} aria-hidden="true" />
												{job.address}
											</span>
										)}
										<span className="flex items-center gap-1">
											<CalendarDays size={13} aria-hidden="true" />
											{new Date(job.created_at).toLocaleDateString('en-US', {
												month: 'short',
												day: 'numeric',
												year: 'numeric',
											})}
										</span>
										<span>
											{job.quote_count ?? 0} estimate
											{(job.quote_count ?? 0) !== 1 ? 's' : ''}
										</span>
									</div>
								</div>
								<ChevronRight
									className="shrink-0"
									size={18}
									aria-hidden="true"
									style={{ color: 'var(--color-slate)' }}
								/>
							</button>
						))}
					</div>
				)}
			</div>
		</SharedLayout>
	);
}
