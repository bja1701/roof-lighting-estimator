import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { List, X, ChevronLeft } from 'lucide-react';
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
  dockRef: React.RefObject<HTMLDivElement | null>;
}

const DARK = 'rgba(15,25,40,0.92)';
const DARK_BORDER = 'rgba(255,255,255,0.12)';
const MUTED = 'rgba(255,255,255,0.45)';
const TEXT = '#f7f3ea';

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
      {/* Floating pricing bar */}
      <div
        ref={panelRef}
        className="fixed z-[60] max-w-[calc(100vw-16px)]"
        style={{ left: pos.x, top: pos.y }}
      >
        <div
          className="flex items-stretch gap-0 rounded-xl"
          style={{
            background: DARK,
            border: `1px solid ${DARK_BORDER}`,
            boxShadow: '0 20px 40px rgba(0,0,0,0.45)',
          }}
        >
          {/* Drag handle */}
          <button
            type="button"
            onPointerDown={onDragHandleDown}
            className="flex flex-col items-center justify-center px-2 py-2 rounded-l-[11px] touch-none select-none shrink-0 transition-colors"
            style={{ borderRight: `1px solid ${DARK_BORDER}`, color: MUTED, cursor: 'grab' }}
            onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
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
            {/* Cost display */}
            <div className="flex flex-col items-end pl-2">
              <div
                className="text-2xl font-black leading-none tracking-tight"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}
              >
                ${estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs font-semibold" style={{ color: MUTED }}>
                {totalLength3D.toFixed(0)} ft
              </div>
            </div>

            <div className="h-10 w-px" style={{ background: DARK_BORDER }} />

            {/* Price / ft input */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                Price / Ft
              </label>
              <div
                className="flex w-20 items-center rounded-lg px-2 transition-colors"
                style={{ border: `1px solid ${DARK_BORDER}`, background: 'rgba(255,255,255,0.06)' }}
              >
                <span className="text-xs" style={{ color: MUTED }}>$</span>
                <input
                  type="number"
                  value={pricePerFt}
                  onChange={(e) => setPricePerFt(parseFloat(e.target.value) || 0)}
                  className="w-full py-1 text-right text-sm focus:outline-none bg-transparent"
                  style={{ color: TEXT, fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            {/* Controller toggle */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                Control
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

            <div className="h-10 w-px" style={{ background: DARK_BORDER }} />

            {/* Breakdown button */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="rounded-lg p-2.5 transition-colors active:scale-95"
              style={{ color: MUTED }}
              onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
              onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
              title="View Breakdown"
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Breakdown drawer */}
      <div
        className={`fixed top-14 left-0 bottom-0 w-[min(100vw,300px)] max-w-full z-[80] flex flex-col transform transition-transform duration-300 ease-out ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'var(--color-card)',
          borderRight: '1px solid var(--color-border)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
        }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full" style={{ background: 'var(--color-accent)' }} />
            <h2
              className="text-sm font-bold uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}
            >
              Breakdown
            </h2>
          </div>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-slate)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-slate)')}
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Line list */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead
              className="sticky top-0 z-10 text-[10px] uppercase font-bold tracking-wide"
              style={{ background: 'var(--color-surface)', color: 'var(--color-slate)' }}
            >
              <tr>
                <th className="p-3" style={{ borderBottom: '1px solid var(--color-border)' }}>Type</th>
                <th className="p-3 text-center" style={{ borderBottom: '1px solid var(--color-border)' }}>Pitch</th>
                <th className="p-3 text-right" style={{ borderBottom: '1px solid var(--color-border)' }}>Cost</th>
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
                    className="transition-colors cursor-pointer"
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      background: isSelected ? 'rgba(58,99,73,0.08)' : undefined,
                      borderLeft: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = ''; }}
                  >
                    <td className="p-3">
                      <div className="font-medium capitalize truncate w-20" style={{ color: 'var(--color-ink)' }}>
                        {line.type}
                      </div>
                      <div className="text-[9px]" style={{ color: 'var(--color-slate)', fontFamily: 'var(--font-mono)' }}>
                        {len3D.toFixed(1)} ft
                      </div>
                    </td>
                    <td className="p-3 text-center align-middle">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm inline-block min-w-[36px]"
                        style={{ backgroundColor: pitchColor }}
                      >
                        {line.pitch}
                      </span>
                    </td>
                    <td className="p-3 text-right font-medium" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}>
                      ${cost.toFixed(0)}
                    </td>
                  </tr>
                );
              })}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-8 text-center italic text-xs" style={{ color: 'var(--color-slate)' }}>
                    No lines drawn yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Drawer footer */}
        <div
          className="p-5 space-y-3 z-20"
          style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}
        >
          <div className="flex justify-between items-center text-xs">
            <span style={{ color: 'var(--color-slate)' }}>Lines Cost:</span>
            <span style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}>
              ${(estimatedCost - (includeController ? controllerFee : 0)).toLocaleString()}
            </span>
          </div>
          {includeController && (
            <div className="flex justify-between items-center text-xs">
              <span style={{ color: 'var(--color-slate)' }}>Controller Fee:</span>
              <span style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
                +${controllerFee}
              </span>
            </div>
          )}
          <div
            className="flex justify-between items-center pt-3 mt-2"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <span
              className="text-sm font-bold uppercase tracking-wide"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}
            >
              Total
            </span>
            <span
              className="text-2xl font-black"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}
            >
              ${estimatedCost.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default PricingPanel;
