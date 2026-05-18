import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useEstimatorStore } from '../store/useEstimatorStore';
import { useProfile } from '../hooks/useProfile';
import { useCanvasAutosave, readLocalDraft, readLastJobId } from '../hooks/useCanvasAutosave';
import MapWrapper from '../components/MapWrapper';
import SatelliteCanvas from '../components/SatelliteCanvas';
import VisualPitchTool from '../components/VisualPitchTool';
import SearchBar from '../components/SearchBar';
import PricingPanel from '../components/PricingPanel';
import EditorToolbar from '../components/EditorToolbar';
import SaveToJobModal from '../components/SaveToJobModal';
import PitchAssignSheet from '../components/PitchAssignSheet';

const EstimatorPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const reset = useEstimatorStore((s) => s.reset);
  const loadProfilePricing = useEstimatorStore((s) => s.loadProfilePricing);
  const restoreCanvas = useEstimatorStore((s) => s.restoreCanvas);
  const undo = useEstimatorStore((s) => s.undo);
  const redo = useEstimatorStore((s) => s.redo);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  // Mobile: toggle between satellite canvas and pitch/pricing panel.
  // On lg+ both panels are always visible side-by-side.
  const [mobileView, setMobileView] = useState<'satellite' | 'pitch'>('satellite');
  const pitchPaneRef = useRef<HTMLDivElement>(null);
  // pitchPaneRef kept for layout ref; PricingPanel no longer uses dockRef

  const saveStatus = useCanvasAutosave(currentJobId);

  useEffect(() => {
    if (profile) {
      loadProfilePricing(profile.price_per_foot, profile.controller_fee, profile.include_controller);
    }
  }, [profile?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const metaKey = isMac ? e.metaKey : e.ctrlKey;
      if (!metaKey) return;
      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      }
      if (!e.shiftKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    reset();

    // 1. Check sessionStorage (set by JobDetailPage when navigating to estimator)
    const stored = sessionStorage.getItem('restore_quote');
    let jobIdFromSession: string | null = null;
    let canvasStateFromSession: any = null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        jobIdFromSession = parsed.jobId ?? null;
        canvasStateFromSession = parsed.canvasState ?? null;
        if (parsed.jobId) setSavedJobId(parsed.jobId);
      } catch {}
      sessionStorage.removeItem('restore_quote');
    }

    // 2. On page refresh sessionStorage is gone — fall back to the last-used jobId
    //    that the autosave hook wrote to localStorage.
    //    If there's still no jobId (user opened /estimator directly), use 'anonymous'
    //    so autosave still works for in-browser refresh recovery.
    const resolvedJobId = jobIdFromSession ?? readLastJobId() ?? 'anonymous';

    // 3. Restore: localStorage draft first (refresh recovery), session state wins
    const localDraft = readLocalDraft(resolvedJobId);
    if (localDraft) restoreCanvas(localDraft);
    if (canvasStateFromSession) restoreCanvas(canvasStateFromSession);

    setCurrentJobId(resolvedJobId);
  }, []);

  const handleSaved = () => {
    setShowSaveModal(false);
    if (savedJobId) {
      navigate(`/jobs/${savedJobId}`);
    } else {
      navigate('/');
    }
  };

  const saveDisabled = profile?.subscription_status === 'free' && (profile?.estimates_used ?? 0) >= 5;

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden"
      style={{ background: 'var(--color-primary-dark)', color: '#fff', fontFamily: 'var(--font-body)' }}
    >
      <MapWrapper>
        {/* Header — responsive: no overflow at 375px */}
        <header
          className="h-14 flex-none flex items-center justify-between gap-2 px-2 sm:px-4 z-50 relative"
          style={{ background: 'var(--color-primary-dark)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          {/* Left: back + logo */}
          <div className="flex items-center gap-1 sm:gap-3 flex-none">
            <button
              onClick={() => navigate('/')}
              className="flex items-center justify-center gap-1 min-w-[40px] min-h-[40px] px-1.5 sm:px-2 py-1.5 rounded-lg transition-colors text-sm font-medium"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
              title="Back to Jobs"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:block">Jobs</span>
            </button>

            <div className="hidden sm:flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--color-accent)' }}
              >
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 2L1 9l2 1.5V20h18V10.5L23 9 12 2zm0 2.5L20 10v8H4v-8l8-5.5z" />
                  <rect x="9" y="14" width="6" height="6" rx="0.5" />
                </svg>
              </div>
              <span
                className="hidden md:block text-sm font-bold whitespace-nowrap tracking-tight"
                style={{ fontFamily: 'var(--font-display)', color: '#fff' }}
              >
                Estimator
              </span>
            </div>
          </div>

          {/* Center: search */}
          <div className="flex-1 flex justify-center min-w-0 px-1 sm:px-4">
            <SearchBar />
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-1 sm:gap-2 flex-none">
            {currentJobId && saveStatus !== 'idle' && (
              <span
                className="text-xs font-medium px-2 py-1 rounded transition-opacity"
                style={{ color: saveStatus === 'saving' ? 'rgba(255,255,255,0.45)' : 'rgba(100,220,140,0.85)' }}
              >
                {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
              </span>
            )}
            <button
              onClick={reset}
              className="flex items-center justify-center min-w-[40px] min-h-[40px] px-2 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
              style={{ color: 'rgba(255,100,100,0.8)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,100,100,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Clear
            </button>

            <button
              onClick={() => setShowSaveModal(true)}
              disabled={saveDisabled}
              className="flex items-center justify-center min-w-[40px] min-h-[40px] px-2 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95 whitespace-nowrap"
              style={{
                background: saveDisabled ? 'rgba(255,255,255,0.12)' : 'var(--color-accent)',
                color: saveDisabled ? 'rgba(255,255,255,0.35)' : '#fff',
                cursor: saveDisabled ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-display)',
              }}
            >
              {/* Short label on xs, full label on sm+ */}
              <span className="sm:hidden">Save</span>
              <span className="hidden sm:inline">Save Estimate</span>
            </button>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 flex overflow-hidden relative z-0">
          <div className="w-full h-full flex flex-col lg:flex-row">
            {/* Satellite canvas panel */}
            <div
              className={`order-1 group relative min-w-[300px] lg:flex-1 flex flex-col ${
                mobileView === 'pitch' ? 'hidden lg:flex lg:flex-col' : ''
              } h-full lg:h-auto`}
              style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}
            >
              {/* Canvas fills remaining space */}
              <div className="flex-1 min-h-0 relative">
                <SatelliteCanvas />
                <EditorToolbar />
                {/* Mobile toggle button — tap to switch to pitch/pricing panel */}
                <button
                  className="absolute top-2 right-2 z-50 lg:hidden rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm"
                  style={{ background: 'rgba(255,255,255,0.9)', color: '#111', backdropFilter: 'blur(4px)', border: '1px solid rgba(0,0,0,0.12)' }}
                  onClick={() => setMobileView('pitch')}
                >
                  Pitch View
                </button>
              </div>
              {/* Pinned pricing bar — always visible at bottom of satellite panel */}
              <PricingPanel />
            </div>

            {/* Pitch / pricing panel */}
            <div
              ref={pitchPaneRef}
              className={`order-2 flex-[1.8] min-w-[300px] z-10 relative ${
                mobileView === 'satellite' ? 'hidden lg:flex lg:flex-col' : ''
              } h-full lg:h-full`}
              style={{ boxShadow: '0 0 24px rgba(0,0,0,0.4)' }}
            >
              <VisualPitchTool />
              {/* Mobile back button */}
              <button
                className="absolute top-2 left-2 z-50 lg:hidden rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm"
                style={{ background: 'rgba(255,255,255,0.9)', color: '#111', backdropFilter: 'blur(4px)', border: '1px solid rgba(0,0,0,0.12)' }}
                onClick={() => setMobileView('satellite')}
              >
                Satellite
              </button>
            </div>
          </div>
        </main>
      </MapWrapper>

      {showSaveModal && (
        <SaveToJobModal
          onSaved={handleSaved}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      {/* Pitch assign sheet — appears when a line is selected */}
      <PitchAssignSheet onGoToPitchView={() => setMobileView('pitch')} />
    </div>
  );
};

export default EstimatorPage;
