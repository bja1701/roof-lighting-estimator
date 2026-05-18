
import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { GoogleMap, StreetViewPanorama } from '@react-google-maps/api';
import { useEstimatorStore } from '../store/useEstimatorStore';
import { LatLng } from '../types/index';
import { convertVisualAngleToPitch } from '../utils/geometry';

const containerStyle = {
  width: '100%',
  height: '100%',
};

/**
 * MEMOIZED STREET VIEW COMPONENT
 * Renders the Google Street View Panorama.
 * Memoized to prevent re-initialization during tool interactions.
 */
interface MemoizedStreetViewProps {
  position: LatLng;
}

const MemoizedStreetView = memo(({ position }: MemoizedStreetViewProps) => {
  const [pov, setPov] = useState<{ heading: number; pitch: number }>({ heading: 0, pitch: 10 });

  useEffect(() => {
    const win = window as any;
    if (!win.google || !win.google.maps) return;

    const svService = new win.google.maps.StreetViewService();
    const targetLoc = new win.google.maps.LatLng(position.lat, position.lng);

    svService.getPanorama({ location: targetLoc, radius: 50 }, (data: any, status: any) => {
      if (status === 'OK' && data?.location?.latLng) {
        const carLoc = data.location.latLng;
        const heading = win.google.maps.geometry.spherical.computeHeading(carLoc, targetLoc);
        setPov({ heading, pitch: 10 });
      }
    });
  }, [position]);

  return (
    <GoogleMap mapContainerStyle={containerStyle} center={position} zoom={18}>
      <StreetViewPanorama
        options={{
          position,
          pov,
          visible: true,
          disableDefaultUI: true,
          enableCloseButton: false,
          zoomControl: true,
          panControl: true,
          motionTracking: false,
          motionTrackingControl: false,
        }}
      />
    </GoogleMap>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.position.lat === nextProps.position.lat &&
    prevProps.position.lng === nextProps.position.lng
  );
});

MemoizedStreetView.displayName = 'MemoizedStreetView';

/**
 * X-PROTRACTOR PITCH TOOL
 * Features:
 * - Draggable Pivot (Center)
 * - Two Infinite Lines (Reference & Slope)
 * - Slider Controls for Rotation
 * - Pitch Calculation Logic
 * - Save Pitch to store for line assignment
 */
