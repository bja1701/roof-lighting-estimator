import { Loader2, Search, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SharedLayout from '../components/SharedLayout';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';

interface UserRow {
	id: string;
	full_name: string | null;
	company_name: string | null;
	email: string | null;
	subscription_status: 'free' | 'active' | 'canceling' | 'canceled';
	estimates_used: number;
	role: 'user' | 'admin';
	created_at: string;
}

interface FeedbackRow {
	id: string;
	user_id: string | null;
	rating: number | null;
	message: string;
	page: string | null;
	created_at: string;
	profiles?: {
		full_name: string | null;
		email: string | null;
		company_name: string | null;
	} | null;
}

export default function AdminPage() {
	const navigate = useNavigate();
	const { profile } = useProfile();
	const [users, setUsers] = useState<UserRow[]>([]);
	const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
	const [tab, setTab] = useState<'users' | 'feedback'>('users');
	const [loading, setLoading] = useState(true);
	const [savingId, setSavingId] = useState<string | null>(null);
	const [userSearch, setUserSearch] = useState('');
	const [tierFilter, setTierFilter] = useState<
		'all' | UserRow['subscription_status']
	>('all');

	useEffect(() => {
		if (profile && profile.role !== 'admin') {
			navigate('/');
			return;
		}
		fetchData();
	}, [profile]);

	const fetchData = async () => {
		setLoading(true);
		const [{ data: userData }, { data: fbData }] = await Promise.all([
			supabase
				.from('profiles')
				.select('*')
				.order('created_at', { ascending: false }),
			supabase
				.from('feedback')
				.select('*, profiles:user_id(full_name, email, company_name)')
				.order('created_at', { ascending: false }),
		]);
		setUsers(userData ?? []);
		setFeedback((fbData ?? []) as FeedbackRow[]);
		setLoading(false);
	};

	const handleTierChange = async (
		userId: string,
		tier: UserRow['subscription_status']
	) => {
		setSavingId(userId);
		await supabase
			.from('profiles')
			.update({ subscription_status: tier })
			.eq('id', userId);
		setUsers((u) =>
			u.map((x) => (x.id === userId ? { ...x, subscription_status: tier } : x))
		);
		setSavingId(null);
	};

	const stats = {
		total: users.length,
		free: users.filter((u) => u.subscription_status === 'free').length,
		active: users.filter((u) => u.subscription_status === 'active').length,
		canceling: users.filter((u) => u.subscription_status === 'canceling')
			.length,
		canceled: users.filter((u) => u.subscription_status === 'canceled').length,
	};

	const filteredUsers = users.filter((user) => {
		const query = userSearch.trim().toLowerCase();
		const matchesQuery =
			!query ||
			[
				user.full_name,
				user.company_name,
				user.email,
				user.subscription_status,
			].some((value) => (value ?? '').toLowerCase().includes(query));
		const matchesTier =
			tierFilter === 'all' || user.subscription_status === tierFilter;
		return matchesQuery && matchesTier;
	});

	return (
		<SharedLayout>
			<div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
				{/* Header */}
				<div className="flex items-center justify-between mb-12">
					<div>
						<h1
							className="text-4xl font-black tracking-tight"
							style={{
								color: 'var(--color-ink)',
								fontFamily: 'var(--font-display)',
							}}
						>
							Admin
						</h1>
						<p className="text-sm mt-1" style={{ color: 'var(--color-slate)' }}>
							User management, tier control, and feedback inbox.
						</p>
					</div>
					<span
						className="text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full"
						style={{
							background: 'rgba(58,99,73,0.1)',
							color: 'var(--color-primary)',
						}}
					>
						Admin Panel
					</span>
				</div>

				{/* Stats row */}
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-10">
					{[
						{
							label: 'Total Users',
							value: stats.total,
							color: 'var(--color-ink)',
						},
						{
							label: 'Free Tier',
							value: stats.free,
							color: 'var(--color-slate)',
						},
						{
							label: 'Active',
							value: stats.active,
							color: 'var(--color-success)',
						},
						{
							label: 'Canceled',
							value: stats.canceled,
							color: 'var(--color-warning)',
						},
					].map((s) => (
						<div
							key={s.label}
							className="rounded-xl p-6"
							style={{
								background: 'var(--color-card)',
								border: '1px solid var(--color-border)',
								boxShadow: 'var(--shadow-card)',
							}}
						>
							<p
								className="text-[10px] font-semibold uppercase tracking-widest mb-2"
								style={{ color: 'var(--color-slate)' }}
							>
								{s.label}
							</p>
							<p
								className="text-3xl font-bold"
								style={{ color: s.color, fontFamily: 'var(--font-display)' }}
							>
								{s.value}
							</p>
						</div>
					))}
				</div>

				{/* Tabs */}
				<div
					className="flex p-1 rounded-lg w-fit mb-6"
					style={{ background: 'var(--color-surface)' }}
				>
					{(['users', 'feedback'] as const).map((t) => (
						<button
							type="button"
							key={t}
							onClick={() => setTab(t)}
							className="px-5 py-2 text-sm font-medium rounded-md capitalize transition-all"
							style={{
								background: tab === t ? 'var(--color-card)' : 'transparent',
								boxShadow: tab === t ? 'var(--shadow-card)' : 'none',
								color:
									tab === t ? 'var(--color-primary)' : 'var(--color-slate)',
							}}
						>
							{t}
						</button>
					))}
				</div>

				{loading ? (
					<div
						className="flex items-center justify-center py-16"
						style={{ color: 'var(--color-slate)' }}
					>
						<Loader2
							className="mr-2 animate-spin"
							size={18}
							aria-hidden="true"
						/>
						Loading…
					</div>
				) : tab === 'users' ? (
					<div className="space-y-4">
						<div className="flex flex-col gap-3 sm:flex-row">
							<div className="relative flex-1">
								<Search
									size={17}
									className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
									aria-hidden="true"
									style={{ color: 'var(--color-slate)' }}
								/>
								<input
									type="search"
									value={userSearch}
									onChange={(e) => setUserSearch(e.target.value)}
									placeholder="Search name, email, company, or tier"
									className="min-h-[44px] w-full rounded-lg py-2.5 pl-10 pr-3 text-sm outline-none"
									style={{
										background: 'var(--color-card)',
										border: '1px solid var(--color-border)',
										color: 'var(--color-ink)',
									}}
								/>
							</div>
							<select
								value={tierFilter}
								onChange={(e) =>
									setTierFilter(e.target.value as typeof tierFilter)
								}
								className="min-h-[44px] rounded-lg px-3 py-2.5 text-sm outline-none"
								style={{
									background: 'var(--color-card)',
									border: '1px solid var(--color-border)',
									color: 'var(--color-ink)',
								}}
							>
								<option value="all">All tiers</option>
								<option value="free">Free</option>
								<option value="active">Active</option>
								<option value="canceling">Canceling</option>
								<option value="canceled">Canceled</option>
							</select>
						</div>

						<div
							className="rounded-xl overflow-hidden"
							style={{
								background: 'var(--color-card)',
								border: '1px solid var(--color-border)',
								boxShadow: 'var(--shadow-card)',
							}}
						>
							<table className="w-full text-sm">
								<thead style={{ background: 'var(--color-surface)' }}>
									<tr>
										{['User', 'Company', 'Tier', 'Estimates', 'Joined'].map(
											(h) => (
												<th
													key={h}
													className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider"
													style={{ color: 'var(--color-slate)' }}
												>
													{h}
												</th>
											)
										)}
									</tr>
								</thead>
								<tbody>
									{filteredUsers.map((u) => {
										const estimatePct = Math.min(
											100,
											((u.estimates_used ?? 0) / 5) * 100
										);
										return (
											<tr
												key={u.id}
												className="border-t transition-colors"
												style={{ borderColor: 'var(--color-border)' }}
											>
												<td className="px-5 py-4">
													<p
														className="font-medium"
														style={{ color: 'var(--color-ink)' }}
													>
														{u.full_name ?? '—'}
													</p>
													<p
														className="text-xs"
														style={{ color: 'var(--color-slate)' }}
													>
														{u.email ?? '—'}
													</p>
												</td>
												<td
													className="px-5 py-4"
													style={{ color: 'var(--color-slate)' }}
												>
													{u.company_name ?? '—'}
												</td>
												<td className="px-5 py-4">
													<select
														value={u.subscription_status}
														onChange={(e) =>
															handleTierChange(
																u.id,
																e.target.value as UserRow['subscription_status']
															)
														}
														disabled={savingId === u.id}
														className="border-none rounded-lg px-3 py-1.5 text-xs focus:outline-none transition-all"
														style={{
															background: 'var(--color-surface)',
															color: 'var(--color-ink)',
														}}
													>
														<option value="free">Free</option>
														<option value="active">Active</option>
														<option value="canceling">Canceling</option>
														<option value="canceled">Canceled</option>
													</select>
												</td>
												<td className="px-5 py-4">
													<div className="min-w-[120px]">
														<div
															className="mb-1 flex items-center justify-between gap-2 text-xs"
															style={{ color: 'var(--color-slate)' }}
														>
															<span style={{ fontFamily: 'var(--font-mono)' }}>
																{u.estimates_used ?? 0}/5
															</span>
															{u.subscription_status === 'active' && (
																<span>Pro</span>
															)}
														</div>
														<div
															className="h-1.5 overflow-hidden rounded-full"
															style={{ background: 'var(--color-surface)' }}
														>
															<div
																className="h-full rounded-full"
																style={{
																	width: `${estimatePct}%`,
																	background:
																		estimatePct >= 80
																			? 'var(--color-warning)'
																			: 'var(--color-primary)',
																}}
															/>
														</div>
													</div>
												</td>
												<td
													className="px-5 py-4 text-xs"
													style={{ color: 'var(--color-slate)' }}
												>
													{new Date(u.created_at).toLocaleDateString('en-US', {
														month: 'short',
														day: 'numeric',
														year: 'numeric',
													})}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
							{filteredUsers.length === 0 && (
								<p
									className="text-center py-10"
									style={{ color: 'var(--color-slate)' }}
								>
									No users match that filter.
								</p>
							)}
						</div>
					</div>
				) : (
					<div className="space-y-4">
						{feedback.length === 0 && (
							<p
								className="text-center py-10"
								style={{ color: 'var(--color-slate)' }}
							>
								No feedback yet.
							</p>
						)}
						{feedback.map((f) => (
							<div
								key={f.id}
								className="rounded-xl p-6"
								style={{
									background: 'var(--color-card)',
									border: '1px solid var(--color-border)',
									boxShadow: 'var(--shadow-card)',
								}}
							>
								<div className="flex items-start justify-between mb-3">
									<div>
										<div className="mb-1 flex items-center gap-0.5">
											{f.rating &&
												[1, 2, 3, 4, 5].map((s) => (
													<Star
														key={s}
														size={18}
														fill={
															s <= f.rating! ? 'var(--color-primary)' : 'none'
														}
														style={{
															color:
																s <= f.rating!
																	? 'var(--color-primary)'
																	: 'var(--color-border)',
														}}
													/>
												))}
										</div>
										<p
											className="text-xs"
											style={{ color: 'var(--color-slate)' }}
										>
											{f.profiles?.full_name ??
												f.profiles?.email ??
												'Unknown user'}
											{f.profiles?.company_name
												? ` · ${f.profiles.company_name}`
												: ''}
										</p>
									</div>
									<span
										className="text-xs"
										style={{ color: 'var(--color-slate)' }}
									>
										{new Date(f.created_at).toLocaleDateString()}
									</span>
								</div>
								<p className="text-sm" style={{ color: 'var(--color-ink)' }}>
									{f.message}
								</p>
								{f.page && (
									<p
										className="text-xs mt-1.5"
										style={{ color: 'var(--color-slate)' }}
									>
										Page: {f.page}
									</p>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</SharedLayout>
	);
}
