import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { useEstimatorStore } from '../store/useEstimatorStore';
import { calculateDistance, getMultiplierFromPitch } from '../utils/geometry';
import { getColorForPitch } from '../utils/pitchColors';

const VIEWPORT_PAD = 8;

function clampToViewport(
  x: number,
  y: number,
  panelW: number,
  panelH: number
): { x: number; y: number } {
  const maxX = Math.max(VIEWPORT_PAD, window.innerWidth - panelW - VIEWPORT_PAD);
  const maxY = Math.max(VIEWPORT_PAD, window.innerHeight - panelH - VIEWPORT_PAD);
  return {
    x: Math.min(Math.max(VIEWPORT_PAD, x), maxX),
    y: Math.min(Math.max(VIEWPORT_PAD, y), maxY),
  };
}

interface PricingPanelProps {
  /** Right-hand pane (Street View / pitch tool); used to place the default top-left position. */
  dockRef: React.RefObject<HTMLDivElement | null>;
}

const PricingPanel: React.FC<PricingPanelProps> = ({ dockRef }) => {
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
  const [pos, setPos] = useState({ x: VIEWPORT_PAD, y: VIEWPORT_PAD });
  const panelRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(pos);
  posRef.current = pos;

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const applyDefaultFromDock = useCallback(() => {
    const dock = dockRef.current;
    const el = panelRef.current;
    if (!dock) return;
    const r = dock.getBoundingClientRect();
    const w = el?.offsetWidth ?? 340;
    const h = el?.offsetHeight ?? 76;
    const next = clampToViewport(r.left + 16, r.top + 16, w, h);
    setPos(next);
  }, [dockRef]);

  useLayoutEffect(() => {
    applyDefaultFromDock();
    const id = requestAnimationFrame(() => applyDefaultFromDock());
    return () => cancelAnimationFrame(id);
  }, [applyDefaultFromDock]);

  useEffect(() => {
    const onResize = () => {
      const el = panelRef.current;
      if (!el) return;
      setPos((p) => clampToViewport(p.x, p.y, el.offsetWidth, el.offsetHeight));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const el = panelRef.current;
      const w = el?.offsetWidth ?? 340;
      const h = el?.offsetHeight ?? 76;
      const nx = d.origX + (e.clientX - d.startX);
      const ny = d.origY + (e.clientY - d.startY);
      setPos(clampToViewport(nx, ny, w, h));
    };
    const endDrag = (e: PointerEvent) => {
      const d = dragRef.current;
      if (d && e.pointerId === d.pointerId) dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, []);

  const onDragHandleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: posRef.current.x,
      origY: posRef.current.y,
    };
  };

  return (
    <>
      {/* Floating pricing bar: default top-left of Street View pane; draggable (handle) anywhere on screen */}
      <div
        ref={panelRef}
        className="fixed z-[60] max-w-[calc(100vw-16px)]"
        style={{ left: pos.x, top: pos.y }}
      >
        <div className="flex items-stretch gap-0 rounded-xl border border-inverse-on-surface/20 bg-inverse-surface shadow-[0_20px_40px_rgba(17,28,45,0.4)] transition-shadow duration-200">
          <button
            type="button"
            onPointerDown={onDragHandleDown}
            className="flex flex-col items-center justify-center px-2 py-2 rounded-l-[11px] border-r border-inverse-on-surface/20 text-inverse-on-surface/45 hover:bg-inverse-on-surface/10 hover:text-inverse-on-surface cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
            title="Drag panel"
            aria-label="Drag pricing panel"
          >
            <svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor" aria-hidden className="opacity-80">
              <circle cx="2" cy="3" r="1.25" />
              <circle cx="8" cy="3" r="1.25" />
              <circle cx="2" cy="9" r="1.25" />
              <circle cx="8" cy="9" r="1.25" />
              <circle cx="2" cy="15" r="1.25" />
              <circle cx="8" cy="15" r="1.25" />
            </svg>
          </button>

          <div className="flex items-center p-3 gap-4 min-w-0 flex-1">
            {/* Cost Display */}
            <div className="flex flex-col items-end pl-2">
                <div className="text-2xl font-headline font-black text-amber-300 leading-none tracking-tight">
                    ${estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <div className="text-xs font-semibold text-inverse-on-surface/60">
                    {totalLength3D.toFixed(0)} ft
                </div>
            </div>

            <div className="h-10 w-px bg-inverse-on-surface/20" />

            {/* Price Input */}
            <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-inverse-on-surface/55">Price / Ft</label>
                <div className="flex w-20 items-center rounded-lg border border-inverse-on-surface/25 bg-inverse-on-surface/10 px-2 transition-colors hover:border-inverse-on-surface/35">
                    <span className="text-xs text-inverse-on-surface/55">$</span>
                    <input
                        type="number"
                        value={pricePerFt}
                        onChange={(e) => setPricePerFt(parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent py-1 text-right text-sm font-body text-inverse-on-surface focus:outline-none"
                    />
                </div>
            </div>

            {/* Controller Toggle */}
            <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-inverse-on-surface/55">Control</label>
                <button
                    type="button"
                    onClick={toggleController}
                    title={`Controller Fee: $${controllerFee}`}
                    className={`flex h-[26px] w-9 items-center justify-center rounded-lg border transition-all ${
                        includeController
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                        : 'border-inverse-on-surface/25 bg-inverse-on-surface/10 text-inverse-on-surface/55 hover:border-inverse-on-surface/35 hover:text-inverse-on-surface'
                    }`}
                >
                    <div className={`h-2 w-2 rounded-full transition-all duration-300 ${includeController ? 'bg-white' : 'bg-inverse-on-surface/45'}`}></div>
                </button>
            </div>

            <div className="h-10 w-px bg-inverse-on-surface/20" />

            {/* Expand / Details Button */}
            <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="rounded-lg p-2.5 text-inverse-on-surface/55 transition-colors hover:bg-inverse-on-surface/10 hover:text-inverse-on-surface active:scale-95"
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
      </div>

      {/* Breakdown drawer: fixed below estimator header */}
      <div
        className={`fixed top-14 left-0 bottom-0 w-[min(100vw,300px)] max-w-full bg-surface-container-lowest border-r border-outline-variant/20 shadow-[0px_20px_40px_rgba(17,28,45,0.08)] z-[80] transform transition-transform duration-300 ease-out flex flex-col ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >

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
