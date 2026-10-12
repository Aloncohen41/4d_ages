/*
 * The places a pet has been (the Adventures tab): each with its point on the map, the day, and the country. Kept as JSON in the pet's
 * Adventures page (PLACES_ID), so it syncs with the other owners like any page. Pure, for tests.
 */

export interface Place {
  id: string;
  name: string; // "Hyde Park"
  detail?: string; // "London, United Kingdom"
  lat: number;
  lon: number;
  date: string; // YYYY-MM-DD: when they were there
  country?: string;
  countryCode?: string; // "GB"
  note?: string;
}

/** The places in a page's saved values (an unreadable list is no places, never an error). */
export function readPlaces(values?: Record<string, string>): Place[] {
  try {
    const list = JSON.parse(values?.places ?? "[]") as Place[];
    return Array.isArray(list) ? list.filter((p) => p && typeof p.lat === "number" && typeof p.lon === "number" && p.name) : [];
  } catch {
    return [];
  }
}
export const writePlaces = (places: Place[]): Record<string, string> => ({ places: JSON.stringify([...places].sort((a, b) => a.date.localeCompare(b.date))) });

/** Every place and the year it was in, oldest year first (the journey, year by year). */
export function placesByYear(places: Place[]): { year: string; places: Place[] }[] {
  const years = new Map<string, Place[]>();
  for (const p of [...places].sort((a, b) => a.date.localeCompare(b.date))) years.set(p.date.slice(0, 4), [...(years.get(p.date.slice(0, 4)) ?? []), p]);
  return [...years.entries()].map(([year, list]) => ({ year, places: list }));
}

/** "12 places · 3 countries" */
export function placesSummary(places: Place[]): string {
  const countries = new Set(places.map((p) => p.countryCode || p.country).filter(Boolean)).size;
  return [`${places.length} ${places.length === 1 ? "place" : "places"}`, countries ? `${countries} ${countries === 1 ? "country" : "countries"}` : ""].filter(Boolean).join(" · ");
}

/** The world map's frame (an equirectangular map from latitude 84° N to 58° S, as drawn in assets/world-map.png). */
export const MAP_NORTH = 84;
export const MAP_SOUTH = -58;
/** Where a point falls on the world map, from 0 to 1 across and down. */
export const onMap = (lat: number, lon: number) => ({
  x: (lon + 180) / 360,
  y: (MAP_NORTH - Math.max(MAP_SOUTH, Math.min(MAP_NORTH, lat))) / (MAP_NORTH - MAP_SOUTH),
});
