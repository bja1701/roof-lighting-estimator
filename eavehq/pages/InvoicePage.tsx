import { Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { calcDiscountedPrice, discountLabel } from '../utils/discount';

interface LineItem {
	id: string;
	type: string;
	pitch: string;
	length3d?: number;
	cost?: number;
}

interface Quote {
	id: string;
	label: string;
	total_linear_ft: number | null;
	total_price: number | null;
	price_per_foot: number | null;
	controller_fee: number | null;
	notes: string | null;
	line_items: LineItem[];
	discount_amount: number | null;
	discount_type: string | null;
	created_at: string;
}

interface JobData {
	id: string;
	user_id: string;
	name: string;
	address: string | null;
	deposit_percent: number;
	client_name: string | null;
	created_at: string;
	estimate_sent_at: string | null;
}

interface ContractorProfile {
	company_name: string | null;
	full_name: string | null;
	logo_url: string | null;
	email: string | null;
	phone: string | null;
}

export default function InvoicePage() {
	const { token } = useParams<{ token: string }>();

	const [job, setJob] = useState<JobData | null>(null);
	const [quotes, setQuotes] = useState<Quote[]>([]);
	const [contractor, setContractor] = useState<ContractorProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);

	useEffect(() => {
		if (!token) {
			setNotFound(true);
			setLoading(false);
			return;
		}
		void fetchData(token);
	}, [token]);

	const fetchData = async (portalToken: string) => {
		setLoading(true);
		const { data: jobData, error: jobError } = await supabase
			.from('jobs')
			.select(
				'id, user_id, name, address, deposit_percent, client_name, created_at, estimate_sent_at'
			)
			.eq('portal_token', portalToken)
			.single();

		if (jobError || !jobData) {
			setNotFound(true);
			setLoading(false);
			return;
		}
		setJob(jobData as JobData);

		const [{ data: quotesData }, { data: profileData }] = await Promise.all([
			supabase
				.from('quotes')
				.select(
					'id, label, total_linear_ft, total_price, price_per_foot, controller_fee, notes, line_items, discount_amount, discount_type, created_at'
				)
				.eq('job_id', jobData.id)
				.order('created_at', { ascending: true }),
			supabase
				.from('profiles')
				.select('company_name, full_name, logo_url, email, phone')
				.eq('id', jobData.user_id)
				.single(),
		]);

		setQuotes((quotesData as Quote[]) ?? []);
		setContractor((profileData as ContractorProfile) ?? null);
		setLoading(false);
	};

	const contractorName =
		contractor?.company_name ?? contractor?.full_name ?? 'Your Contractor';
	const preparedDate = job
		? new Date(job.estimate_sent_at ?? job.created_at).toLocaleDateString(
				'en-US',
				{ month: 'long', day: 'numeric', year: 'numeric' }
			)
		: '';

	if (loading) {
		return (
			<div
				className="min-h-screen flex items-center justify-center"
				style={{ background: 'var(--color-surface)' }}
			>
				<div
					className="w-8 h-8 rounded-full animate-spin"
					style={{
						border: '2px solid var(--color-border)',
						borderTopColor: 'var(--color-accent)',
					}}
				/>
			</div>
		);
	}

	if (notFound || !job) {
		return (
			<div
				className="min-h-screen flex items-center justify-center px-4"
				style={{ background: 'var(--color-surface)' }}
			>
				<div className="text-center max-w-sm">
					<h1
						className="text-xl font-bold mb-2"
						style={{
							color: 'var(--color-ink)',
							fontFamily: 'var(--font-display)',
						}}
					>
						Invoice not found
					</h1>
					<p className="text-sm" style={{ color: 'var(--color-slate)' }}>
						This link is no longer valid. Please contact your contractor.
					</p>
				</div>
			</div>
		);
	}

	return (
		<>
			<style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .invoice-card { box-shadow: none !important; border: none !important; }
        }
      `}</style>

			<div
				className="min-h-screen py-10 px-4"
				style={{
					background: 'var(--color-surface)',
					fontFamily: 'var(--font-body)',
				}}
			>
				{/* Print button */}
				<div className="max-w-3xl mx-auto mb-6 flex justify-end no-print">
					<button
						type="button"
						onClick={() => window.print()}
						className="flex items-center gap-2 font-bold py-2.5 px-5 rounded-lg transition-colors text-sm"
						style={{
							background: 'var(--color-accent)',
							color: '#fff',
							boxShadow: '0 2px 8px rgba(217,111,10,0.3)',
						}}
						onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
						onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
					>
						<Printer size={16} />
						Download as PDF
					</button>
				</div>

				<div
					className="max-w-3xl mx-auto rounded-xl overflow-hidden invoice-card"
					style={{
						background: 'var(--color-card)',
						border: '1px solid var(--color-border)',
						boxShadow: 'var(--shadow-card)',
					}}
				>
					{/* Invoice header */}
					<div
						className="px-8 py-7 text-white"
						style={{ background: 'var(--color-primary-dark)' }}
					>
						<div className="flex items-start justify-between gap-4">
							<div className="flex items-center gap-4">
								{contractor?.logo_url && (
									<img
										src={contractor.logo_url}
										alt="Company logo"
										className="h-14 w-14 object-contain rounded-lg flex-shrink-0"
										style={{ background: 'var(--color-card)', padding: '4px' }}
									/>
								)}
								<div>
									<p
										className="text-xl font-bold leading-tight"
										style={{ fontFamily: 'var(--font-display)' }}
									>
										{contractorName}
									</p>
									<p
										className="text-sm mt-0.5"
										style={{ color: 'rgba(255,255,255,0.5)' }}
									>
										Estimate Invoice
									</p>
									{contractor?.email && (
										<p
											className="text-sm mt-0.5"
											style={{ color: 'rgba(255,255,255,0.5)' }}
										>
											{contractor.email}
										</p>
									)}
									{contractor?.phone && (
										<p
											className="text-sm mt-0.5"
											style={{ color: 'rgba(255,255,255,0.5)' }}
										>
											{contractor.phone}
										</p>
									)}
								</div>
							</div>
							<div
								className="text-right text-sm flex-shrink-0"
								style={{ color: 'rgba(255,255,255,0.5)' }}
							>
								<p
									className="text-white font-bold text-lg"
									style={{ fontFamily: 'var(--font-display)' }}
								>
									{job.name}
								</p>
								{job.address && <p className="mt-0.5">{job.address}</p>}
								{job.client_name && (
									<p className="mt-0.5">Client: {job.client_name}</p>
								)}
								<p className="mt-0.5">Prepared {preparedDate}</p>
							</div>
						</div>
					</div>

					{/* Estimates */}
					<div className="px-8 py-8 space-y-8">
						{quotes.length === 0 ? (
							<p
								className="text-sm text-center py-8"
								style={{ color: 'var(--color-slate)' }}
							>
								No estimates available.
							</p>
						) : (
							quotes.map((quote, idx) => {
								const rawPrice = quote.total_price ?? 0;
								const effectivePrice = calcDiscountedPrice(
									rawPrice,
									quote.discount_amount,
									quote.discount_type
								);
								const hasDiscount = effectivePrice < rawPrice;
								const depositDue = effectivePrice * (job.deposit_percent / 100);
								const lineItems: LineItem[] = Array.isArray(quote.line_items)
									? quote.line_items
									: [];

								return (
									<div
										key={quote.id}
										className="rounded-xl overflow-hidden"
										style={{ border: '1px solid var(--color-border)' }}
									>
										{/* Option header */}
										<div
											className="px-6 py-4 flex items-center justify-between"
											style={{
												background: 'var(--color-surface)',
												borderBottom: '1px solid var(--color-border)',
											}}
										>
											<div>
												<span
													className="text-xs font-bold uppercase tracking-widest"
													style={{ color: 'var(--color-slate)' }}
												>
													Option {idx + 1}
												</span>
												<h2
													className="text-lg font-bold mt-0.5"
													style={{
														color: 'var(--color-ink)',
														fontFamily: 'var(--font-display)',
													}}
												>
													{quote.label}
												</h2>
											</div>
											<div className="text-right">
												{hasDiscount && (
													<p
														className="text-sm line-through"
														style={{
															color: 'var(--color-slate)',
															fontFamily: 'var(--font-mono)',
														}}
													>
														$
														{rawPrice.toLocaleString('en-US', {
															minimumFractionDigits: 2,
															maximumFractionDigits: 2,
														})}
													</p>
												)}
												<p
													className="text-2xl font-black"
													style={{
														color: 'var(--color-accent)',
														fontFamily: 'var(--font-mono)',
													}}
												>
													$
													{effectivePrice.toLocaleString('en-US', {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</p>
												{hasDiscount &&
													quote.discount_amount != null &&
													quote.discount_type != null && (
														<p
															className="text-xs font-semibold mt-0.5"
															style={{ color: 'var(--color-success)' }}
														>
															{discountLabel(
																quote.discount_amount,
																quote.discount_type,
																rawPrice
															)}
														</p>
													)}
											</div>
										</div>

										<div className="px-6 py-5 space-y-4">
											{quote.notes && (
												<p
													className="text-sm leading-relaxed"
													style={{ color: 'var(--color-slate)' }}
												>
													{quote.notes}
												</p>
											)}

											{lineItems.length > 0 && (
												<div>
													<p
														className="text-[10px] font-bold uppercase tracking-widest mb-2"
														style={{ color: 'var(--color-slate)' }}
													>
														Line Items
													</p>
													<table className="w-full text-sm">
														<thead>
															<tr
																style={{
																	borderBottom: '1px solid var(--color-border)',
																}}
															>
																{['Type', 'Pitch', 'Length (ft)', 'Cost'].map(
																	(h, i) => (
																		<th
																			key={h}
																			className={`py-1.5 text-xs font-bold uppercase tracking-wide ${i >= 2 ? 'text-right' : 'text-left'}`}
																			style={{ color: 'var(--color-slate)' }}
																		>
																			{h}
																		</th>
																	)
																)}
															</tr>
														</thead>
														<tbody>
															{lineItems.map((item) => (
																<tr
																	key={item.id}
																	style={{
																		borderBottom:
																			'1px solid var(--color-border)',
																	}}
																>
																	<td
																		className="py-1.5 capitalize"
																		style={{ color: 'var(--color-ink)' }}
																	>
																		{item.type}
																	</td>
																	<td
																		className="py-1.5"
																		style={{ color: 'var(--color-slate)' }}
																	>
																		{item.pitch}
																	</td>
																	<td
																		className="py-1.5 text-right"
																		style={{
																			color: 'var(--color-ink)',
																			fontFamily: 'var(--font-mono)',
																		}}
																	>
																		{item.length3d != null
																			? item.length3d.toFixed(1)
																			: '—'}
																	</td>
																	<td
																		className="py-1.5 text-right"
																		style={{
																			color: 'var(--color-ink)',
																			fontFamily: 'var(--font-mono)',
																		}}
																	>
																		{item.cost != null
																			? `$${item.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
																			: '—'}
																	</td>
																</tr>
															))}
														</tbody>
													</table>
												</div>
											)}

											{/* Summary row */}
											<div
												className="flex items-center justify-between pt-2"
												style={{ borderTop: '1px solid var(--color-border)' }}
											>
												<div className="text-sm">
													<span style={{ color: 'var(--color-slate)' }}>
														Total linear ft:{' '}
													</span>
													<span
														className="font-semibold"
														style={{
															color: 'var(--color-ink)',
															fontFamily: 'var(--font-mono)',
														}}
													>
														{quote.total_linear_ft != null
															? `${quote.total_linear_ft.toFixed(1)} ft`
															: '—'}
													</span>
													{quote.price_per_foot != null && (
														<span
															className="ml-2"
															style={{
																color: 'var(--color-slate)',
																fontFamily: 'var(--font-mono)',
															}}
														>
															@ ${quote.price_per_foot}/ft
														</span>
													)}
													{quote.controller_fee != null &&
														quote.controller_fee > 0 && (
															<span
																className="ml-2"
																style={{
																	color: 'var(--color-slate)',
																	fontFamily: 'var(--font-mono)',
																}}
															>
																+ ${quote.controller_fee} controller
															</span>
														)}
												</div>
												<div className="text-sm text-right">
													<span style={{ color: 'var(--color-slate)' }}>
														Deposit ({job.deposit_percent}%):{' '}
													</span>
													<span
														className="font-bold"
														style={{
															color: 'var(--color-ink)',
															fontFamily: 'var(--font-mono)',
														}}
													>
														$
														{depositDue.toLocaleString('en-US', {
															minimumFractionDigits: 2,
															maximumFractionDigits: 2,
														})}
													</span>
												</div>
											</div>
										</div>
									</div>
								);
							})
						)}
					</div>

					{/* Footer */}
					<div
						className="px-8 py-5"
						style={{
							borderTop: '1px solid var(--color-border)',
							background: 'var(--color-surface)',
						}}
					>
						<p
							className="text-sm text-center"
							style={{ color: 'var(--color-slate)' }}
						>
							Questions? Contact{' '}
							<span
								className="font-semibold"
								style={{ color: 'var(--color-ink)' }}
							>
								{contractorName}
							</span>
						</p>
					</div>
				</div>
			</div>
		</>
	);
}
