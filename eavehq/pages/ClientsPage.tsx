import {
	AlertCircle,
	CheckCircle2,
	ChevronRight,
	Search,
	Upload,
	Users,
	X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SharedLayout from '../components/SharedLayout';
import { supabase } from '../lib/supabase';
import type { Client } from '../types/client';

// ─── CSV Import ───────────────────────────────────────────────────────────────

interface CsvRow {
	name: string;
	email: string;
	phone: string;
	address_street: string;
	address_city: string;
	address_zip: string;
	company_name: string;
	notes: string;
	_raw: string;
	_error?: string;
}

interface MergeCandidate {
	incoming: CsvRow;
	existing: Client;
}

function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			inQuotes = !inQuotes;
		} else if (ch === ',' && !inQuotes) {
			result.push(current.trim());
			current = '';
		} else {
			current += ch;
		}
	}
	result.push(current.trim());
	return result;
}

function parseCsv(text: string): { rows: CsvRow[]; headerError?: string } {
	const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
	if (lines.length < 2)
		return {
			rows: [],
			headerError: 'CSV must have a header row and at least one data row.',
		};

	const headers = parseCsvLine(lines[0]).map((h) =>
		h.toLowerCase().replace(/\s+/g, '_')
	);
	const nameIdx = headers.indexOf('name');
	const emailIdx = headers.indexOf('email');
	const phoneIdx = headers.indexOf('phone');
	const streetIdx = headers.indexOf('address_street');
	const cityIdx = headers.indexOf('address_city');
	const zipIdx = headers.indexOf('address_zip');
	const companyIdx = headers.indexOf('company_name');
	const notesIdx = headers.indexOf('notes');

	const rows: CsvRow[] = [];
	for (let i = 1; i < lines.length; i++) {
		const cols = parseCsvLine(lines[i]);
		const name = nameIdx >= 0 ? (cols[nameIdx] ?? '') : '';
		const email = emailIdx >= 0 ? (cols[emailIdx] ?? '') : '';
		const row: CsvRow = {
			name,
			email,
			phone: phoneIdx >= 0 ? (cols[phoneIdx] ?? '') : '',
			address_street: streetIdx >= 0 ? (cols[streetIdx] ?? '') : '',
			address_city: cityIdx >= 0 ? (cols[cityIdx] ?? '') : '',
			address_zip: zipIdx >= 0 ? (cols[zipIdx] ?? '') : '',
			company_name: companyIdx >= 0 ? (cols[companyIdx] ?? '') : '',
			notes: notesIdx >= 0 ? (cols[notesIdx] ?? '') : '',
			_raw: lines[i],
		};
		if (!name.trim()) row._error = 'Missing name';
		rows.push(row);
	}
	return { rows };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientsPage() {
	const navigate = useNavigate();
	const [clients, setClients] = useState<Client[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');

	const fileInputRef = useRef<HTMLInputElement>(null);
	const [importing, setImporting] = useState(false);
	const [importErrors, setImportErrors] = useState<string[]>([]);
	const [importSuccess, setImportSuccess] = useState<number>(0);
	const [mergeCandidates, setMergeCandidates] = useState<MergeCandidate[]>([]);
	const [pendingRows, setPendingRows] = useState<CsvRow[]>([]);
	const [mergeResolutions, setMergeResolutions] = useState<
		Record<string, 'merge' | 'separate'>
	>({});
	const [showImportResult, setShowImportResult] = useState(false);

	useEffect(() => {
		void fetchClients();
	}, []);

	const fetchClients = async () => {
		setLoading(true);
		const { data } = await supabase
			.from('clients')
			.select('*')
			.order('name', { ascending: true });
		setClients(data ?? []);
		setLoading(false);
	};

	const filtered = clients.filter(
		(c) =>
			c.name.toLowerCase().includes(search.toLowerCase()) ||
			(c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
			(c.phone ?? '').toLowerCase().includes(search.toLowerCase()) ||
			(c.company_name ?? '').toLowerCase().includes(search.toLowerCase())
	);

	// ── CSV import flow ──────────────────────────────────────────────────────────

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const text = await file.text();
		e.target.value = '';

		const { rows, headerError } = parseCsv(text);
		if (headerError) {
			alert(headerError);
			return;
		}

		const validRows = rows.filter((r) => !r._error);
		const errorRows = rows.filter((r) => r._error);

		const emailsToCheck = validRows
			.filter((r) => r.email.trim())
			.map((r) => r.email.trim().toLowerCase());
		const existingByEmail: Record<string, Client> = {};
		if (emailsToCheck.length > 0) {
			const { data } = await supabase
				.from('clients')
				.select('*')
				.in('email', emailsToCheck);
			(data ?? []).forEach((c: Client) => {
				existingByEmail[c.email!.toLowerCase()] = c;
			});
		}

		const clean: CsvRow[] = [];
		const merges: MergeCandidate[] = [];
		for (const row of validRows) {
			const key = row.email.trim().toLowerCase();
			if (key && existingByEmail[key]) {
				merges.push({ incoming: row, existing: existingByEmail[key] });
			} else {
				clean.push(row);
			}
		}

		const initialErrors = errorRows.map(
			(r) => `Row skipped (${r._error}): ${r._raw}`
		);

		if (merges.length > 0) {
			setMergeCandidates(merges);
			setPendingRows(clean);
			setImportErrors(initialErrors);
			setMergeResolutions({});
			return;
		}

		await runImport(clean, [], {}, initialErrors);
	};

	const handleMergeResolve = (email: string, choice: 'merge' | 'separate') => {
		setMergeResolutions((prev) => ({ ...prev, [email]: choice }));
	};

	const allResolved = mergeCandidates.every(
		(mc) => mergeResolutions[mc.incoming.email.trim().toLowerCase()]
	);

	const handleMergeConfirm = async () => {
		if (!allResolved) return;
		await runImport(
			pendingRows,
			mergeCandidates,
			mergeResolutions,
			importErrors
		);
		setMergeCandidates([]);
	};

	const runImport = async (
		cleanRows: CsvRow[],
		merges: MergeCandidate[],
		resolutions: Record<string, 'merge' | 'separate'>,
		existingErrors: string[]
	) => {
		setImporting(true);
		const errors = [...existingErrors];
		let successCount = 0;

		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			setImporting(false);
			return;
		}

		for (const row of cleanRows) {
			const { error } = await supabase.from('clients').insert({
				contractor_id: user.id,
				name: row.name,
				email: row.email || null,
				phone: row.phone || null,
				address_street: row.address_street || null,
				address_city: row.address_city || null,
				address_zip: row.address_zip || null,
				company_name: row.company_name || null,
				notes: row.notes || null,
			});
			if (error) {
				errors.push(`Failed to import "${row.name}": ${error.message}`);
			} else {
				successCount++;
			}
		}

		for (const mc of merges) {
			const key = mc.incoming.email.trim().toLowerCase();
			const resolution = resolutions[key];
			if (resolution === 'merge') {
				const updates: Partial<Client> = {};
				if (mc.incoming.phone) updates.phone = mc.incoming.phone;
				if (mc.incoming.address_street)
					updates.address_street = mc.incoming.address_street;
				if (mc.incoming.address_city)
					updates.address_city = mc.incoming.address_city;
				if (mc.incoming.address_zip)
					updates.address_zip = mc.incoming.address_zip;
				if (mc.incoming.company_name)
					updates.company_name = mc.incoming.company_name;
				if (mc.incoming.notes) updates.notes = mc.incoming.notes;
				const { error } = await supabase
					.from('clients')
					.update(updates)
					.eq('id', mc.existing.id);
				if (error) {
					errors.push(
						`Merge failed for "${mc.incoming.name}": ${error.message}`
					);
				} else {
					successCount++;
				}
			} else {
				const { error } = await supabase.from('clients').insert({
					contractor_id: user.id,
					name: mc.incoming.name,
					email: mc.incoming.email || null,
					phone: mc.incoming.phone || null,
					address_street: mc.incoming.address_street || null,
					address_city: mc.incoming.address_city || null,
					address_zip: mc.incoming.address_zip || null,
					company_name: mc.incoming.company_name || null,
					notes: mc.incoming.notes || null,
				});
				if (error) {
					errors.push(
						`Failed to import "${mc.incoming.name}": ${error.message}`
					);
				} else {
					successCount++;
				}
			}
		}

		setImportErrors(errors);
		setImportSuccess(successCount);
		setShowImportResult(true);
		setImporting(false);
		await fetchClients();
	};

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<SharedLayout>
			<div
				style={{
					maxWidth: '48rem',
					margin: '0 auto',
					padding: '32px 20px 48px',
				}}
			>
				{/* ── Header ── */}
				<div
					className="flex items-start justify-between gap-4"
					style={{ marginBottom: '24px' }}
				>
					<div>
						<h1
							className="text-4xl font-black tracking-tight"
							style={{
								fontFamily: 'var(--font-display)',
								color: 'var(--color-ink)',
							}}
						>
							Clients
						</h1>
						<p className="text-sm mt-1" style={{ color: 'var(--color-slate)' }}>
							Client records, contact details, and import tools.
						</p>
					</div>

					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						disabled={importing}
						className="flex items-center gap-2 flex-shrink-0"
						style={{
							padding: '9px 16px',
							border: '1px solid var(--color-border)',
							borderRadius: 'var(--radius-md)',
							background: 'transparent',
							color: 'var(--color-slate)',
							fontFamily: 'var(--font-body)',
							fontSize: '0.875rem',
							fontWeight: 600,
							cursor: importing ? 'not-allowed' : 'pointer',
							opacity: importing ? 0.5 : 1,
							minHeight: '44px',
							transition:
								'background 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out',
						}}
						onMouseEnter={(e) => {
							if (!importing) {
								const b = e.currentTarget;
								b.style.background = 'var(--color-surface)';
								b.style.color = 'var(--color-ink)';
								b.style.borderColor = 'var(--color-slate)';
							}
						}}
						onMouseLeave={(e) => {
							const b = e.currentTarget;
							b.style.background = 'transparent';
							b.style.color = 'var(--color-slate)';
							b.style.borderColor = 'var(--color-border)';
						}}
					>
						<Upload size={15} strokeWidth={2} />
						{importing ? 'Importing…' : 'Import CSV'}
					</button>

					<input
						ref={fileInputRef}
						type="file"
						accept=".csv,text/csv"
						className="hidden"
						onChange={(e) => void handleFileSelect(e)}
					/>
				</div>

				{/* ── Search ── */}
				<div style={{ position: 'relative', marginBottom: '20px' }}>
					<Search
						size={16}
						strokeWidth={2}
						style={{
							position: 'absolute',
							left: '14px',
							top: '50%',
							transform: 'translateY(-50%)',
							color: 'var(--color-slate)',
							pointerEvents: 'none',
						}}
					/>
					<input
						type="text"
						placeholder="Search by name, email, or phone"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						style={{
							width: '100%',
							paddingLeft: '42px',
							paddingRight: search ? '40px' : '14px',
							paddingTop: '11px',
							paddingBottom: '11px',
							background: 'var(--color-card)',
							border: '1px solid var(--color-border)',
							borderRadius: 'var(--radius-md)',
							fontFamily: 'var(--font-body)',
							fontSize: '0.9375rem',
							color: 'var(--color-ink)',
							outline: 'none',
							minHeight: '44px',
							boxSizing: 'border-box',
							transition: 'border-color 150ms ease-out',
						}}
						onFocus={(e) => {
							e.currentTarget.style.borderColor = 'var(--color-primary)';
						}}
						onBlur={(e) => {
							e.currentTarget.style.borderColor = 'var(--color-border)';
						}}
					/>
					{search && (
						<button
							type="button"
							onClick={() => setSearch('')}
							style={{
								position: 'absolute',
								right: '12px',
								top: '50%',
								transform: 'translateY(-50%)',
								background: 'none',
								border: 'none',
								cursor: 'pointer',
								color: 'var(--color-slate)',
								padding: '4px',
								display: 'flex',
								alignItems: 'center',
							}}
							aria-label="Clear search"
						>
							<X size={14} strokeWidth={2} />
						</button>
					)}
				</div>

				{/* ── Import result banner ── */}
				{showImportResult && (
					<div
						className="flex items-start gap-3"
						style={{
							marginBottom: '20px',
							padding: '14px 16px',
							borderRadius: 'var(--radius-lg)',
							border:
								importErrors.length > 0
									? '1px solid rgba(201,64,64,0.3)'
									: '1px solid rgba(61,158,106,0.3)',
							background:
								importErrors.length > 0
									? 'rgba(201,64,64,0.05)'
									: 'rgba(61,158,106,0.05)',
						}}
					>
						{importErrors.length > 0 ? (
							<AlertCircle
								size={16}
								style={{
									color: 'var(--color-destructive)',
									flexShrink: 0,
									marginTop: '1px',
								}}
							/>
						) : (
							<CheckCircle2
								size={16}
								style={{
									color: 'var(--color-success)',
									flexShrink: 0,
									marginTop: '1px',
								}}
							/>
						)}
						<div style={{ flex: 1 }}>
							<p
								style={{
									margin: 0,
									fontFamily: 'var(--font-body)',
									fontSize: '0.875rem',
									fontWeight: 600,
									color: 'var(--color-ink)',
								}}
							>
								{importSuccess} record{importSuccess !== 1 ? 's' : ''} imported.
							</p>
							{importErrors.length > 0 && (
								<ul
									style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}
								>
									{importErrors.map((err, i) => (
										<li
											key={i}
											style={{
												fontFamily: 'var(--font-body)',
												fontSize: '0.75rem',
												color: 'var(--color-destructive)',
												marginBottom: '3px',
											}}
										>
											{err}
										</li>
									))}
								</ul>
							)}
						</div>
						<button
							type="button"
							onClick={() => setShowImportResult(false)}
							style={{
								background: 'none',
								border: 'none',
								cursor: 'pointer',
								color: 'var(--color-slate)',
								padding: '2px',
								display: 'flex',
								flexShrink: 0,
							}}
							aria-label="Dismiss"
						>
							<X size={14} strokeWidth={2} />
						</button>
					</div>
				)}

				{/* ── Client list ── */}
				{loading ? (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						{[0, 1, 2].map((i) => (
							<div
								key={i}
								className="animate-pulse"
								style={{
									padding: '16px',
									background: 'var(--color-card)',
									border: '1px solid var(--color-border)',
									borderRadius: 'var(--radius-lg)',
								}}
							>
								<div
									style={{
										height: '14px',
										background: 'var(--color-surface)',
										borderRadius: '3px',
										width: `${30 + i * 10}%`,
										marginBottom: '8px',
									}}
								/>
								<div
									style={{
										height: '12px',
										background: 'var(--color-surface)',
										borderRadius: '3px',
										width: `${45 + i * 8}%`,
									}}
								/>
							</div>
						))}
					</div>
				) : filtered.length === 0 ? (
					<div
						style={{
							textAlign: 'center',
							padding: '56px 24px',
							background: 'var(--color-card)',
							border: '1px solid var(--color-border)',
							borderRadius: 'var(--radius-xl)',
						}}
					>
						<Users
							size={36}
							strokeWidth={1.5}
							style={{
								color: 'var(--color-border)',
								margin: '0 auto 16px',
								display: 'block',
							}}
						/>
						<h3
							style={{
								fontFamily: 'var(--font-display)',
								fontWeight: 600,
								fontSize: '1.125rem',
								color: 'var(--color-ink)',
								margin: '0 0 8px',
								letterSpacing: '-0.01em',
							}}
						>
							{search ? `No matches for "${search}"` : 'No clients yet'}
						</h3>
						<p
							style={{
								fontFamily: 'var(--font-body)',
								fontSize: '0.875rem',
								color: 'var(--color-slate)',
								margin: '0 auto',
								maxWidth: '34ch',
								lineHeight: 1.55,
							}}
						>
							{search
								? 'Try a different name, email, or phone number.'
								: 'Import from Jobber or Housecall Pro, or clients appear automatically when you create a job.'}
						</p>
						{!search && (
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								className="flex items-center gap-2 mx-auto"
								style={{
									marginTop: '20px',
									padding: '10px 20px',
									background: 'var(--color-accent)',
									color: '#fff',
									border: 'none',
									borderRadius: 'var(--radius-md)',
									fontFamily: 'var(--font-body)',
									fontSize: '0.875rem',
									fontWeight: 600,
									cursor: 'pointer',
									minHeight: '44px',
									transition: 'background 150ms ease-out',
								}}
								onMouseEnter={(e) =>
									(e.currentTarget.style.background = '#b85d08')
								}
								onMouseLeave={(e) =>
									(e.currentTarget.style.background = 'var(--color-accent)')
								}
							>
								<Upload size={15} strokeWidth={2} />
								Import CSV
							</button>
						)}
					</div>
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
						{filtered.map((client) => (
							<button
								key={client.id}
								type="button"
								onClick={() => navigate(`/clients/${client.id}`)}
								className="flex items-center gap-3 w-full text-left"
								style={{
									padding: '14px 16px',
									background: 'var(--color-card)',
									border: '1px solid var(--color-border)',
									borderRadius: 'var(--radius-lg)',
									cursor: 'pointer',
									minHeight: '44px',
									transition: 'border-color 150ms ease-out',
								}}
								onMouseEnter={(e) =>
									(e.currentTarget.style.borderColor = 'var(--color-primary)')
								}
								onMouseLeave={(e) =>
									(e.currentTarget.style.borderColor = 'var(--color-border)')
								}
							>
								<div style={{ flex: 1, minWidth: 0 }}>
									<div
										className="flex items-center flex-wrap gap-2"
										style={{ marginBottom: '4px' }}
									>
										<span
											style={{
												fontFamily: 'var(--font-body)',
												fontWeight: 600,
												fontSize: '0.9375rem',
												color: 'var(--color-ink)',
											}}
										>
											{client.name}
										</span>
										{client.company_name && (
											<span
												style={{
													fontSize: '0.6875rem',
													fontWeight: 600,
													color: 'var(--color-slate)',
													background: 'var(--color-surface)',
													border: '1px solid var(--color-border)',
													borderRadius: 'var(--radius-sm)',
													padding: '2px 7px',
													letterSpacing: '0.01em',
													lineHeight: 1.4,
												}}
											>
												{client.company_name}
											</span>
										)}
									</div>
									<div className="flex flex-wrap gap-4">
										{client.email && (
											<span
												style={{
													fontFamily: 'var(--font-body)',
													fontSize: '0.8125rem',
													color: 'var(--color-slate)',
												}}
											>
												{client.email}
											</span>
										)}
										{client.phone && (
											<span
												style={{
													fontFamily: 'var(--font-body)',
													fontSize: '0.8125rem',
													color: 'var(--color-slate)',
												}}
											>
												{client.phone}
											</span>
										)}
									</div>
								</div>
								<ChevronRight
									size={16}
									strokeWidth={2}
									style={{ color: 'var(--color-border)', flexShrink: 0 }}
								/>
							</button>
						))}
					</div>
				)}
			</div>

			{/* ── Merge dialog ── */}
			{mergeCandidates.length > 0 && (
				<div
					className="fixed inset-0 z-[100] flex items-center justify-center px-4"
					style={{ background: 'rgba(31,61,44,0.75)' }}
					role="dialog"
					aria-modal="true"
					aria-labelledby="merge-dialog-title"
				>
					<div
						className="w-full max-w-lg overflow-hidden rounded-xl max-h-[80vh] flex flex-col"
						style={{
							background: 'var(--color-card)',
							border: '1px solid var(--color-border)',
							boxShadow: 'var(--shadow-modal)',
						}}
					>
						<div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
							<h2
								id="merge-dialog-title"
								style={{
									fontFamily: 'var(--font-display)',
									fontSize: '1.125rem',
									fontWeight: 600,
									color: 'var(--color-ink)',
									margin: '0 0 6px',
									letterSpacing: '-0.01em',
								}}
							>
								Duplicate email detected
							</h2>
							<p
								style={{
									fontFamily: 'var(--font-body)',
									fontSize: '0.875rem',
									color: 'var(--color-slate)',
									margin: '0 0 20px',
								}}
							>
								{mergeCandidates.length} incoming record
								{mergeCandidates.length !== 1 ? 's' : ''} match
								{mergeCandidates.length === 1 ? 'es' : ''} an existing client by
								email. Choose how to handle each.
							</p>

							<div
								style={{
									display: 'flex',
									flexDirection: 'column',
									gap: '10px',
								}}
							>
								{mergeCandidates.map((mc) => {
									const key = mc.incoming.email.trim().toLowerCase();
									const resolution = mergeResolutions[key];
									return (
										<div
											key={key}
											style={{
												padding: '14px',
												border: '1px solid var(--color-border)',
												borderRadius: 'var(--radius-lg)',
												background: 'var(--color-surface)',
											}}
										>
											<p
												style={{
													margin: '0 0 2px',
													fontFamily: 'var(--font-body)',
													fontSize: '0.875rem',
													fontWeight: 600,
													color: 'var(--color-ink)',
												}}
											>
												{mc.incoming.name}
											</p>
											<p
												style={{
													margin: '0 0 12px',
													fontFamily: 'var(--font-body)',
													fontSize: '0.8125rem',
													color: 'var(--color-slate)',
												}}
											>
												{mc.incoming.email} · existing:{' '}
												<strong
													style={{ color: 'var(--color-ink)', fontWeight: 600 }}
												>
													{mc.existing.name}
												</strong>
											</p>
											<div className="flex gap-2">
												{(['merge', 'separate'] as const).map((choice) => (
													<button
														key={choice}
														type="button"
														onClick={() => handleMergeResolve(key, choice)}
														style={{
															flex: 1,
															padding: '9px 12px',
															borderRadius: 'var(--radius-md)',
															border:
																resolution === choice
																	? 'none'
																	: '1px solid var(--color-border)',
															background:
																resolution === choice
																	? 'var(--color-primary)'
																	: 'var(--color-card)',
															color:
																resolution === choice
																	? '#fff'
																	: 'var(--color-ink)',
															fontFamily: 'var(--font-body)',
															fontSize: '0.8125rem',
															fontWeight: 600,
															cursor: 'pointer',
															minHeight: '44px',
															transition:
																'background 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out',
														}}
													>
														{choice === 'merge'
															? 'Merge into existing'
															: 'Keep separate'}
													</button>
												))}
											</div>
										</div>
									);
								})}
							</div>
						</div>

						<div
							className="flex gap-2"
							style={{
								padding: '16px 24px',
								borderTop: '1px solid var(--color-border)',
							}}
						>
							<button
								type="button"
								onClick={() => {
									setMergeCandidates([]);
									setPendingRows([]);
									setMergeResolutions({});
								}}
								style={{
									flex: 1,
									padding: '11px',
									borderRadius: 'var(--radius-md)',
									border: '1px solid var(--color-border)',
									background: 'transparent',
									color: 'var(--color-slate)',
									fontFamily: 'var(--font-body)',
									fontSize: '0.875rem',
									fontWeight: 600,
									cursor: 'pointer',
									minHeight: '44px',
									transition: 'background 150ms ease-out, color 150ms ease-out',
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = 'var(--color-surface)';
									e.currentTarget.style.color = 'var(--color-ink)';
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = 'transparent';
									e.currentTarget.style.color = 'var(--color-slate)';
								}}
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => void handleMergeConfirm()}
								disabled={!allResolved || importing}
								style={{
									flex: 1,
									padding: '11px',
									borderRadius: 'var(--radius-md)',
									border: 'none',
									background: 'var(--color-accent)',
									color: '#fff',
									fontFamily: 'var(--font-body)',
									fontSize: '0.875rem',
									fontWeight: 600,
									cursor: !allResolved || importing ? 'not-allowed' : 'pointer',
									opacity: !allResolved || importing ? 0.45 : 1,
									minHeight: '44px',
									transition: 'opacity 150ms ease-out',
								}}
							>
								{importing ? 'Importing…' : 'Continue import'}
							</button>
						</div>
					</div>
				</div>
			)}
		</SharedLayout>
	);
}
