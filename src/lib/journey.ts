import { Place, onMap, placesByYear } from "./places";

import { tr } from "./i18n";
/*
 * The journey video: one slide a year on the world map, the places from earlier years already pinned and that year's popping in, with the
 * year and its places written along the bottom. Pure, for tests: videoExport.ts hands it to the video maker.
 */

export interface JourneySlide { year: string; pins: { x: number; y: number; fresh: boolean }[]; count: string; names: string }

export function journeySlides(places: Place[]): JourneySlide[] {
  const out: JourneySlide[] = [];
  const seen: Place[] = [];
  for (const { year, places: list } of placesByYear(places)) {
    const pins = [
      ...seen.map((p) => ({ ...onMap(p.lat, p.lon), fresh: false })),
      ...list.map((p) => ({ ...onMap(p.lat, p.lon), fresh: true })),
    ];
    const names = list.map((p) => p.name);
    out.push({
      year,
      pins,
      count: `${list.length} ${list.length === 1 ? tr("new place") : tr("new places")} · ${seen.length + list.length} in all`,
      names: names.length > 4 ? `${names.slice(0, 4).join(", ")} and ${names.length - 4} more` : names.join(", "),
    });
    seen.push(...list);
  }
  return out;
}
