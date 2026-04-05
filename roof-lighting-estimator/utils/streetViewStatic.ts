/**
 * Build a Google Street View Static API image URL for a thumbnail.
 * Requires the same API key as Maps JS; enable "Street View Static API" in Google Cloud Console.
 * @see https://developers.google.com/maps/documentation/streetview/overview
 */
export function streetViewStaticImageUrl(options: {
  location: string;
  apiKey: string;
  width?: number;
  height?: number;
}): string {
  const { location, apiKey } = options;
  const w = Math.min(640, Math.max(1, options.width ?? 640));
  const h = Math.min(640, Math.max(1, options.height ?? 320));
  const trimmed = location.trim();
  if (!trimmed || !apiKey) return '';
  const params = new URLSearchParams({
    size: `${w}x${h}`,
    location: trimmed,
    fov: '75',
    pitch: '0',
    source: 'outdoor',
    key: apiKey,
  });
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}
