function toDisplayAddress(parts: Array<string | undefined | null>): string | null {
  const value = parts
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
    .join(', ')
    .trim();
  return value.length > 0 ? value : null;
}

export async function reverseGeocodeAddress(lat: number, lng: number): Promise<string | null> {
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      String(lat)
    )}&lon=${encodeURIComponent(String(lng))}&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'sitesync-backend/1.0',
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      address?: {
        road?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        postcode?: string;
        country?: string;
      };
    };
    if (data.display_name && data.display_name.trim().length > 0) {
      return data.display_name.trim();
    }
    return toDisplayAddress([
      data.address?.road,
      data.address?.suburb,
      data.address?.city ?? data.address?.town ?? data.address?.village,
      data.address?.state,
      data.address?.postcode,
      data.address?.country,
    ]);
  } catch {
    return null;
  }
}
