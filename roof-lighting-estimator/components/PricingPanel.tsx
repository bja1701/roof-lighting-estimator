
import React, { useState } from 'react';
import { useEstimatorStore } from '../store/useEstimatorStore';
import { calculateDistance, getMultiplierFromPitch } from '../utils/geometry';
import { getColorForPitch } from '../utils/pitchColors';

const PricingPanel: React.FC = () => {
  const { 
    lines, 
    nodes, 
    pricePerFt, 
    includeController, 
    controllerFee, 
    totalLength3D, 
    estimatedCost,
    setPricePerFt,
    toggleController,
    selectLine,
    selectedLineId
  } = useEstimatorStore();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      {/* 
         1. COMPACT BAR
         Positioned to straddle the line between Satellite and Street View on large screens.
         lg:right-0 lg:translate-x-1/2 centers the component on the right edge of its parent.
      */}
      <div className="absolute top-4 right-4 lg:top-8 lg:right-0 lg:translate-x-1/2 z-[60]">
        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-600/50 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.6)] flex items-center p-3 gap-4 group transition-all hover:scale-105 duration-200">
            
            {/* Cost Display */}
            <div className="flex flex-col items-end pl-2">
                <div className="text-2xl font-bold text-green-400 font-mono leading-none tracking-tight">
                    ${estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <div className="text-xs font-semibold text-slate-400">
                    {totalLength3D.toFixed(0)} ft
                </div>
            </div>

            <div className="w-px h-10 bg-slate-700/50"></div>

            {/* Price Input */}
            <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase text-slate-500 font-bold tracking-wider">Price / Ft</label>
                <div className="flex items-center bg-slate-950/80 rounded px-2 border border-slate-700/50 hover:border-slate-500 transition-colors w-20 shadow-inner">
                    <span className="text-slate-500 text-xs">$</span>
                    <input 
                        type="number" 
                        value={pricePerFt} 
                        onChange={(e) => setPricePerFt(parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent text-white text-sm font-mono focus:outline-none text-right py-1"
                    />
                </div>
            </div>

            {/* Controller Toggle */}
             <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase text-slate-500 font-bold tracking-wider">Control</label>
                <button 
                    onClick={toggleController}
                    title={`Controller Fee: $${controllerFee}`}
                    className={`h-[26px] w-9 rounded flex items-center justify-center border transition-all ${
                        includeController 
                        ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]' 
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                    }`}
                >
                    <div className={`w-2 h-2 rounded-full transition-all duration-300 ${includeController ? 'bg-white shadow-[0_0_5px_white]' : 'bg-slate-600'}`}></div>
                </button>
            </div>

            <div className="w-px h-10 bg-slate-700/50"></div>

            {/* Expand / Details Button */}
            <button 
                onClick={() => setIsDrawerOpen(true)}
                className="p-2.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors active:scale-95"
                title="View Breakdown"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
            </button>
        </div>
      </div>


      {/* 
         2. SLIDE-OUT DRAWER (Sidebar)
         Full height on the left side.
      */}
      <div className={`absolute top-0 left-0 h-full w-[300px] bg-slate-900 border-r border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-[70] transform transition-transform duration-300 ease-out flex flex-col ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
            <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-green-400 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.5)]"></div>
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Breakdown</h2>
            </div>
            <button 
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            </button>
        </div>

        {/* Drawer Content (Scrollable List) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-900 sticky top-0 z-10 text-[10px] uppercase text-slate-500 font-bold tracking-wide shadow-sm">
                    <tr>
                        <th className="p-3 border-b border-slate-800">Type</th>
                        <th className="p-3 border-b border-slate-800 text-center">Pitch</th>
                        <th className="p-3 border-b border-slate-800 text-right">Cost</th>
                    </tr>
                </thead>
                <tbody className="text-xs font-mono">
                    {lines.map((line) => {
                        const startNode = nodes.find(n => n.id === line.startNodeId);
                        const endNode = nodes.find(n => n.id === line.endNodeId);
                        if (!startNode || !endNode) return null;

                        const len2D = calculateDistance(startNode, endNode);
                        const multiplier = line.type === 'eave' ? 1.0 : getMultiplierFromPitch(line.pitch);
                        const len3D = len2D * multiplier;
                        const cost = len3D * pricePerFt;
                        const pitchColor = getColorForPitch(line.pitch);
                        const isSelected = selectedLineId === line.id;

                        return (
                            <tr 
                                key={line.id} 
                                onClick={() => selectLine(line.id)}
                                className={`border-b border-slate-800/50 transition-colors cursor-pointer group ${
                                    isSelected ? 'bg-blue-900/30 border-l-2 border-l-blue-500' : 'hover:bg-slate-800/30 border-l-2 border-l-transparent'
                                }`}
                            >
                                <td className="p-3">
                                    <div className="text-slate-300 font-medium capitalize truncate w-20 group-hover:text-white transition-colors">
                                        {line.type}
                                    </div>
                                    <div className="text-[9px] text-slate-600">{len3D.toFixed(1)} ft</div>
                                </td>
                                <td className="p-3 text-center align-middle">
                                    <span 
                                        className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm inline-block min-w-[36px]"
                                        style={{ backgroundColor: pitchColor }}
                                    >
                                        {line.pitch}
                                    </span>
                                </td>
                                <td className="p-3 text-right text-slate-300 font-medium group-hover:text-green-400 transition-colors">
                                    ${cost.toFixed(0)}
                                </td>
                            </tr>
                        );
                    })}
                    {lines.length === 0 && (
                        <tr>
                            <td colSpan={3} className="p-8 text-center text-slate-600 italic text-xs">
                                No lines drawn yet.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* Drawer Footer (Summary) */}
        <div className="p-5 bg-slate-950 border-t border-slate-800 space-y-3 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] z-20">
             <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Lines Cost:</span>
                <span className="text-slate-300 font-mono">${(estimatedCost - (includeController ? controllerFee : 0)).toLocaleString()}</span>
             </div>
             {includeController && (
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Controller Fee:</span>
                    <span className="text-blue-400 font-mono">+${controllerFee}</span>
                 </div>
             )}
             <div className="flex justify-between items-center pt-3 border-t border-slate-800 mt-2">
                <span className="text-sm font-bold text-slate-100 uppercase tracking-wide">Total Estimate</span>
                <span className="text-2xl font-bold text-green-400 font-mono shadow-green-500/20 drop-shadow-sm">${estimatedCost.toLocaleString()}</span>
             </div>
        </div>

      </div>
    </>
  );
};

export default PricingPanel;
