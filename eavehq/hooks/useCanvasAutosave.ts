import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useEstimatorStore } from '../store/useEstimatorStore';

export type SaveStatus = 'idle' | 'saving' | 'saved';

const DEBOUNCE_MS = 1500;
// Persists the last-used jobId across refreshes so the draft can be found
// even after sessionStorage is cleared on first load.
const LAST_JOB_KEY = 'estimator_last_job_id';

function localKey(jobId: string) {
  return `canvas_draft_${jobId}`;
}

function buildSnapshot(state: ReturnType<typeof useEstimatorStore.getState>) {
  return {
    nodes: state.nodes,
    lines: state.lines,
    savedPitches: state.savedPitches,
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

/** Returns the jobId from the last autosave session — used for refresh recovery. */
export function readLastJobId(): string | null {
  try {
    return localStorage.getItem(LAST_JOB_KEY);
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

  useEffect(() => {
    if (!jobId) return;

    const unsubscribe = useEstimatorStore.subscribe((state) => {
      // Skip saving when the store is empty (right after reset())
      // Zustand subscribe never fires immediately on subscribe — only on future changes,
      // so there is no spurious "first emission" to skip.
      if (state.nodes.length === 0 && state.lines.length === 0) return;

      const snapshot = buildSnapshot(state);

      try {
        localStorage.setItem(localKey(jobId), JSON.stringify(snapshot));
        // Record which job is active so a page refresh can find this draft
        localStorage.setItem(LAST_JOB_KEY, jobId);
      } catch {}

      setStatus('saving');

      if (jobId !== 'anonymous') {
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
      } else {
        setStatus('saved');
      }
    });

    return () => {
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [jobId]);

  return status;
}
