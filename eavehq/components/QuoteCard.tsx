import { Pencil, Tag, Trash2 } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import type { Profile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';
import { calcDiscountedPrice, discountLabel } from '../utils/discount';
import { isFreeTierEstimatorExhausted } from '../utils/estimatorAccess';

interface Quote {
	id: string;
	label: string;
	line_items: any[];
	notes: string | null;
	total_linear_ft: number | null;
	total_price: number | null;
	price_per_foot: number | null;
	controller_fee: number | null;
	include_controller: boolean | null;
	created_at: string;
	discount_amount?: number | null;
	discount_type?: string | null;
}

interface Props {
	quote: Quote;
	profile: Profile | null;
	jobId: string;
	onDelete: () => void;
	onEdit: () => void;
	onDiscountChange?: (
		quoteId: string,
		discountAmount: number | null,
		discountType: string | null
	) => void;
}

const inputSm: React.CSSProperties = {
	padding: '6px 10px',
	background: 'var(--color-surface)',
	border: '1px solid var(--color-border)',
	borderRadius: 'var(--radius-sm)',
	color: 'var(--color-ink)',
	fontSize: '0.875rem',
	outline: 'none',
	width: '6rem',
};

export default function QuoteCard({
	quote,
	profile,
	jobId,
	onDelete,
	onEdit,
	onDiscountChange,
}: Props) {
	const estimatorLocked = isFreeTierEstimatorExhausted(profile);

	const [discountEditing, setDiscountEditing] = useState(false);
	const [discountType, setDiscountType] = useState<'percent' | 'flat'>(
		(quote.discount_type as 'percent' | 'flat') ?? 'percent'
	);
	const [discountValue, setDiscountValue] = useState<string>(
		quote.discount_amount != null ? String(quote.discount_amount) : ''
	);
	const [applyToAll, setApplyToAll] = useState(false);
	const [discountSaving, setDiscountSaving] = useState(false);
	const [discountError, setDiscountError] = useState<string | null>(null);

	const handleDiscountSave = async () => {
		setDiscountSaving(true);
		setDiscountError(null);
		const parsed =
			discountValue.trim() === '' ? null : parseFloat(discountValue);
		if (discountValue.trim() !== '' && (Number.isNaN(parsed!) || parsed! < 0)) {
			setDiscountError('Enter a valid positive number.');
			setDiscountSaving(false);
			return;
		}
		if (parsed != null && discountType === 'percent' && parsed > 100) {
			setDiscountError('Percent discount cannot exceed 100.');
			setDiscountSaving(false);
			return;
		}
		const updates = {
			discount_amount: parsed,
			discount_type: parsed != null ? discountType : null,
		};
		const { error } = await supabase
			.from('quotes')
			.update(updates)
			.eq('id', quote.id);
		if (error) {
			setDiscountError(error.message);
			setDiscountSaving(false);
			return;
		}
		if (applyToAll && parsed != null) {
			await supabase
				.from('quotes')
				.update(updates)
				.eq('job_id', jobId)
				.neq('id', quote.id);
		}
		onDiscountChange?.(quote.id, parsed, parsed != null ? discountType : null);
		setDiscountEditing(false);
		setDiscountSaving(false);
	};

	const handleDiscountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') void handleDiscountSave();
		if (e.key === 'Escape') setDiscountEditing(false);
	};

	const rawPrice = quote.total_price ?? 0;
	const currentDiscountAmount = quote.discount_amount ?? null;
	const currentDiscountType = quote.discount_type ?? null;
	const discountedPrice = calcDiscountedPrice(
		rawPrice,
		currentDiscountAmount,
		currentDiscountType
	);
	const hasDiscount =
		currentDiscountAmount != null && discountedPrice < rawPrice;

	return (
		<div
			className="rounded-xl transition-shadow group"
			style={{
				background: 'var(--color-card)',
				border: '1px solid var(--color-border)',
				boxShadow: 'var(--shadow-card)',
			}}
			onMouseEnter={(e) =>
				(e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)')
			}
			onMouseLeave={(e) =>
				(e.currentTarget.style.boxShadow = 'var(--shadow-card)')
			}
		>
			<div className="p-6">
				{/* Header row */}
				<div className="flex justify-between items-start mb-6">
					<div>
						<span
							className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
							style={{
								background: 'rgba(58,99,73,0.1)',
								color: 'var(--color-primary)',
							}}
						>
							Draft
						</span>
						<h3
							className="text-2xl font-bold mt-3"
							style={{
								fontFamily: 'var(--font-display)',
								color: 'var(--color-ink)',
							}}
						>
							{quote.label}
						</h3>
						<p className="text-xs mt-1" style={{ color: 'var(--color-slate)' }}>
							{new Date(quote.created_at).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric',
								year: 'numeric',
							})}
						</p>
					</div>
					{/* Action icons */}
					<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
						<button
							type="button"
							onClick={onEdit}
							disabled={estimatorLocked}
							title={
								estimatorLocked
									? 'Free estimate limit reached (5/5). Upgrade to edit.'
									: 'Edit in estimator'
							}
							className="p-2 rounded-lg transition-colors"
							style={{ color: 'var(--color-slate)' }}
							onMouseEnter={(e) => {
								if (!estimatorLocked) {
									e.currentTarget.style.color = 'var(--color-primary)';
									e.currentTarget.style.background = 'var(--color-surface)';
								}
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.color = 'var(--color-slate)';
								e.currentTarget.style.background = 'transparent';
							}}
						>
							<Pencil size={15} />
						</button>
						<button
							type="button"
							onClick={onDelete}
							title="Delete estimate"
							className="p-2 rounded-lg transition-colors"
							style={{ color: 'var(--color-slate)' }}
							onMouseEnter={(e) => {
								e.currentTarget.style.color = 'var(--color-destructive)';
								e.currentTarget.style.background = 'rgba(201,64,64,0.06)';
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.color = 'var(--color-slate)';
								e.currentTarget.style.background = 'transparent';
							}}
						>
							<Trash2 size={15} />
						</button>
					</div>
				</div>

				{/* Discount section */}
				<div className="mb-4">
					{discountEditing ? (
						<div
							className="rounded-lg p-4 space-y-3"
							style={{
								border: '1px solid var(--color-border)',
								background: 'var(--color-surface)',
							}}
						>
							<p
								className="text-[10px] font-bold uppercase tracking-wider"
								style={{ color: 'var(--color-slate)' }}
							>
								Discount
							</p>
							<div className="flex items-center gap-2">
								{/* Type toggle */}
								<div
									className="flex rounded-md overflow-hidden"
									style={{ border: '1px solid var(--color-border)' }}
								>
									{(['percent', 'flat'] as const).map((t) => (
										<button
											key={t}
											type="button"
											onClick={() => setDiscountType(t)}
											className="px-3 py-1.5 text-sm font-bold transition-colors"
											style={
												discountType === t
													? {
															background: 'var(--color-primary)',
															color: '#fff',
														}
													: {
															color: 'var(--color-slate)',
															background: 'transparent',
														}
											}
										>
											{t === 'percent' ? '%' : '$'}
										</button>
									))}
								</div>
								<input
									type="number"
									min={0}
									step={discountType === 'percent' ? 1 : 0.01}
									value={discountValue}
									onChange={(e) => setDiscountValue(e.target.value)}
									onKeyDown={handleDiscountKeyDown}
									autoFocus
									placeholder="0"
									style={inputSm}
								/>
								{discountValue.trim() !== '' && (
									<button
										type="button"
										onClick={() => setDiscountValue('')}
										className="text-xs transition-colors"
										style={{ color: 'var(--color-slate)' }}
										onMouseEnter={(e) =>
											(e.currentTarget.style.color = 'var(--color-destructive)')
										}
										onMouseLeave={(e) =>
											(e.currentTarget.style.color = 'var(--color-slate)')
										}
									>
										Clear
									</button>
								)}
							</div>
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={applyToAll}
									onChange={(e) => setApplyToAll(e.target.checked)}
									className="rounded"
									style={{ accentColor: 'var(--color-primary)' }}
								/>
								<span
									className="text-xs"
									style={{ color: 'var(--color-slate)' }}
								>
									Apply to all estimates on this job
								</span>
							</label>
							{discountError && (
								<p
									className="text-xs"
									style={{ color: 'var(--color-destructive)' }}
								>
									{discountError}
								</p>
							)}
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => setDiscountEditing(false)}
									disabled={discountSaving}
									className="flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors"
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
									onClick={() => void handleDiscountSave()}
									disabled={discountSaving}
									className="flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors"
									style={{ background: 'var(--color-primary)', color: '#fff' }}
								>
									{discountSaving ? 'Saving…' : 'Save'}
								</button>
							</div>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setDiscountEditing(true)}
							className="flex items-center gap-1.5 text-xs transition-colors"
							style={{
								color: hasDiscount
									? 'var(--color-success)'
									: 'var(--color-slate)',
							}}
							onMouseEnter={(e) =>
								(e.currentTarget.style.color = 'var(--color-primary)')
							}
							onMouseLeave={(e) =>
								(e.currentTarget.style.color = hasDiscount
									? 'var(--color-success)'
									: 'var(--color-slate)')
							}
						>
							<Tag size={13} />
							{hasDiscount &&
							currentDiscountAmount != null &&
							currentDiscountType != null
								? discountLabel(
										currentDiscountAmount,
										currentDiscountType,
										rawPrice
									)
								: 'Add discount'}
						</button>
					)}
				</div>

				{/* Totals footer */}
				<div
					className="flex justify-between items-end pt-6"
					style={{ borderTop: '1px solid var(--color-border)' }}
				>
					<div>
						<p
							className="text-[10px] uppercase tracking-widest font-bold"
							style={{ color: 'var(--color-slate)' }}
						>
							Total Footage
						</p>
						<p
							className="text-lg font-bold"
							style={{
								fontFamily: 'var(--font-mono)',
								color: 'var(--color-ink)',
							}}
						>
							{(quote.total_linear_ft ?? 0).toFixed(1)} ft
						</p>
					</div>
					<div className="text-right">
						<p
							className="text-[10px] uppercase tracking-widest font-bold"
							style={{ color: 'var(--color-slate)' }}
						>
							Estimated Total
						</p>
						{hasDiscount ? (
							<>
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
								<p
									className="text-4xl font-black tracking-tight"
									style={{
										fontFamily: 'var(--font-mono)',
										color: 'var(--color-accent)',
									}}
								>
									$
									{discountedPrice.toLocaleString('en-US', {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									})}
								</p>
							</>
						) : (
							<p
								className="text-4xl font-black tracking-tight"
								style={{
									fontFamily: 'var(--font-mono)',
									color: 'var(--color-accent)',
								}}
							>
								$
								{rawPrice.toLocaleString('en-US', {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
								})}
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
