import React, { useState, useEffect, memo, useRef } from 'react';
import { GoogleMap, StreetViewPanorama } from '@react-google-maps/api';
import { useEstimatorStore } from '../store/useEstimatorStore';
import { LatLng } from '../types/index';
import { convertVisualAngleToPitch } from '../utils/geometry';

const containerStyle = { width: '100%', height: '100%' };

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
}, (prevProps, nextProps) => (
  prevProps.position.lat === nextProps.position.lat &&
  prevProps.position.lng === nextProps.position.lng
));

MemoizedStreetView.displayName = 'MemoizedStreetView';

const VisualPitchTool: React.FC = () => {
  const streetViewPosition = useEstimatorStore((state) => state.streetViewPosition);
  const selectedLineId = useEstimatorStore((state) => state.selectedLineId);
  const selectedLine = useEstimatorStore((state) => state.lines.find(l => l.id === selectedLineId));
  const updateLinePitch = useEstimatorStore((state) => state.updateLinePitch);

  const [pivot, setPivot] = useState({ x: 200, y: 200 });
  const [refAngle, setRefAngle] = useState(0);
  const [slopeAngle, setSlopeAngle] = useState(30);
  const [isDraggingPivot, setIsDraggingPivot] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  let diff = Math.abs(slopeAngle - refAngle) % 180;
  if (diff > 90) diff = 180 - diff;
  const calculatedPitch = convertVisualAngleToPitch(diff);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPivot(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingPivot || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    let x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    let y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    setPivot({ x, y });
  };

  const handleMouseUp = () => setIsDraggingPivot(false);

  const handleApplyPitch = () => {
    if (selectedLineId && calculatedPitch) {
      updateLinePitch(selectedLineId, calculatedPitch);
    }
  };

  const getLineCoords = (angleDeg: number) => {
    const length = 3000;
    const rad = angleDeg * (Math.PI / 180);
    const dx = length * Math.cos(rad);
    const dy = length * Math.sin(rad);
    return { x1: pivot.x - dx, y1: pivot.y - dy, x2: pivot.x + dx, y2: pivot.y + dy };
  };

  const refCoords = getLineCoords(refAngle);
  const slopeCoords = getLineCoords(slopeAngle);

  return (
    <div
      className="flex h-full w-full flex-col select-none"
      style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', background: 'var(--color-primary-dark)' }}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      {/* Street View layer */}
      <div ref={viewportRef} className="relative flex-1 w-full overflow-hidden">
        <MemoizedStreetView position={streetViewPosition} />

        {/* X-Protractor overlay */}
        <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none">
          <line
            x1={refCoords.x1} y1={refCoords.y1}
            x2={refCoords.x2} y2={refCoords.y2}
            stroke="#fbbf24" strokeWidth="2" strokeDasharray="8 4"
            className="drop-shadow-md opacity-80"
          />
          <line
            x1={slopeCoords.x1} y1={slopeCoords.y1}
            x2={slopeCoords.x2} y2={slopeCoords.y2}
            stroke="#f87171" strokeWidth="4"
            className="drop-shadow-[0_0_5px_rgba(0,0,0,0.8)] opacity-90"
          />
          <g
            transform={`translate(${pivot.x}, ${pivot.y})`}
            className="cursor-move pointer-events-auto"
            onMouseDown={handleMouseDown}
          >
            <circle r="25" fill="transparent" />
            <circle r="8" fill="white" stroke="#1f3d2c" strokeWidth="2" />
            <line x1="-4" y1="0" x2="4" y2="0" stroke="#1f3d2c" strokeWidth="1" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="#1f3d2c" strokeWidth="1" />
          </g>
        </svg>

      </div>

      {/* Controls area */}
      <div
        className="relative z-30 grid h-auto gap-3 p-3 sm:grid-cols-[116px_minmax(0,1fr)_170px] sm:items-stretch"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'var(--color-primary-dark)',
          boxShadow: '0 -4px 18px rgba(0,0,0,0.28)',
        }}
      >
        <div
          className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 sm:block"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.52)' }}>
            Pitch
          </div>
          <div className="text-2xl font-semibold leading-none sm:mt-1" style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>
            {calculatedPitch}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
            {diff.toFixed(1)}°
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {/* Reference slider */}
          <div className="min-w-0 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.72)' }}>
                <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px]" style={{ background: 'rgba(251,191,36,0.14)', color: '#fbbf24' }}>1</span>
                Horizon
              </span>
              <span className="rounded-md px-1.5 py-0.5 text-[11px]" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>{refAngle}°</span>
            </div>
            <input
              type="range" min="0" max="180" step="0.5"
              value={refAngle}
              onChange={(e) => setRefAngle(parseFloat(e.target.value))}
              className="visual-pitch-slider visual-pitch-slider--reference w-full"
              aria-label="Horizon reference angle"
            />
          </div>

          {/* Slope slider */}
          <div className="min-w-0 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.72)' }}>
                <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px]" style={{ background: 'rgba(248,113,113,0.14)', color: '#f87171' }}>2</span>
                Roof edge
              </span>
              <span className="rounded-md px-1.5 py-0.5 text-[11px]" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', fontFamily: 'var(--font-mono)' }}>{slopeAngle}°</span>
            </div>
            <input
              type="range" min="0" max="180" step="0.5"
              value={slopeAngle}
              onChange={(e) => setSlopeAngle(parseFloat(e.target.value))}
              className="visual-pitch-slider visual-pitch-slider--slope w-full"
              aria-label="Roof slope angle"
            />
          </div>
        </div>

        {/* Apply control */}
        <div className="flex items-center gap-3 rounded-lg px-3 py-2 sm:flex-col sm:items-stretch sm:justify-between" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="min-w-0 flex-1 text-[11px] sm:flex-none" style={{ color: 'rgba(255,255,255,0.56)' }}>
            {selectedLine ? (
              <span className="block truncate">Apply to line <span style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>{selectedLine.id.slice(0, 4)}</span></span>
            ) : (
              <span className="block truncate">Select a map line first</span>
            )}
          </div>

          <button
            disabled={!selectedLineId}
            onClick={handleApplyPitch}
            className="h-9 shrink-0 rounded-lg px-4 text-xs font-bold transition-all active:scale-[0.98]"
            style={
              selectedLineId
                ? {
                    background: 'var(--color-accent)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 2px 8px rgba(217,111,10,0.28)',
                  }
                : {
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.25)',
                    cursor: 'not-allowed',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }
            }
          >
            Apply {calculatedPitch}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VisualPitchTool;
