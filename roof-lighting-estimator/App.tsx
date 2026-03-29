
import React, { useEffect } from 'react';
import { useEstimatorStore } from './store/useEstimatorStore';
import { useTrialStore } from './store/useTrialStore';
import MapWrapper from './components/MapWrapper';
import SatelliteCanvas from './components/SatelliteCanvas';
import VisualPitchTool from './components/VisualPitchTool';
import SearchBar from './components/SearchBar';
import PricingPanel from './components/PricingPanel';
import EditorToolbar from './components/EditorToolbar';
import EmailGate from './components/EmailGate';
import TrialExpired from './components/TrialExpired';

const App: React.FC = () => {
  const mode = useEstimatorStore((s) => s.mode);
  const setMode = useEstimatorStore((s) => s.setMode);
  const reset = useEstimatorStore((s) => s.reset);
  const { isGated, isLoading, estimatesUsed, loadSession } = useTrialStore();

  useEffect(() => {
    loadSession();
  }, []);

  const trialExpired = !isLoading && !isGated && estimatesUsed >= 5;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-white font-sans overflow-hidden">

      {/* Trial Gate — shown while loading or when no email captured */}
      {(isLoading || isGated) && <EmailGate />}

      {/* Trial Expired — shown after 5 estimates */}
      {trialExpired && <TrialExpired />}

      {/*
         MapWrapper provides the Google Maps API context.
      */}
      <MapWrapper>
        
        {/* Top Bar (Header) */}
        <header className="h-14 flex-none bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 z-50 shadow-md relative">
          {/* Logo */}
          <div className="flex items-center gap-3 w-[220px] flex-none">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-teal-400 rounded shadow-lg shadow-blue-500/20 flex-none"></div>
            <h1 className="hidden md:block text-sm font-bold bg-gradient-to-r from-blue-100 to-teal-100 bg-clip-text text-transparent whitespace-nowrap tracking-wide">
              Roof Estimator
            </h1>
          </div>

          {/* Search Bar - Centered */}
          <div className="flex-1 flex justify-center px-4 max-w-xl">
             <SearchBar />
          </div>

          {/* Controls - Right */}
          <div className="flex gap-2 w-auto justify-end">
            <div className="hidden md:flex bg-slate-900 p-0.5 rounded-lg border border-slate-700">
              <button
                onClick={() => setMode('manual')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  mode === 'manual' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Manual
              </button>
              <button
                onClick={() => setMode('solar')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  mode === 'solar' ? 'bg-amber-900/50 text-amber-200 border border-amber-900' : 'text-slate-400 hover:text-white'
                }`}
              >
                Solar
              </button>
            </div>
            
            <button 
              onClick={reset}
              className="px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-950 rounded border border-red-900/50 transition-colors"
            >
              Clear
            </button>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 flex overflow-hidden relative z-0">
            {/* Split Screen Grid */}
            <div className="w-full h-full flex flex-col lg:flex-row">
                
                {/* 1. Center: Satellite Editor (Flex 1) */}
                {/* Now contains PricingPanel as an overlay */}
                <div className="order-1 flex-1 relative border-r border-slate-800 group min-w-[300px]">
                    <SatelliteCanvas />
                    <EditorToolbar />
                    <PricingPanel />
                </div>

                {/* 2. Right Panel: Visual Tools (Flex 1.8 - Huge Street View) */}
                <div className="order-2 h-[40vh] lg:h-full flex-[1.8] min-w-[300px] z-10 shadow-2xl relative">
                    <VisualPitchTool />
                </div>
            </div>
        </main>

      </MapWrapper>
    </div>
  );
};

export default App;
