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

        {/* Pitch readout */}
        <div
          className="absolute right-4 top-4 z-20 min-w-[140px] rounded-lg p-3 text-right"
          style={{
            background: 'rgba(15,25,40,0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <div className="mb-1 text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Measured Pitch
          </div>
          <div className="text-3xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>
            {calculatedPitch}
          </div>
          <div className="text-sm" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
            {diff.toFixed(1)}°
          </div>
        </div>
      </div>

      {/* Controls area */}
      <div
        className="relative z-30 flex h-auto flex-col gap-4 p-4"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'var(--color-primary-dark)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.35)',
        }}
      >
        <div className="grid grid-cols-1 gap-4">
          {/* Reference slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wide" style={{ color: '#fbbf24' }}>
              <span>Horizon / Reference</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{refAngle}°</span>
            </div>
            <input
              type="range" min="0" max="180" step="0.5"
              value={refAngle}
              onChange={(e) => setRefAngle(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg accent-yellow-400"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            />
          </div>

          {/* Slope slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wide" style={{ color: '#f87171' }}>
              <span>Roof Slope</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{slopeAngle}°</span>
            </div>
            <input
              type="range" min="0" max="180" step="0.5"
              value={slopeAngle}
              onChange={(e) => setSlopeAngle(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg accent-red-500"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            />
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} className="my-1" />

        {/* Apply button */}
        <div className="flex justify-between items-center gap-4">
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {selectedLine ? (
              <span>
                Apply to{' '}
                <span className="font-bold" style={{ color: 'var(--color-accent)' }}>
                  Line {selectedLine.id.slice(0, 4)}
                </span>
              </span>
            ) : (
              <span className="italic" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Select a line on map to apply
              </span>
            )}
          </div>

          <button
            disabled={!selectedLineId}
            onClick={handleApplyPitch}
            className="flex-1 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wide transition-all active:scale-95"
            style={
              selectedLineId
                ? {
                    background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.15)',
                    boxShadow: '0 4px 12px rgba(58,99,73,0.4)',
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
