import React, { useState } from 'react';
import { useEstimatorStore } from '../store/useEstimatorStore';
import { calculateDistance, getMultiplierFromPitch } from '../utils/geometry';
import { getColorForPitch } from '../utils/pitchColors';

const MUTED = 'rgba(255,255,255,0.45)';
const TEXT = '#f7f3ea';
const DARK_BORDER = 'rgba(255,255,255,0.12)';

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
    selectedLineId,
  } = useEstimatorStore();

  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <div className="flex-none w-full flex flex-col">
      {/* Breakdown sheet — slides in above the bar */}
      {showBreakdown && (
        <div
          className="w-full flex flex-col gap-2 px-4 py-3"
          style={{
            background: 'rgba(15,25,40,0.97)',
            borderTop: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {/* $/sq ft input row */}
          <div className="flex items-center gap-3">
            <label className="text-[9px] font-bold uppercase tracking-wider flex-none" style={{ color: MUTED }}>
              Price / Ft
            </label>
            <div
              className="flex items-center rounded-lg px-2"
              style={{ border: `1px solid ${DARK_BORDER}`, background: 'rgba(255,255,255,0.06)' }}
            >
              <span className="text-xs" style={{ color: MUTED }}>$</span>
              <input
                type="number"
                value={pricePerFt}
                onChange={(e) => setPricePerFt(parseFloat(e.target.value) || 0)}
                className="w-16 py-1 text-right text-sm focus:outline-none bg-transparent"
                style={{ color: TEXT, fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <label className="text-[9px] font-bold uppercase tracking-wider flex-none ml-2" style={{ color: MUTED }}>
              Controller
            </label>
            <button
              type="button"
              onClick={toggleController}
              title={`Controller Fee: $${controllerFee}`}
              className="flex h-[26px] w-9 items-center justify-center rounded-lg border transition-all"
              style={
                includeController
                  ? { borderColor: 'var(--color-success)', background: 'var(--color-success)', color: '#fff' }
                  : { borderColor: DARK_BORDER, background: 'rgba(255,255,255,0.06)', color: MUTED }
              }
            >
              <div
                className="h-2 w-2 rounded-full transition-all duration-300"
                style={{ background: includeController ? '#fff' : 'rgba(255,255,255,0.35)' }}
              />
            </button>
          </div>

          {/* Line item breakdown */}
          <div className="overflow-y-auto max-h-40">
            {lines.length === 0 ? (
              <p className="text-xs italic text-center py-2" style={{ color: MUTED }}>No lines drawn yet.</p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-[10px] uppercase font-bold tracking-wide" style={{ color: MUTED }}>
                    <th className="pb-1">Type</th>
                    <th className="pb-1 text-center">Pitch</th>
                    <th className="pb-1 text-right">Length</th>
                    <th className="pb-1 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
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
                        className="cursor-pointer transition-colors"
                        style={{
                          borderBottom: `1px solid ${DARK_BORDER}`,
                          background: isSelected ? 'rgba(58,99,73,0.15)' : 'transparent',
                        }}
                      >
                        <td className="py-1 pr-2 capitalize font-medium" style={{ color: TEXT }}>{line.type}</td>
                        <td className="py-1 px-2 text-center">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                            style={{ backgroundColor: pitchColor }}
                          >
                            {line.pitch}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-right" style={{ color: MUTED, fontFamily: 'var(--font-mono)' }}>
                          {len3D.toFixed(1)} ft
                        </td>
                        <td className="py-1 pl-2 text-right font-medium" style={{ color: TEXT, fontFamily: 'var(--font-mono)' }}>
                          ${cost.toFixed(0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Subtotals */}
          <div className="flex flex-col gap-0.5 pt-1" style={{ borderTop: `1px solid ${DARK_BORDER}` }}>
            <div className="flex justify-between text-xs" style={{ color: MUTED }}>
              <span>Lines Cost:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                ${(estimatedCost - (includeController ? controllerFee : 0)).toLocaleString()}
              </span>
            </div>
            {includeController && (
              <div className="flex justify-between text-xs" style={{ color: MUTED }}>
                <span>Controller Fee:</span>
                <span style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>+${controllerFee}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pinned bottom bar */}
      <div
        className="w-full flex items-center justify-between px-4 pt-2.5"
        style={{
          background: 'rgba(15,25,40,0.94)',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
          paddingBottom: 'env(safe-area-inset-bottom, 10px)',
        }}
      >
        {/* Left: total */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>Total</span>
          <span className="text-xl font-black" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
            ${estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>

        {/* Center: length */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>Length</span>
          <span className="text-sm font-semibold" style={{ color: TEXT, fontFamily: 'var(--font-mono)' }}>
            {totalLength3D.toFixed(0)} ft
          </span>
        </div>

        {/* Right: breakdown toggle */}
        <button
          type="button"
          onClick={() => setShowBreakdown(v => !v)}
          className="text-xs rounded-lg px-3 py-1.5 transition-colors"
          style={{ color: 'rgba(255,255,255,0.6)', border: `1px solid ${DARK_BORDER}` }}
        >
          {showBreakdown ? '▴ Hide' : '▾ Breakdown'}
        </button>
      </div>
    </div>
  );
};

export default PricingPanel;
