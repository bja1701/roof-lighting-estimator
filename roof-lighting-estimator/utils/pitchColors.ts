// Standard Pitch Colors for visual feedback
export const PITCH_COLORS: Record<string, string> = {
  "0/12": "#c084fc", // Bright Purple (Flat/Eave) - High visibility
  "1/12": "#c084fc",
  "2/12": "#facc15", // Yellow (Low)
  "3/12": "#facc15",
  "4/12": "#fbbf24", // Amber
  "5/12": "#fbbf24",
  "6/12": "#f97316", // Orange (Medium)
  "7/12": "#f97316",
  "8/12": "#ea580c", // Red-Orange
  "9/12": "#dc2626", // Red (Steep)
  "10/12": "#dc2626",
  "11/12": "#991b1b", // Dark Red
  "12/12": "#7f1d1d", // Very Dark Red
  "14/12": "#450a0a",
  "16/12": "#450a0a",
  "18/12": "#450a0a",
};

export const DEFAULT_LINE_COLOR = "#38bdf8"; // Cyan (Unassigned/New)
export const SELECTED_LINE_COLOR = "#22c55e"; // Bright Green

/**
 * Returns the hex color associated with a specific roof pitch.
 * @param pitch The pitch string (e.g. "6/12")
 * @returns Hex color string
 */
export const getColorForPitch = (pitch: string | undefined): string => {
  if (!pitch) return DEFAULT_LINE_COLOR;
  return PITCH_COLORS[pitch] || DEFAULT_LINE_COLOR;
};