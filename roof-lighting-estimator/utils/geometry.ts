import { LatLng } from '../types/index';

// Standard US Roof Pitches (Rise over 12 run)
// Key: Pitch String, Value: Angle in Degrees
export const PITCH_LOOKUP: Record<string, number> = {
  "0/12": 0.0,
  "1/12": 4.76,
  "2/12": 9.46,
  "3/12": 14.04,
  "4/12": 18.43,
  "5/12": 22.62,
  "6/12": 26.57,
  "7/12": 30.26,
  "8/12": 33.69,
  "9/12": 36.87,
  "10/12": 39.81,
  "11/12": 42.51,
  "12/12": 45.0,
  "14/12": 49.4,
  "16/12": 53.13,
  "18/12": 56.31,
  "21/12": 60.26,
  "24/12": 63.43
};

/**
 * Calculates the Haversine distance between two points in feet.
 * @param p1 Point 1 {lat, lng}
 * @param p2 Point 2 {lat, lng}
 * @returns Distance in feet
 */
export const calculateDistance = (p1: LatLng, p2: LatLng): number => {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = R * c;

  // Convert meters to feet (1 m = 3.28084 ft)
  return distanceMeters * 3.28084;
};

/**
 * Calculates the pitch multiplier based on the pitch string.
 * Multiplier = sqrt(1 + (rise/12)^2)
 * @param pitch e.g., "6/12"
 * @returns multiplier e.g., 1.118
 */
export const getMultiplierFromPitch = (pitch: string): number => {
  if (!pitch.includes('/')) return 1.0;
  
  const rise = parseFloat(pitch.split('/')[0]);
  if (isNaN(rise)) return 1.0;

  return Math.sqrt(1 + Math.pow(rise / 12, 2));
};

/**
 * Converts a visual angle (degrees) to the nearest standard roof pitch string.
 * @param degrees The measured angle in degrees
 * @returns The nearest standard pitch string (e.g., "6/12")
 */
export const convertVisualAngleToPitch = (degrees: number): string => {
  let closestPitch = "0/12";
  let minDiff = Number.MAX_VALUE;

  for (const [pitchStr, pitchAngle] of Object.entries(PITCH_LOOKUP)) {
    const diff = Math.abs(degrees - pitchAngle);
    if (diff < minDiff) {
      minDiff = diff;
      closestPitch = pitchStr;
    }
  }

  return closestPitch;
};
