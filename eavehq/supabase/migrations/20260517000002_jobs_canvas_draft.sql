-- Add canvas_draft column to jobs for in-progress estimator autosave.
-- Stores { nodes, lines, pricePerFt, controllerFee, includeController, satelliteCenter, estimateSiteAddress }
-- Written by debounced autosave hook; cleared when the estimate is formally saved as a quote.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS canvas_draft jsonb;
