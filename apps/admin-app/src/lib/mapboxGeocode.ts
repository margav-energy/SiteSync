/** Mapbox Geocoding API — forward search with autocomplete. https://docs.mapbox.com/api/search/geocoding/ */

export const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';

/** ISO 3166-1 alpha-2 codes, comma-separated (e.g. `gb` or `gb,ie`). Default `gb` = UK-only. */
const MAPBOX_COUNTRY = process.env.EXPO_PUBLIC_MAPBOX_COUNTRY?.trim() || 'gb';

export type MapboxSuggestion = {
  id: string;
  placeName: string;
  /** [longitude, latitude] */
  center: [number, number];
};

export type ReverseGeocodeResult = {
  placeName: string;
  center: [number, number];
};

type GeocodeResponse = {
  features?: Array<{
    id: string;
    place_name: string;
    center: [number, number];
  }>;
};

export function isMapboxConfigured(): boolean {
  return MAPBOX_ACCESS_TOKEN.length > 0;
}

/**
 * Returns address/place suggestions. Requires a public Mapbox access token with Geocoding enabled.
 */
export async function fetchAddressSuggestions(query: string): Promise<MapboxSuggestion[]> {
  if (!isMapboxConfigured()) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  const path = encodeURIComponent(q);
  const params = new URLSearchParams({
    access_token: MAPBOX_ACCESS_TOKEN,
    autocomplete: 'true',
    limit: '8',
    types: 'address,poi,place',
    // Limit results to these countries (Mapbox Geocoding API).
    country: MAPBOX_COUNTRY,
  });

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${path}.json?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mapbox geocoding failed (${res.status})`);
  }
  const data: GeocodeResponse = await res.json();
  const features = data.features ?? [];
  return features.map((f) => ({
    id: f.id,
    placeName: f.place_name,
    center: f.center,
  }));
}

/**
 * Reverse geocode coordinates to nearest address/place.
 */
export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult | null> {
  if (!isMapboxConfigured()) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const coord = `${longitude},${latitude}`;
  const params = new URLSearchParams({
    access_token: MAPBOX_ACCESS_TOKEN,
    types: 'address,poi,place',
    limit: '1',
    country: MAPBOX_COUNTRY,
  });
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coord}.json?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mapbox reverse geocoding failed (${res.status})`);
  }
  const data: GeocodeResponse = await res.json();
  const first = data.features?.[0];
  if (!first) return null;
  return {
    placeName: first.place_name,
    center: first.center,
  };
}
