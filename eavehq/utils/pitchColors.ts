// Each assigned pitch gets a distinct color so multiple roof sections are easy to tell apart
export const PITCH_COLORS: Record<string, string> = {
  "0/12":  "#0ea5e9", // sky blue   — flat roof
  "1/12":  "#22c55e", // green
  "2/12":  "#84cc16", // lime
  "3/12":  "#eab308", // yellow
  "4/12":  "#f97316", // orange
  "5/12":  "#ef4444", // red
  "6/12":  "#ec4899", // pink
  "7/12":  "#a855f7", // purple
  "8/12":  "#6366f1", // indigo
  "9/12":  "#14b8a6", // teal
  "10/12": "#f59e0b", // amber
  "11/12": "#10b981", // emerald
  "12/12": "#f43f5e", // rose
  "14/12": "#8b5cf6", // violet
  "16/12": "#06b6d4", // cyan
  "18/12": "#d946ef", // fuchsia
};

export const DEFAULT_LINE_COLOR = "#ef4444"; // Bright Red (Measurement/Outline — unassigned)
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