// Standard Pitch Colors for visual feedback — pitch application zones are purple
export const PITCH_COLORS: Record<string, string> = {
  "0/12": "#a855f7", // Purple
  "1/12": "#a855f7",
  "2/12": "#a855f7",
  "3/12": "#a855f7",
  "4/12": "#a855f7",
  "5/12": "#a855f7",
  "6/12": "#a855f7",
  "7/12": "#a855f7",
  "8/12": "#a855f7",
  "9/12": "#a855f7",
  "10/12": "#a855f7",
  "11/12": "#a855f7",
  "12/12": "#a855f7",
  "14/12": "#a855f7",
  "16/12": "#a855f7",
  "18/12": "#a855f7",
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