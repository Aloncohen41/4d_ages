import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";
import { Child, HeightEntry, Memory, MilestoneDef, Relative, Tag } from "./types";
import { indexTags, labelOfTag } from "./tags";
import { ageLong, ageShort, formatDate, formatTime, smartAge, todayISO } from "./date";
import { blurb, byMoment, coverOf } from "./display";
import { APP_NAME } from "../brand";
import { albumFileName } from "./fileNames";
import { withFriendlyName } from "./exportFiles";
import { HeightUnit, formatHeight, funReference, heightAt } from "./growth";

export type BookStyle = "classic" | "minimal" | "storybook";
export type BookSize = "square" | "a4";

export const BOOK_STYLES: { id: BookStyle; label: string; desc: string }[] = [
  { id: "classic", label: "Classic", desc: "Warm cream pages, serif titles" },
  { id: "minimal", label: "Minimal", desc: "Clean white, lots of space" },
  { id: "storybook", label: "Storybook", desc: "Soft pastel, rounded photos" },
];
export const BOOK_SIZES: { id: BookSize; label: string; w: number; h: number }[] = [
  { id: "square", label: "Square 8×8 in", w: 576, h: 576 },
  { id: "a4", label: "A4 portrait", w: 595, h: 842 },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function dataUri(uri: string): Promise<string | null> {
  try {
    const f = new File(uri) as unknown as { base64: () => Promise<string> | string };
    const b64 = await Promise.resolve(f.base64());
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    return null;
  }
}

const RULER_CSS = `.moment{position:relative;padding-right:46px;min-height:40px}.ruler{position:absolute;right:30px;top:0;bottom:6px;width:5px;border-radius:3px;background:#00000014}.rdot{position:absolute;left:-6px;width:17px;height:4px;border-radius:2px;background:#d16a92}.rlab{position:absolute;right:0;width:30px;font-size:6.5pt;text-align:center;color:#8a6a6a;line-height:1}`;

const CSS: Record<BookStyle, string> = {
  classic: `body{font-family:Georgia,serif;color:#3d2a1f}.page{background:#fffaf0}h1,h2{color:#8a4b2d}.tag{color:#b5651d}.img{border-radius:6px}`,
  minimal: `body{font-family:Helvetica,Arial,sans-serif;color:#222}.page{background:#fff}h1,h2{font-weight:300;letter-spacing:.04em}.tag{color:#888}.img{border-radius:0}`,
  storybook: `body{font-family:'Trebuchet MS',Verdana,sans-serif;color:#3a3358}.page{background:#f4f1ff}h1,h2{color:#6a5acd}.tag{color:#e17aa0}.img{border-radius:22px;border:6px solid #fff}`,
};

export interface BookInput {
  child: Child;
  defs: MilestoneDef[]; // the milestone catalogue (for names)
  memories: Memory[]; // the child's memories, every type
  style: BookStyle;
  size: BookSize;
  heights?: HeightEntry[];
  unit?: HeightUnit;
  relatives?: Relative[]; // so person tags print as names
  tags?: Tag[]; // the central tag list
  title?: string;
  subtitle?: string;
}

/** Photos are embedded in the PDF, so keep the total modest. */
const IMAGE_BUDGET = 24;

export async function buildBookHtml(i: BookInput): Promise<string> {
  const { child, defs, memories, style } = i;
  const heights = i.heights || [];
  const rels = i.relatives || [];
  const tagIndex = indexTags(i.tags || []);
  const unit: HeightUnit = i.unit || "cm";
  const maxCm = heights.length ? Math.max(70, ...heights.map((h) => h.cm)) * 1.08 : 0;
  const imgMax = i.size === "a4" ? 300 : 200;

  /** A little ruler on the page's side with a marker at how tall they were at that time */
  const ruler = (date: string) => {
    const h = heightAt(heights, date);
    if (!h || !maxCm) return "";
    const pct = Math.min(96, Math.max(2, (h.cm / maxCm) * 100));
    return `<div class="ruler"><div class="rdot" style="bottom:${pct}%"></div></div><div class="rlab" style="bottom:calc(${pct}% - 1pt)">${formatHeight(h.cm, unit).replace(" ", "<br/>")}</div>`;
  };

  const sm = smartAge(child.birth);
  const milestones = memories.filter((m) => m.type === "milestone").sort(byMoment);
  const firsts = memories.filter((m) => m.type === "first").sort(byMoment);
  const lasts = memories.filter((m) => m.type === "last").sort(byMoment);
  const ownPage = (m: Memory) => m.type === "milestone" || m.type === "first" || m.type === "last";
  const photoOf = (m: Memory) => {
    const c = coverOf(m.media);
    return c && c.kind === "photo" ? c.uri : undefined;
  };
  const moments = memories.filter((m) => !ownPage(m) && photoOf(m)).sort(byMoment);

  // choose which pictures go in (milestones, firsts and lasts first), then load them
  let budget = IMAGE_BUDGET;
  const take = (list: Memory[], max: number): Set<Memory> => {
    const out = new Set<Memory>();
    for (const m of list) if (out.size < max && budget > 0 && photoOf(m)) { out.add(m); budget--; }
    return out;
  };
  const msPick = take(milestones, 5);
  const firstPick = take(firsts, 6);
  const lastPick = take(lasts, 3);
  const momentPick = take([...moments].reverse(), 12);
  const load = async (m: Memory, picked: Set<Memory>) => (picked.has(m) ? dataUri(photoOf(m) as string) : null);
  const [msImgs, firstImgs, lastImgs, momentImgs] = await Promise.all([
    Promise.all(milestones.map((m) => load(m, msPick))),
    Promise.all(firsts.map((m) => load(m, firstPick))),
    Promise.all(lasts.map((m) => load(m, lastPick))),
    Promise.all(moments.map((m) => load(m, momentPick))),
  ]);

  let avatar = "";
  const am = memories.find((m) => m.id === child.avatarPhotoId);
  const au = am ? photoOf(am) : undefined;
  if (au) {
    const u = await dataUri(au);
    if (u) avatar = `<img class="img" src="${u}" style="width:150px;height:150px;object-fit:cover;border-radius:75px;margin-top:18px"/>`;
  }
  if (!avatar) avatar = `<div style="font-size:70px;margin-top:14px">${child.emoji}</div>`;

  const img = (src: string | null) => (src ? `<img class="img" src="${src}" style="max-width:100%;max-height:${imgMax}px;display:block;margin:0 0 6px"/>` : "");
  const tagLine = (ids?: string[]) => {
    const labels = (ids || []).map((x) => labelOfTag(tagIndex.get(x), rels)).filter(Boolean);
    return labels.length ? `<p class="tag" style="margin:3px 0 0;font-size:8.5pt">${labels.map(esc).join(" · ")}</p>` : "";
  };
  const meta = (m: Memory) =>
    `<span class="tag" style="font-size:9pt">${formatDate(m.date)}${m.time ? ` · ${formatTime(m.time)}` : ""} · ${ageShort(child.birth, m.date)}${m.location ? ` · ${esc(m.location)}` : ""}</span>`;
  const block = (m: Memory, src: string | null, head: string) =>
    `<div class="moment" style="break-inside:avoid;margin:12px 0;padding-bottom:10px;border-bottom:1px solid #0001">${ruler(m.date)}${img(src)}<b>${head}</b> ${meta(m)}${m.description ? `<p style="margin:4px 0 0;font-size:10pt">${esc(m.description)}</p>` : ""}${tagLine(m.tagIds)}</div>`;

  const cover = `<div class="page" style="text-align:center;padding-top:70px"><p class="tag" style="font-size:11pt">${esc(APP_NAME)}</p><h1 style="font-size:30pt;margin:10px 0">${esc(i.title || `${child.name}'s First Years`)}</h1><p class="tag">${esc(i.subtitle || `Born ${formatDate(child.birth)}`)}</p>${avatar}</div>`;

  const section = (title: string, body: string) => (body ? `<div class="page"><h2 style="text-align:center">${title}</h2>${body}</div>` : "");
  const milestoneName = (m: Memory) => defs.find((d) => d.id === m.milestoneId)?.label ?? m.title ?? "Milestone";

  const milestonesPage = section("Milestones", milestones.map((m, k) => block(m, msImgs[k], `${m.emoji} ${esc(milestoneName(m))}`)).join(""));
  const entryPage = (title: string, list: Memory[], imgs: (string | null)[]) => section(title, list.map((m, k) => block(m, imgs[k], `${m.emoji} ${esc(m.title || "")}`)).join(""));
  const firstsPage = entryPage("Firsts", firsts, firstImgs);
  const lastsPage = entryPage("Lasts", lasts, lastImgs);

  const pics: string[] = [];
  moments.forEach((m, k) => {
    const u = momentImgs[k];
    if (!u) return;
    pics.push(`<div class="moment" style="break-inside:avoid;margin-bottom:14px;text-align:center">${ruler(m.date)}<img class="img" src="${u}" style="max-width:100%;max-height:${imgMax + 10}px"/><p style="margin:5px 0 0;font-size:10pt">${esc(blurb(m))}</p><p class="tag" style="margin:0;font-size:9pt">${formatDate(m.date)}${m.time ? ` · ${formatTime(m.time)}` : ""} · ${ageShort(child.birth, m.date)}${m.location ? ` · ${esc(m.location)}` : ""}</p>${tagLine(m.tagIds)}</div>`);
  });
  const momentsPage = pics.length ? `<div class="page"><h2 style="text-align:center">Moments in between</h2>${pics.join("")}</div>` : "";

  // stories without a picture of their own still belong in the book
  const textStories = memories.filter((m) => m.type === "story" && !photoOf(m)).sort(byMoment);
  const storiesPage = section("Stories", textStories.map((m) => block(m, null, `${m.emoji} ${esc(m.title || "")}`)).join(""));

  const growthPage = heights.length
    ? `<div class="page"><h2 style="text-align:center">Growing up</h2>${[...heights]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((h) => {
          const f = funReference(h.cm);
          return `<p style="margin:7px 0;font-size:11pt;break-inside:avoid"><b>${formatHeight(h.cm, unit)}</b> <span class="tag" style="font-size:9pt">${formatDate(h.date)} · ${ageShort(child.birth, h.date)}</span>${f ? ` <span style="font-size:9pt">${f.emoji} like ${f.name}</span>` : ""}</p>`;
        })
        .join("")}</div>`
    : "";

  const counts = [`${milestones.length} milestones`, `${firsts.length} firsts`, `${lasts.length} lasts`].join(" · ");
  const end = `<div class="page" style="text-align:center;padding-top:90px"><h2>${esc(child.name)} today</h2><p style="font-size:26pt;margin:8px 0">${sm.value}</p><p class="tag">${sm.unit} · ${esc(ageLong(child.birth, todayISO()))}</p><p style="margin-top:30px;font-size:10pt">${counts}</p></div>`;

  return `<html><head><meta charset="utf-8"/><style>@page{margin:28px}body{margin:0}.page{padding:6px;page-break-after:always}${RULER_CSS}${CSS[style]}</style></head><body>${cover}${milestonesPage}${firstsPage}${lastsPage}${storiesPage}${momentsPage}${growthPage}${end}</body></html>`;
}

export async function exportBook(i: BookInput): Promise<void> {
  const html = await buildBookHtml(i);
  const dims = BOOK_SIZES.find((s) => s.id === i.size) || BOOK_SIZES[0];
  const { uri } = await Print.printToFileAsync({ html, width: dims.w, height: dims.h });
  const fileName = albumFileName(i.child.name, i.style); // e.g. "Maya Classic Album By 4D-Ages.pdf" instead of a random temporary name
  const named = withFriendlyName(uri, fileName);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(named, { mimeType: "application/pdf", dialogTitle: fileName.replace(/\.pdf$/, ""), UTI: "com.adobe.pdf" });
  }
}
