/*
 * Finding a place: an address or a name to a point on the map, and a point back to a place name. Uses OpenStreetMap's free Nominatim
 * service (no key or account), politely: a clear app name, and only when the parent searches or drops a pin.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org";
const HEADERS = { "User-Agent": "4DAges/1.1 (https://github.com/Aloncohen41/4d_ages)", "Accept-Language": "en" };

export interface FoundPlace { name: string; detail: string; lat: number; lon: number; country?: string; countryCode?: string }

interface NominatimResult { lat: string; lon: string; name?: string; display_name: string; address?: Record<string, string> }

/** "Hyde Park, London" from a search result: the place, then its town and country. */
export function describe(r: NominatimResult): FoundPlace {
  const a = r.address ?? {};
  const town = a.city || a.town || a.village || a.suburb || a.county || "";
  const name = r.name || a.road || town || r.display_name.split(",")[0];
  const detail = [name === town ? "" : town, a.country].filter(Boolean).join(", ");
  return { name, detail, lat: Number(r.lat), lon: Number(r.lon), country: a.country, countryCode: a.country_code?.toUpperCase() };
}

/** Places matching what was typed (an address, a park, a town…), best first. Empty when offline. */
export async function searchPlaces(query: string): Promise<FoundPlace[]> {
  if (query.trim().length < 3) return [];
  try {
    const res = await fetch(`${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(query.trim())}`, { headers: HEADERS });
    if (!res.ok) return [];
    return ((await res.json()) as NominatimResult[]).map(describe);
  } catch {
    return [];
  }
}

/** The place at a point on the map (for a dropped pin), or null. */
export async function placeAt(lat: number, lon: number): Promise<FoundPlace | null> {
  try {
    const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=16&lat=${lat}&lon=${lon}`, { headers: HEADERS });
    if (!res.ok) return null;
    const r = (await res.json()) as NominatimResult & { error?: string };
    return r.error ? null : describe(r);
  } catch {
    return null;
  }
}
