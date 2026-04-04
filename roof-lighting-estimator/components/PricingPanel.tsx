
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
      <div className="absolute bottom-6 right-4 z-[60]">
        <div className="glass-panel border border-white/30 rounded-xl shadow-[0px_20px_40px_rgba(17,28,45,0.12)] flex items-center p-3 gap-4 transition-all hover:scale-[1.02] duration-200">

            {/* Cost Display */}
            <div className="flex flex-col items-end pl-2">
                <div className="text-2xl font-headline font-black text-primary-container leading-none tracking-tight">
                    ${estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <div className="text-xs font-semibold text-on-surface-variant">
                    {totalLength3D.toFixed(0)} ft
                </div>
            </div>

            <div className="w-px h-10 bg-outline-variant/30"></div>

            {/* Price Input */}
            <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase text-on-surface-variant font-bold tracking-wider">Price / Ft</label>
                <div className="flex items-center bg-surface-container-lowest rounded-lg px-2 border border-outline-variant/30 hover:border-primary-container transition-colors w-20">
                    <span className="text-on-surface-variant text-xs">$</span>
                    <input
                        type="number"
                        value={pricePerFt}
                        onChange={(e) => setPricePerFt(parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent text-on-surface text-sm font-body focus:outline-none text-right py-1"
                    />
                </div>
            </div>

            {/* Controller Toggle */}
            <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase text-on-surface-variant font-bold tracking-wider">Control</label>
                <button
                    onClick={toggleController}
                    title={`Controller Fee: $${controllerFee}`}
                    className={`h-[26px] w-9 rounded-lg flex items-center justify-center border transition-all ${
                        includeController
                        ? 'bg-tertiary border-tertiary text-white shadow-sm'
                        : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                    <div className={`w-2 h-2 rounded-full transition-all duration-300 ${includeController ? 'bg-white' : 'bg-outline'}`}></div>
                </button>
            </div>

            <div className="w-px h-10 bg-outline-variant/30"></div>

            {/* Expand / Details Button */}
            <button
                onClick={() => setIsDrawerOpen(true)}
                className="p-2.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors active:scale-95"
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
      <div className={`absolute top-0 left-0 h-full w-[300px] bg-surface-container-lowest border-r border-outline-variant/20 shadow-[0px_20px_40px_rgba(17,28,45,0.08)] z-[70] transform transition-transform duration-300 ease-out flex flex-col ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>

        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-outline-variant/20 bg-surface-container-low">
            <div className="flex items-center gap-2">
                <div className="w-1 h-4 amber-gradient rounded-full"></div>
                <h2 className="text-sm font-headline font-bold text-on-surface uppercase tracking-wider">Breakdown</h2>
            </div>
            <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            </button>
        </div>

        {/* Drawer Content (Scrollable List) */}
        <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low sticky top-0 z-10 text-[10px] uppercase text-on-surface-variant font-bold tracking-wide">
                    <tr>
                        <th className="p-3 border-b border-outline-variant/20">Type</th>
                        <th className="p-3 border-b border-outline-variant/20 text-center">Pitch</th>
                        <th className="p-3 border-b border-outline-variant/20 text-right">Cost</th>
                    </tr>
                </thead>
                <tbody className="text-xs">
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
                                className={`border-b border-outline-variant/10 transition-colors cursor-pointer group ${
                                    isSelected ? 'bg-primary-container/10 border-l-2 border-l-primary-container' : 'hover:bg-surface-container-low border-l-2 border-l-transparent'
                                }`}
                            >
                                <td className="p-3">
                                    <div className="text-on-surface font-medium capitalize truncate w-20 group-hover:text-primary transition-colors">
                                        {line.type}
                                    </div>
                                    <div className="text-[9px] text-on-surface-variant">{len3D.toFixed(1)} ft</div>
                                </td>
                                <td className="p-3 text-center align-middle">
                                    <span
                                        className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm inline-block min-w-[36px]"
                                        style={{ backgroundColor: pitchColor }}
                                    >
                                        {line.pitch}
                                    </span>
                                </td>
                                <td className="p-3 text-right text-on-surface font-medium group-hover:text-primary-container transition-colors">
                                    ${cost.toFixed(0)}
                                </td>
                            </tr>
                        );
                    })}
                    {lines.length === 0 && (
                        <tr>
                            <td colSpan={3} className="p-8 text-center text-on-surface-variant italic text-xs">
                                No lines drawn yet.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* Drawer Footer (Summary) */}
        <div className="p-5 bg-surface-container-low border-t border-outline-variant/20 space-y-3 z-20">
             <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-medium">Lines Cost:</span>
                <span className="text-on-surface font-medium">${(estimatedCost - (includeController ? controllerFee : 0)).toLocaleString()}</span>
             </div>
             {includeController && (
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant font-medium">Controller Fee:</span>
                    <span className="text-tertiary font-medium">+${controllerFee}</span>
                 </div>
             )}
             <div className="flex justify-between items-center pt-3 border-t border-outline-variant/20 mt-2">
                <span className="text-sm font-headline font-bold text-on-surface uppercase tracking-wide">Total</span>
                <span className="text-2xl font-headline font-black text-primary-container">${estimatedCost.toLocaleString()}</span>
             </div>
        </div>

      </div>
    </>
  );
};

export default PricingPanel;
