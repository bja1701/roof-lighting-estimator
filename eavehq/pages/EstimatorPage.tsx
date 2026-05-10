import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { useEstimatorStore } from '../store/useEstimatorStore';
import { useProfile } from '../hooks/useProfile';
import MapWrapper from '../components/MapWrapper';
import SatelliteCanvas from '../components/SatelliteCanvas';
import VisualPitchTool from '../components/VisualPitchTool';
import SearchBar from '../components/SearchBar';
import PricingPanel from '../components/PricingPanel';
import EditorToolbar from '../components/EditorToolbar';
import SaveToJobModal from '../components/SaveToJobModal';

const EstimatorPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const reset = useEstimatorStore((s) => s.reset);
  const loadProfilePricing = useEstimatorStore((s) => s.loadProfilePricing);
  const restoreCanvas = useEstimatorStore((s) => s.restoreCanvas);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);
  const [isPitchPanelCollapsed, setIsPitchPanelCollapsed] = useState(false);
  const pitchPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile) {
      loadProfilePricing(profile.price_per_foot, profile.controller_fee, profile.include_controller);
    }
  }, [profile?.id]);

  useEffect(() => {
    const stored = sessionStorage.getItem('restore_quote');
    if (stored) {
      try {
        const { canvasState, jobId } = JSON.parse(stored);
        if (canvasState) restoreCanvas(canvasState);
        if (jobId) setSavedJobId(jobId);
      } catch {}
      sessionStorage.removeItem('restore_quote');
    }
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
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ background: 'var(--color-primary-dark)', color: '#fff', fontFamily: 'var(--font-body)' }}
    >
      <MapWrapper>
        {/* Header */}
        <header
          className="h-14 flex-none flex items-center justify-between px-4 z-50 relative"
          style={{ background: 'var(--color-primary-dark)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center gap-3 flex-none min-w-0 w-[220px]">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors text-sm font-medium"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
              title="Back to Jobs"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:block">Jobs</span>
            </button>

            <div className="flex items-center gap-2 pl-1">
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

          <div className="flex-1 flex justify-center px-4 max-w-xl min-w-0">
            <SearchBar />
          </div>

          <div className="flex gap-2 items-center flex-none">
            <button
              onClick={reset}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
              style={{ color: 'rgba(255,100,100,0.8)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,100,100,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Clear
            </button>

            <button
              onClick={() => setShowSaveModal(true)}
              disabled={saveDisabled}
              className="px-4 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95"
              style={{
                background: saveDisabled ? 'rgba(255,255,255,0.12)' : 'var(--color-accent)',
                color: saveDisabled ? 'rgba(255,255,255,0.35)' : '#fff',
                cursor: saveDisabled ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-display)',
              }}
            >
              Save Estimate
            </button>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 flex overflow-hidden relative z-0">
          <div className="w-full h-full flex flex-col lg:flex-row">
            <div
              className="order-1 group relative min-w-[300px] h-[55vh] lg:h-auto lg:flex-1"
              style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}
            >
              <SatelliteCanvas />
              <EditorToolbar />
            </div>
            <div
              ref={pitchPaneRef}
              className={`order-2 lg:h-full flex-[1.8] min-w-[300px] z-10 relative transition-all duration-200 ${
                isPitchPanelCollapsed ? 'h-10' : 'h-[45vh]'
              } lg:h-full`}
              style={{ boxShadow: '0 0 24px rgba(0,0,0,0.4)' }}
            >
              <button
                className="lg:hidden absolute top-0 right-0 z-20 flex items-center gap-1 px-3 h-10 text-xs font-medium"
                style={{ color: 'rgba(255,255,255,0.6)' }}
                onClick={() => setIsPitchPanelCollapsed((v) => !v)}
                aria-label={isPitchPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
              >
                {isPitchPanelCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <VisualPitchTool />
              <PricingPanel dockRef={pitchPaneRef} />
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
    </div>
  );
};

export default EstimatorPage;
