
import React, { useState, useEffect, memo, useRef } from 'react';
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
 */
const VisualPitchTool: React.FC = () => {
  // Store Access
  const streetViewPosition = useEstimatorStore((state) => state.streetViewPosition);
  const selectedLineId = useEstimatorStore((state) => state.selectedLineId);
  const selectedLine = useEstimatorStore((state) => state.lines.find(l => l.id === selectedLineId));
  const updateLinePitch = useEstimatorStore((state) => state.updateLinePitch);

  // Local State
  const [pivot, setPivot] = useState({ x: 200, y: 200 }); // Pivot screen coordinates
  const [refAngle, setRefAngle] = useState(0);           // Yellow Line (0-180)
  const [slopeAngle, setSlopeAngle] = useState(30);      // Red Line (0-180)
  const [isDraggingPivot, setIsDraggingPivot] = useState(false);
  
  // We attach the ref to the specific viewport div for accurate coordinate calculation
  const viewportRef = useRef<HTMLDivElement>(null);

  // --- Calculation Logic ---
  // Calculate difference
  let diff = Math.abs(slopeAngle - refAngle) % 180;
  // If obtuse (>90), use the supplementary acute angle
  if (diff > 90) {
    diff = 180 - diff;
  }
  const calculatedPitch = convertVisualAngleToPitch(diff);

  // --- Interaction Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop propagation to prevent map drags if any
    setIsDraggingPivot(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingPivot || !viewportRef.current) return;

    const rect = viewportRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    // Constraint logic: Keep pivot inside the viewport
    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));

    setPivot({ x, y });
  };

  const handleMouseUp = () => {
    setIsDraggingPivot(false);
  };

  const handleApplyPitch = () => {
    if (selectedLineId && calculatedPitch) {
      updateLinePitch(selectedLineId, calculatedPitch);
    }
  };

  // --- Geometry Helpers ---
  
  // Calculate endpoints for "Infinite" lines (e.g., 3000px length from pivot)
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
      // We bind mouse move to the root so you can drag slightly outside the visual area without losing grip
      onMouseMove={handleMouseMove} 
    >
      
      {/* 1. The Stable Street View Layer */}
      {/* We attach the REF here to define the coordinate system for the Pivot */}
      <div 
        ref={viewportRef}
        className="relative flex-1 w-full overflow-hidden"
      >
        <MemoizedStreetView position={streetViewPosition} />

        {/* 2. X-PROTRACTOR OVERLAY (SVG) */}
        <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none">
          
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

          {/* The Pivot (Draggable) */}
          <g 
            transform={`translate(${pivot.x}, ${pivot.y})`}
            className="cursor-move pointer-events-auto"
            onMouseDown={handleMouseDown}
          >
             {/* Hit Area (Invisible, larger) */}
             <circle r="25" fill="transparent" />
             
             {/* Visible Circle */}
             <circle r="8" fill="white" stroke="#263143" strokeWidth="2" className="shadow-xl" />
             
             {/* Crosshair Center */}
             <line x1="-4" y1="0" x2="4" y2="0" stroke="#263143" strokeWidth="1" />
             <line x1="0" y1="-4" x2="0" y2="4" stroke="#263143" strokeWidth="1" />
          </g>
        </svg>

        {/* Result Overlay */}
        <div className="absolute right-4 top-4 z-20 min-w-[140px] rounded-lg border border-inverse-on-surface/20 bg-inverse-surface/95 p-3 text-right shadow-2xl backdrop-blur-md">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-inverse-on-surface/55">Measured Pitch</div>
            <div className="font-mono text-3xl font-bold text-inverse-on-surface">{calculatedPitch}</div>
            <div className="text-sm text-tertiary-fixed-dim">{diff.toFixed(1)}°</div>
        </div>
      </div>

      {/* 3. Controls Area (Sliders) */}
      <div className="relative z-30 flex h-auto flex-col gap-4 border-t border-inverse-on-surface/15 bg-inverse-surface p-4 shadow-[0_-4px_24px_rgba(17,28,45,0.35)]">
        
        {/* Sliders Grid */}
        <div className="grid grid-cols-1 gap-4">
            
            {/* Yellow Ref Slider */}
            <div className="flex flex-col gap-1">
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
            <div className="flex flex-col gap-1">
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

        <div className="my-1 border-t border-inverse-on-surface/15" />

        {/* Apply Button */}
        <div className="flex justify-between items-center gap-4">
            <div className="text-xs text-inverse-on-surface/60">
                {selectedLine ? (
                    <span>Apply to <span className="font-bold text-tertiary-fixed-dim">Line {selectedLine.id.slice(0,4)}</span></span>
                ) : (
                    <span className="italic text-inverse-on-surface/40">Select a line on map to apply</span>
                )}
            </div>

            <button
                disabled={!selectedLineId}
                onClick={handleApplyPitch}
                className={`
                    flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wide shadow-md transition-all
                    ${selectedLineId 
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400' 
                        : 'cursor-not-allowed bg-inverse-on-surface/10 text-inverse-on-surface/35'}
                `}
            >
                Apply {calculatedPitch}
            </button>
        </div>

      </div>
    </div>
  );
};

export default VisualPitchTool;
