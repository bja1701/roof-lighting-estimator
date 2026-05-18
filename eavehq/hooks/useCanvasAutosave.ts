import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useEstimatorStore } from '../store/useEstimatorStore';

export type SaveStatus = 'idle' | 'saving' | 'saved';

const DEBOUNCE_MS = 1500;

function localKey(jobId: string) {
  return `canvas_draft_${jobId}`;
}

function buildSnapshot(state: ReturnType<typeof useEstimatorStore.getState>) {
  return {
    nodes: state.nodes,
    lines: state.lines,
    pricePerFt: state.pricePerFt,
    controllerFee: state.controllerFee,
    includeController: state.includeController,
    satelliteCenter: state.satelliteCenter,
    estimateSiteAddress: state.estimateSiteAddress,
  };
}

export function readLocalDraft(jobId: string): object | null {
  try {
    const raw = localStorage.getItem(localKey(jobId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearLocalDraft(jobId: string) {
  localStorage.removeItem(localKey(jobId));
}

export function useCanvasAutosave(jobId: string | null): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!jobId) return;

    const unsubscribe = useEstimatorStore.subscribe((state) => {
      // Skip the very first emission on subscription (no user change yet)
      if (!initializedRef.current) {
        initializedRef.current = true;
        return;
      }

      // Skip saving when the store is empty (just after reset())
      if (state.nodes.length === 0 && state.lines.length === 0) return;

      const snapshot = buildSnapshot(state);

      try {
        localStorage.setItem(localKey(jobId), JSON.stringify(snapshot));
      } catch {}

      setStatus('saving');

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await supabase
            .from('jobs')
            .update({ canvas_draft: snapshot })
            .eq('id', jobId);
        } catch {}
        setStatus('saved');
      }, DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      initializedRef.current = false;
    };
  }, [jobId]);

  return status;
}