const VisualPitchTool: React.FC = () => {
  // Store Access
  const streetViewPosition = useEstimatorStore((state) => state.streetViewPosition);
  const savedPitches = useEstimatorStore((state) => state.savedPitches);
  const addSavedPitch = useEstimatorStore((state) => state.addSavedPitch);
  const removeSavedPitch = useEstimatorStore((state) => state.removeSavedPitch);

  // Local State
  const [pivot, setPivot] = useState({ x: 200, y: 200 });
  const [refAngle, setRefAngle] = useState(0);
  const [slopeAngle, setSlopeAngle] = useState(30);
  const [isDraggingPivot, setIsDraggingPivot] = useState(false);

  // Overlay pan offset (dragging the intersection dot pans both lines)
  const [overlayOffset, setOverlayOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{ touchX: number; touchY: number; offsetX: number; offsetY: number } | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);

  // --- Calculation Logic ---
  let diff = Math.abs(slopeAngle - refAngle) % 180;
  if (diff > 90) {
    diff = 180 - diff;
  }
  const calculatedPitch = convertVisualAngleToPitch(diff);

  // --- Mouse Interaction Handlers (pivot repositions within viewport) ---

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPivot(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingPivot || !viewportRef.current) return;

    const rect = viewportRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));

    setPivot({ x, y });
  };

  const handleMouseUp = () => {
    setIsDraggingPivot(false);
  };

  // --- Touch Interaction Handlers (pan the entire overlay) ---

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    dragStartRef.current = {
      touchX: touch.clientX,
      touchY: touch.clientY,
      offsetX: overlayOffset.x,
      offsetY: overlayOffset.y,
    };
  }, [overlayOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragStartRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartRef.current.touchX;
    const dy = touch.clientY - dragStartRef.current.touchY;
    setOverlayOffset({
      x: dragStartRef.current.offsetX + dx,
      y: dragStartRef.current.offsetY + dy,
    });
  }, []);

  const handleTouchEnd = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  const handleSavePitch = () => {
    const rise = parseInt(calculatedPitch.split('/')[0], 10);
    if (!isNaN(rise)) {
      addSavedPitch(rise);
    }
  };

  // --- Geometry Helpers ---

  const getLineCoords = (angleDeg: number) => {
    const length = 3000;
    const rad = angleDeg * (Math.PI / 180);
    const dx = length * Math.cos(rad);
    const dy = length * Math.sin(rad);
    return {
      x1: pivot.x - dx,
      y1: pivot.y - dy,
      x2: pivot.x + dx,
      y2: pivot.y + dy
    };
  };

  const refCoords = getLineCoords(refAngle);
  const slopeCoords = getLineCoords(slopeAngle);

  return (
    <div
      className="flex h-full w-full flex-col select-none border-l border-inverse-on-surface/15 bg-inverse-surface"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
    >

      {/* 1. The Stable Street View Layer */}
      <div
        ref={viewportRef}
        className="relative flex-1 min-h-0 w-full overflow-hidden"
      >
        <MemoizedStreetView position={streetViewPosition} />

        {/* 2. X-PROTRACTOR OVERLAY (SVG) — wrapper div pans via overlayOffset */}
        <div
          className="absolute inset-0 w-full h-full z-10 pointer-events-none"
          style={{ transform: `translate(${overlayOffset.x}px, ${overlayOffset.y}px)` }}
        >
        <svg
          className="w-full h-full pointer-events-none"
          style={{ overflow: 'visible' }}
        >

          {/* Line 1: Reference (Yellow, Dashed) */}
          <line
            x1={refCoords.x1} y1={refCoords.y1}
            x2={refCoords.x2} y2={refCoords.y2}
            stroke="#fbbf24" strokeWidth="2" strokeDasharray="8 4"
            className="drop-shadow-md opacity-80"
          />

          {/* Line 2: Slope (Red, Solid, Thicker) */}
          <line
            x1={slopeCoords.x1} y1={slopeCoords.y1}
            x2={slopeCoords.x2} y2={slopeCoords.y2}
            stroke="#f87171" strokeWidth="4"
            className="drop-shadow-[0_0_5px_rgba(0,0,0,0.8)] opacity-90"
          />

          {/* The Pivot — mouse drag repositions pivot within viewport */}
          <g
            transform={`translate(${pivot.x}, ${pivot.y})`}
            className="cursor-move pointer-events-auto"
            onMouseDown={handleMouseDown}
          >
            <circle r="25" fill="transparent" />
            <circle r="8" fill="white" stroke="#263143" strokeWidth="2" className="shadow-xl" />
            <line x1="-4" y1="0" x2="4" y2="0" stroke="#263143" strokeWidth="1" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="#263143" strokeWidth="1" />
          </g>
        </svg>
        </div>

        {/* Draggable touch target centered at intersection — pans entire overlay */}
        <div
          className="absolute z-20 cursor-move"
          style={{
            // Center the 44×44 hit area on the pivot point (accounting for overlay offset)
            left: pivot.x + overlayOffset.x - 22,
            top: pivot.y + overlayOffset.y - 22,
            width: 44,
            height: 44,
            touchAction: 'none',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* Result Overlay — absolute top-right, stays in street view */}
        <div className="absolute right-4 top-4 z-20 min-w-[140px] rounded-lg border border-inverse-on-surface/20 bg-inverse-surface/95 p-3 text-right shadow-2xl backdrop-blur-md">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-inverse-on-surface/55">Measured Pitch</div>
          <div className="font-mono text-3xl font-bold text-inverse-on-surface">{calculatedPitch}</div>
          <div className="text-sm text-tertiary-fixed-dim">{diff.toFixed(1)}°</div>
        </div>
      </div>

      {/* 3. Controls Area — flex-none, compact, always visible, target ≤200px tall */}
      <div className="relative z-30 flex-none flex flex-col gap-2 border-t border-inverse-on-surface/15 bg-inverse-surface p-2 shadow-[0_-4px_24px_rgba(17,28,45,0.35)]">

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 gap-2">

          {/* Yellow Ref Slider */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-xs font-bold text-yellow-400 uppercase tracking-wide">
              <span>Horizon / Reference</span>
              <span>{refAngle}°</span>
            </div>
            <input
              type="range" min="0" max="180" step="0.5"
              value={refAngle}
              onChange={(e) => setRefAngle(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-inverse-on-surface/25 accent-yellow-400"
            />
          </div>

          {/* Red Slope Slider */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-xs font-bold text-red-400 uppercase tracking-wide">
              <span>Roof Slope</span>
              <span>{slopeAngle}°</span>
            </div>
            <input
              type="range" min="0" max="180" step="0.5"
              value={slopeAngle}
              onChange={(e) => setSlopeAngle(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-inverse-on-surface/25 accent-red-500"
            />
          </div>
        </div>

        <div className="border-t border-inverse-on-surface/15" />

        {/* Save Pitch button */}
        <button
          onClick={handleSavePitch}
          className="w-full rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-all"
        >
          Save {calculatedPitch}
        </button>

        {/* Saved pitches chips */}
        {savedPitches.length > 0 && (
          <div className="flex flex-wrap gap-1.5 overflow-y-auto max-h-20">
            {savedPitches.map((sp) => (
              <div
                key={sp.id}
                className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}
              >
                <span>{sp.rise}/{sp.run}</span>
                <span className="opacity-60">·</span>
                <span className="opacity-70">{sp.label}</span>
                <button
                  onClick={() => removeSavedPitch(sp.id)}
                  className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity leading-none"
                  aria-label={`Remove ${sp.label}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default VisualPitchTool;
