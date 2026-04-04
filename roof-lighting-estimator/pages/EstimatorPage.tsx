import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEstimatorStore } from '../store/useEstimatorStore';
import { useProfile } from '../hooks/useProfile';
import { useAuth } from '../hooks/useAuth';
import MapWrapper from '../components/MapWrapper';
import SatelliteCanvas from '../components/SatelliteCanvas';
import VisualPitchTool from '../components/VisualPitchTool';
import SearchBar from '../components/SearchBar';
import PricingPanel from '../components/PricingPanel';
import EditorToolbar from '../components/EditorToolbar';
import SaveToJobModal from '../components/SaveToJobModal';

const EstimatorPage: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const mode = useEstimatorStore((s) => s.mode);
  const setMode = useEstimatorStore((s) => s.setMode);
  const reset = useEstimatorStore((s) => s.reset);
  const loadProfilePricing = useEstimatorStore((s) => s.loadProfilePricing);
  const restoreCanvas = useEstimatorStore((s) => s.restoreCanvas);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);

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
        {/* Top Bar — Stitch frosted glass style */}
        <header className="h-14 flex-none bg-white/80 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between px-4 z-50 shadow-sm relative">
          {/* Logo + Back */}
          <div className="flex items-center gap-3 w-[220px] flex-none">
            <button
              onClick={() => navigate('/')}
              className="text-on-surface-variant hover:text-on-surface transition-colors p-1 flex items-center gap-1"
              title="Back to Jobs"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
            </button>
            <div className="w-6 h-6 amber-gradient rounded shadow-md flex-none"></div>
            <h1 className="hidden md:block text-sm font-headline font-bold text-on-surface whitespace-nowrap tracking-tight">
              Roof Estimator
            </h1>
          </div>

          {/* Search Bar */}
          <div className="flex-1 flex justify-center px-4 max-w-xl">
            <SearchBar />
          </div>

          {/* Controls */}
          <div className="flex gap-2 w-auto justify-end items-center">
            <div className="hidden md:flex bg-surface-container-low p-0.5 rounded-lg">
              <button
                onClick={() => setMode('manual')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  mode === 'manual' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Manual
              </button>
              <button
                onClick={() => setMode('solar')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  mode === 'solar' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Solar
              </button>
            </div>

            <button
              onClick={reset}
              className="px-3 py-1 text-xs font-medium text-error hover:bg-error-container/30 rounded-lg transition-colors"
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
            <div className="order-1 flex-1 relative border-r border-slate-800 group min-w-[300px]">
              <SatelliteCanvas />
              <EditorToolbar />
              <PricingPanel />
            </div>
            <div className="order-2 h-[40vh] lg:h-full flex-[1.8] min-w-[300px] z-10 shadow-2xl relative">
              <VisualPitchTool />
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
