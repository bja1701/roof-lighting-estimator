import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useEstimatorStore } from '../store/useEstimatorStore';

export type SaveStatus = 'idle' | 'saving' | 'saved';

const DEBOUNCE_MS = 1500;

function localKey(jobId: string) {
  return `canvas_draft_${jobId}`;
}

/**
 * Builds the snapshot object written to localStorage / Supabase.
 * Mirrors the shape restoreCanvas() already understands.
 */
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

/**
 * Reads the persisted draft for a given jobId from localStorage.
 * Returns null if nothing is stored or the value fails to parse.
 */
export function readLocalDraft(jobId: string): object | null {
  try {
    const raw = localStorage.getItem(localKey(jobId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Removes the local draft for a jobId.
 * Call this after a quote is formally saved so stale draft doesn't re-appear.
 */
export function clearLocalDraft(jobId: string) {
  localStorage.removeItem(localKey(jobId));
}

/**
 * useCanvasAutosave
 *
 * Subscribes to the estimator store.  Whenever nodes or lines change:
 *  1. Writes to localStorage immediately (synchronous, keyed by jobId).
 *  2. After DEBOUNCE_MS of inactivity, attempts a Supabase PATCH on jobs.canvas_draft.
 *     Supabase save is best-effort — network failure is silently ignored.
 *
 * Returns the current SaveStatus for the UI indicator.
 *
 * @param jobId  The current job UUID, or null if the estimator is open without a job context.
 */
export function useCanvasAutosave(jobId: string | null): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether there's actually been a change worth saving (skip the initial mount).
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!jobId) return;

    const unsubscribe = useEstimatorStore.subscribe((state) => {
      // Skip the very first emission that fires on subscription (no user change yet).
      if (!initializedRef.current) {
        initializedRef.current = true;
        return;
      }

      const snapshot = buildSnapshot(state);

      // 1. Synchronous localStorage write — always succeeds.
      try {
        localStorage.setItem(localKey(jobId), JSON.stringify(snapshot));
      } catch {
        // Storage quota exceeded — skip silently.
      }

      setStatus('saving');

      // 2. Debounced Supabase write.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await supabase
            .from('jobs')
            .update({ canvas_draft: snapshot })
            .eq('id', jobId);
        } catch {
          // Network error — localStorage already has the draft, so no data loss.
        }
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
