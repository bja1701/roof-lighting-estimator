import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const pitchPaneRef = useRef<HTMLDivElement>(null);

  // Load profile pricing into estimator on mount
  useEffect(() => {
    if (profile) {
      loadProfilePricing(profile.price_per_foot, profile.controller_fee, profile.include_controller);
    }
  }, [profile?.id]);

  // Restore canvas state if coming from JobDetailPage
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
    // Navigate to the job if we know which one
    if (savedJobId) {
      navigate(`/jobs/${savedJobId}`);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-surface text-on-surface font-body overflow-hidden">
      <MapWrapper>
        <header className="h-14 flex-none bg-inverse-surface border-b border-inverse-on-surface/15 flex items-center justify-between px-4 z-50 shadow-sm relative">
          <div className="flex items-center gap-3 w-[220px] flex-none min-w-0">
            <button
              onClick={() => navigate('/')}
              className="text-inverse-on-surface/75 hover:text-inverse-on-surface transition-colors p-1 flex items-center gap-1 shrink-0"
              title="Back to Jobs"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
            </button>
            <div className="w-6 h-6 amber-gradient rounded-md shadow-md flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2L1 9l2 1.5V20h18V10.5L23 9 12 2zm0 2.5L20 10v8H4v-8l8-5.5z" />
                <rect x="9" y="14" width="6" height="6" rx="0.5" />
              </svg>
            </div>
            <h1 className="hidden md:block text-sm font-headline font-bold text-inverse-on-surface whitespace-nowrap tracking-tight truncate">
              EaveHQ
            </h1>
          </div>

          <div className="flex-1 flex justify-center px-4 max-w-xl min-w-0">
            <SearchBar />
          </div>

          <div className="flex gap-2 w-auto justify-end items-center shrink-0">
            <button
              onClick={reset}
              className="px-3 py-1 text-xs font-medium text-red-300 hover:bg-red-950/40 rounded-lg transition-colors"
            >
              Clear
            </button>

            <button
              onClick={() => setShowSaveModal(true)}
              disabled={profile?.subscription_tier === 'free' && (profile?.estimates_used ?? 0) >= 5}
              className="px-4 py-1.5 text-xs font-headline font-bold amber-gradient text-white rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Estimate
            </button>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 flex overflow-hidden relative z-0">
          <div className="w-full h-full flex flex-col lg:flex-row">
            <div className="order-1 group relative min-w-[300px] flex-1 border-r border-inverse-on-surface/15">
              <SatelliteCanvas />
              <EditorToolbar />
            </div>
            <div
              ref={pitchPaneRef}
              className="order-2 h-[40vh] lg:h-full flex-[1.8] min-w-[300px] z-10 shadow-2xl relative"
            >
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
