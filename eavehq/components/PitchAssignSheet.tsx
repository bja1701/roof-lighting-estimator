
import React, { useEffect, useRef } from 'react';
import { useEstimatorStore } from '../store/useEstimatorStore';
import { SavedPitch } from '../types/index';

interface PitchAssignSheetProps {
  /** Called when user taps "Pitch View" to go measure a pitch */
  onGoToPitchView: () => void;
}

const PitchAssignSheet: React.FC<PitchAssignSheetProps> = ({ onGoToPitchView }) => {
  const selectedLineId = useEstimatorStore((s) => s.selectedLineId);
  const lines = useEstimatorStore((s) => s.lines);
  const savedPitches = useEstimatorStore((s) => s.savedPitches);
  const updateLinePitch = useEstimatorStore((s) => s.updateLinePitch);
  const selectLine = useEstimatorStore((s) => s.selectLine);

  const selectedLine = lines.find((l) => l.id === selectedLineId) ?? null;

  // Local selection (pending confirm)
  const [pendingPitch, setPendingPitch] = React.useState<string | null>(null);

  // Sync pending pitch when selected line changes
  useEffect(() => {
    if (selectedLine) {
      setPendingPitch(selectedLine.pitch ?? null);
    }
  }, [selectedLine?.id]);

  const isOpen = selectedLine !== null;

  const handleDone = () => {
    if (selectedLineId && pendingPitch !== null) {
      updateLinePitch(selectedLineId, pendingPitch);
    }
    selectLine(null);
  };

  const handleOverlayClick = () => {
    // Dismiss without applying
    selectLine(null);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Dark overlay */}
      <div
        className="fixed inset-0 z-[60]"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={handleOverlayClick}
      />

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-2xl shadow-2xl"
        style={{
          background: 'rgba(15,25,40,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderBottom: 'none',
          animation: 'slideUp 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 flex-none">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Title */}
        <div className="px-5 pb-3 flex-none flex items-center justify-between border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div>
            <div className="text-sm font-bold text-white">Assign Pitch to Line</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Line {selectedLine!.id.slice(0, 4)} · {selectedLine!.type}
            </div>
          </div>
          <button
            onClick={handleDone}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            Done
          </button>
        </div>

        {/* Pitch list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1">
          {savedPitches.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
                No pitches saved yet. Go to Pitch View to measure.
              </p>
              <button
                onClick={() => {
                  selectLine(null);
                  onGoToPitchView();
                }}
                className="px-4 py-2 rounded-lg text-xs font-bold"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                Go to Pitch View
              </button>
            </div>
          ) : (
            <>
              {/* No pitch option */}
              <PitchRow
                label="No Pitch"
                sublabel="Remove pitch assignment"
                pitchStr="0/12"
                isSelected={pendingPitch === '0/12'}
                onSelect={() => setPendingPitch('0/12')}
                accent="rgba(255,255,255,0.3)"
              />
              <div className="my-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
              {savedPitches.map((sp) => {
                const pitchStr = `${sp.rise}/${sp.run}`;
                return (
                  <PitchRow
                    key={sp.id}
                    label={sp.label}
                    sublabel={pitchStr}
                    pitchStr={pitchStr}
                    isSelected={pendingPitch === pitchStr}
                    onSelect={() => setPendingPitch(pitchStr)}
                    accent="#10b981"
                  />
                );
              })}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

interface PitchRowProps {
  label: string;
  sublabel: string;
  pitchStr: string;
  isSelected: boolean;
  onSelect: () => void;
  accent: string;
}

const PitchRow: React.FC<PitchRowProps> = ({ label, sublabel, isSelected, onSelect, accent }) => (
  <button
    onClick={onSelect}
    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all active:scale-[0.98]"
    style={{
      background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
      border: `1px solid ${isSelected ? 'rgba(255,255,255,0.12)' : 'transparent'}`,
    }}
  >
    {/* Radio indicator */}
    <div
      className="flex-none w-4 h-4 rounded-full flex items-center justify-center"
      style={{
        border: `2px solid ${isSelected ? accent : 'rgba(255,255,255,0.25)'}`,
        background: isSelected ? accent : 'transparent',
      }}
    >
      {isSelected && (
        <div className="w-1.5 h-1.5 rounded-full bg-white" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium" style={{ color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)' }}>
        {label}
      </div>
      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {sublabel}
      </div>
    </div>
  </button>
);

export default PitchAssignSheet;
