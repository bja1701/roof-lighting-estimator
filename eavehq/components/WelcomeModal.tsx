import { FileText, Satellite } from 'lucide-react';
import { useProfile } from '../hooks/useProfile';
import { useUpgradeModal } from '../hooks/useUpgradeModal';

interface Props {
	onClose: () => void;
}

export default function WelcomeModal({ onClose }: Props) {
	const { markWelcomeShown } = useProfile();
	const { open: openUpgrade } = useUpgradeModal();

	const handleClose = async () => {
		await markWelcomeShown();
		onClose();
	};

	return (
		<div
			className="fixed inset-0 flex items-center justify-center z-50 px-4"
			style={{ background: 'rgba(31,61,44,0.75)' }}
		>
			<div
				className="relative w-full max-w-lg rounded-xl overflow-hidden"
				style={{
					background: 'var(--color-card)',
					border: '1px solid var(--color-border)',
					boxShadow: 'var(--shadow-modal)',
				}}
			>
				<div className="p-8 md:p-12 text-center">
					{/* Icon */}
					<div className="mb-6 inline-block">
						<div
							className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
							style={{ background: 'rgba(58,99,73,0.1)' }}
						>
							<span className="text-5xl">🥳</span>
						</div>
					</div>

					<h1
						className="text-4xl font-extrabold tracking-tight mb-2"
						style={{
							fontFamily: 'var(--font-display)',
							color: 'var(--color-ink)',
						}}
					>
						Welcome aboard!
					</h1>
					<p
						className="font-semibold text-lg mb-6"
						style={{ color: 'var(--color-primary)' }}
					>
						You've got 5 free estimates to start.
					</p>

					<p
						className="leading-relaxed text-sm px-2 mb-6"
						style={{ color: 'var(--color-slate)' }}
					>
						Measure any roof directly from satellite imagery with surgical
						precision. Generate accurate, itemized cost estimates and
						professional client proposals in minutes.
					</p>

					{/* Feature chips */}
					<div className="flex justify-center gap-4 mb-10">
						<div
							className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
							style={{ color: 'var(--color-slate)' }}
						>
							<Satellite size={14} />
							Satellite Mapping
						</div>
						<div
							className="w-1 h-1 rounded-full self-center"
							style={{ background: 'var(--color-border)' }}
						/>
						<div
							className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
							style={{ color: 'var(--color-slate)' }}
						>
							<FileText size={14} />
							Pro Proposals
						</div>
					</div>

					<button
						type="button"
						onClick={handleClose}
						className="w-full md:w-auto px-12 py-4 font-bold text-lg rounded-lg transition-all active:scale-95 uppercase tracking-widest"
						style={{
							background: 'var(--color-accent)',
							color: '#fff',
							fontFamily: 'var(--font-display)',
							boxShadow: '0 4px 16px rgba(217,111,10,0.35)',
						}}
					>
						Let's go
					</button>

					<p className="text-xs mt-4" style={{ color: 'var(--color-slate)' }}>
						You have 5 free estimates.{' '}
						<button
							type="button"
							onClick={() => {
								void handleClose();
								openUpgrade();
							}}
							className="underline underline-offset-2 transition-colors"
							style={{ color: 'var(--color-accent)' }}
							onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
							onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
						>
							Upgrade anytime
						</button>{' '}
						for unlimited access.
					</p>
				</div>
			</div>
		</div>
	);
}
