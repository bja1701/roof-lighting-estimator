import { Lock } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const inputStyle: React.CSSProperties = {
	width: '100%',
	paddingLeft: '2.5rem',
	paddingRight: '1rem',
	paddingTop: '0.75rem',
	paddingBottom: '0.75rem',
	background: 'rgba(255,255,255,0.06)',
	border: '1px solid rgba(255,255,255,0.12)',
	borderRadius: 'var(--radius-md)',
	color: '#fff',
	fontSize: '0.875rem',
	caretColor: '#fff',
	outline: 'none',
};

const labelStyle: React.CSSProperties = {
	display: 'block',
	fontSize: '11px',
	fontWeight: 700,
	textTransform: 'uppercase',
	letterSpacing: '0.1em',
	color: 'rgba(255,255,255,0.45)',
	marginBottom: '6px',
};

export default function ResetPasswordPage() {
	const navigate = useNavigate();
	const [password, setPassword] = useState('');
	const [confirm, setConfirm] = useState('');
	const [error, setError] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [done, setDone] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		if (password !== confirm) {
			setError('Passwords do not match.');
			return;
		}
		if (password.length < 6) {
			setError('Password must be at least 6 characters.');
			return;
		}
		setSubmitting(true);
		const { error: err } = await supabase.auth.updateUser({ password });
		setSubmitting(false);
		if (err) {
			setError(err.message);
			return;
		}
		setDone(true);
		setTimeout(() => navigate('/'), 2000);
	};

	return (
		<div
			className="fixed inset-0 flex items-center justify-center z-50 px-4 overflow-hidden"
			style={{
				background: 'var(--color-primary-dark)',
				fontFamily: 'var(--font-body)',
			}}
		>
			<div className="relative z-10 w-full max-w-lg">
				<div className="flex flex-col items-center mb-10">
					<div
						className="w-16 h-16 rounded-xl flex items-center justify-center"
						style={{
							background: 'var(--color-accent)',
							boxShadow: '0 8px 24px rgba(217,111,10,0.35)',
							border: '1px solid rgba(255,255,255,0.15)',
						}}
					>
						<svg
							className="w-9 h-9 text-white"
							fill="currentColor"
							viewBox="0 0 24 24"
							aria-hidden
						>
							<path d="M12 2L1 9l2 1.5V20h18V10.5L23 9 12 2zm0 2.5L20 10v8H4v-8l8-5.5z" />
							<rect x="9" y="14" width="6" height="6" rx="0.5" />
						</svg>
					</div>
					<h1
						className="mt-4 font-extrabold text-3xl tracking-tight text-white"
						style={{ fontFamily: 'var(--font-display)' }}
					>
						New password
					</h1>
					<p
						className="mt-1 text-[10px] uppercase tracking-[0.2em]"
						style={{ color: 'rgba(255,255,255,0.4)' }}
					>
						Choose something secure
					</p>
				</div>

				<div
					className="rounded-xl overflow-hidden"
					style={{
						background: 'rgba(255,255,255,0.04)',
						border: '1px solid rgba(255,255,255,0.08)',
						boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
					}}
				>
					<div className="px-8 py-8">
						{done ? (
							<div className="text-center py-4">
								<p className="font-semibold text-white mb-2">
									Password updated!
								</p>
								<p
									className="text-sm"
									style={{ color: 'rgba(255,255,255,0.5)' }}
								>
									Redirecting you to the app…
								</p>
							</div>
						) : (
							<form onSubmit={handleSubmit} className="space-y-5">
								<div>
									<label style={labelStyle} htmlFor="new-password">
										New Password
									</label>
									<div className="relative">
										<Lock
											size={16}
											className="absolute left-3 top-1/2 -translate-y-1/2"
											style={{ color: 'rgba(255,255,255,0.35)' }}
										/>
										<input
											id="new-password"
											type="password"
											required
											minLength={6}
											value={password}
											onChange={(e) => setPassword(e.target.value)}
											placeholder="••••••••"
											style={inputStyle}
										/>
									</div>
								</div>
								<div>
									<label style={labelStyle} htmlFor="confirm-password">
										Confirm Password
									</label>
									<div className="relative">
										<Lock
											size={16}
											className="absolute left-3 top-1/2 -translate-y-1/2"
											style={{ color: 'rgba(255,255,255,0.35)' }}
										/>
										<input
											id="confirm-password"
											type="password"
											required
											minLength={6}
											value={confirm}
											onChange={(e) => setConfirm(e.target.value)}
											placeholder="••••••••"
											style={inputStyle}
										/>
									</div>
								</div>
								{error && (
									<div
										className="px-4 py-3 rounded-lg"
										style={{
											background: 'rgba(201,64,64,0.15)',
											border: '1px solid rgba(201,64,64,0.3)',
										}}
									>
										<p
											className="text-sm font-medium"
											style={{ color: '#f87171' }}
										>
											{error}
										</p>
									</div>
								)}
								<button
									type="submit"
									disabled={submitting}
									className="w-full font-bold py-4 rounded-lg transition-all active:scale-95"
									style={{
										background: submitting
											? 'rgba(255,255,255,0.1)'
											: 'var(--color-accent)',
										color: submitting ? 'rgba(255,255,255,0.4)' : '#fff',
										cursor: submitting ? 'not-allowed' : 'pointer',
										fontFamily: 'var(--font-display)',
										boxShadow: submitting
											? 'none'
											: '0 4px 14px rgba(217,111,10,0.4)',
									}}
								>
									{submitting ? 'Saving…' : 'Set new password'}
								</button>
							</form>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
