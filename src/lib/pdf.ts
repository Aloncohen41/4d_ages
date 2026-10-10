import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Child, Memory, MilestoneDef, Relative, Tag } from "./types";
import { indexTags, labelOfTag } from "./tags";
import { ageLong, ageShort, formatDate, formatTime, smartAge, todayISO } from "./date";
import { coverOf } from "./display";
import { APP_NAME } from "../brand";
import { albumFileName } from "./fileNames";
import { withFriendlyName } from "./exportFiles";
import { shrunkBase64 } from "./resize";
import { BookPage, BookStyle, BookSizeId, STYLE_LOOK, bookMetrics, planBook, sizeById } from "./bookPages";
import { TYPE_META } from "./entries";

export { BOOK_SIZES, BOOK_STYLES } from "./bookPages";
export type { BookStyle, BookSizeId as BookSize } from "./bookPages";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Pictures are embedded at most this many pixels on their longest side: sharp in print at these sizes, small enough to keep the PDF light. */
const PRINT_PX = 1400;

export interface BookInput {
  child: Child;
  defs: MilestoneDef[]; // the milestone catalogue (for names)
  memories: Memory[]; // the child's memories, every type
  style: BookStyle;
  size: BookSizeId;
  relatives?: Relative[]; // so person tags print as names
  tags?: Tag[]; // the central tag list
  title?: string;
  subtitle?: string;
}

/** The heading for a memory on its page: the milestone's name, the title, or what kind of memory it is. */
export function memoryHeading(m: Memory, defs: MilestoneDef[]): string {
  if (m.type === "milestone") return defs.find((d) => d.id === m.milestoneId)?.label ?? m.title ?? "Milestone";
  return m.title?.trim() || (m.type === "photo" ? "" : TYPE_META[m.type].label);
}

export async function buildBookHtml(i: BookInput): Promise<{ html: string; pages: number }> {
  const { child, defs, style } = i;
  const size = sizeById(i.size);
  const plan = planBook(child, i.memories, size);
  const M = bookMetrics(size);
  const look = STYLE_LOOK[style];
  const rels = i.relatives || [];
  const tagIndex = indexTags(i.tags || []);
  const pt = (n: number) => `${n.toFixed(2)}pt`;

  // load every picture the plan uses, scaled down for print
  const pictureOf = (m?: Memory) => {
    const c = m ? coverOf(m.media) : null;
    return c && c.kind === "photo" ? c.uri : undefined;
  };
  const uris = new Set<string>();
  for (const p of plan.pages) {
    if (p.kind === "picture") uris.add(pictureOf(p.memory) as string);
    if (p.kind === "birth") [pictureOf(p.photo), pictureOf(p.story)].forEach((u) => u && uris.add(u));
  }
  const avatarMemory = i.memories.find((m) => m.id === child.avatarPhotoId);
  const avatarUri = pictureOf(avatarMemory);
  if (avatarUri) uris.add(avatarUri);
  const loaded = new Map<string, string | null>();
  for (const u of uris) loaded.set(u, await shrunkBase64(u, PRINT_PX)); // one at a time, so memory stays low
  const src = (m?: Memory) => {
    const u = pictureOf(m);
    return u ? loaded.get(u) ?? null : null;
  };

  const tagLine = (ids?: string[]) => {
    const labels = (ids || []).map((x) => labelOfTag(tagIndex.get(x), rels)).filter(Boolean);
    return labels.length ? `<p class="meta">${labels.map(esc).join(" · ")}</p>` : "";
  };
  const meta = (m: Memory) => `${formatDate(m.date)}${m.time ? ` · ${formatTime(m.time)}` : ""} · ${ageShort(child.birth, m.date)}${m.location ? ` · ${esc(m.location)}` : ""}`;
  const entry = (m: Memory, clamp: number) => {
    const head = memoryHeading(m, defs);
    return `<div class="entry">${head ? `<p class="label">${esc(head)}</p>` : ""}<p class="meta">${meta(m)}</p>${m.description ? `<p class="body" style="-webkit-line-clamp:${clamp}">${esc(m.description)}</p>` : ""}${tagLine(m.tagIds)}</div>`;
  };
  const picture = (s: string | null) => (s ? `<div class="pic"><img src="${s}"/></div>` : `<div class="pic"></div>`);

  const page = (p: BookPage): string => {
    switch (p.kind) {
      case "cover": {
        const avatar = avatarUri && loaded.get(avatarUri)
          ? `<img class="avatar" src="${loaded.get(avatarUri)}"/>`
          : `<div class="avatar emoji">${esc(child.emoji)}</div>`;
        return `<div class="page center"><p class="meta">${esc(APP_NAME)}</p><h1>${esc(i.title || `${child.name}'s First Years`)}</h1><p class="meta">${esc(i.subtitle || `Born ${formatDate(child.birth)}`)}</p>${avatar}</div>`;
      }
      case "birth": {
        const img = src(p.photo) ?? src(p.story);
        return `<div class="page${img ? "" : " center"}">${img ? picture(img) : ""}<div class="entry"><p class="meta">The day ${esc(child.name)} was born</p><p class="label big">${formatDate(p.date)}</p>${p.story?.title ? `<p class="label">${esc(p.story.title)}</p>` : ""}${p.story?.description ? `<p class="body" style="-webkit-line-clamp:${img ? 4 : 14}">${esc(p.story.description)}</p>` : ""}</div></div>`;
      }
      case "picture":
        return `<div class="page">${picture(src(p.memory))}${entry(p.memory, 3)}</div>`;
      case "notes":
        return `<div class="page notes">${p.memories.map((m) => entry(m, 5)).join("")}</div>`;
      case "end": {
        const sm = smartAge(child.birth);
        return `<div class="page center"><h2>${esc(child.name)} today</h2><p class="label big">${sm.value}</p><p class="meta">${sm.unit} · ${esc(ageLong(child.birth, todayISO()))}</p></div>`;
      }
    }
  };

  const css = `
@page{size:${pt(M.w)} ${pt(M.h)};margin:0}
html,body{margin:0;padding:0;background:${look.paper}}
body{font-family:${look.fontCss};color:${look.ink}}
.page{width:${pt(M.w)};height:${pt(M.h)};box-sizing:border-box;padding:${pt(M.margin)};overflow:hidden;display:flex;flex-direction:column;page-break-after:always;break-after:page;background:${look.paper}}
.page:last-child{page-break-after:auto;break-after:auto}
.center{align-items:center;justify-content:center;text-align:center}
.notes{justify-content:flex-start;gap:${pt(3 * M.u)}}
h1{font-size:${pt(M.title)};margin:${pt(2 * M.u)} 0;color:${look.accent};font-weight:600}
h2{font-size:${pt(M.title * 0.8)};margin:0 0 ${pt(2 * M.u)};color:${look.accent};font-weight:600}
.pic{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;margin-bottom:${pt(2.4 * M.u)}}
.pic img{max-width:100%;max-height:100%;object-fit:contain;border-radius:${pt(look.radius * M.u)};${look.frame ? `border:${pt(look.frame * M.u)} solid #fff;` : ""}}
.entry{flex:none}
.label{font-size:${pt(M.label)};font-weight:700;margin:0;color:${look.ink}}
.label.big{font-size:${pt(M.label * 1.6)};margin:${pt(M.u)} 0}
.meta{font-size:${pt(M.meta)};margin:${pt(0.6 * M.u)} 0 0;color:${look.sub}}
.body{font-size:${pt(M.body)};line-height:1.35;margin:${pt(1.2 * M.u)} 0 0;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.avatar{width:${pt(34 * M.u)};height:${pt(34 * M.u)};border-radius:50%;object-fit:cover;margin-top:${pt(4 * M.u)}}
.avatar.emoji{display:flex;align-items:center;justify-content:center;font-size:${pt(18 * M.u)};width:auto;height:auto}
`;
  return { html: `<html><head><meta charset="utf-8"/><style>${css}</style></head><body>${plan.pages.map(page).join("")}</body></html>`, pages: plan.pages.length };
}

export async function exportBook(i: BookInput): Promise<void> {
  const { html } = await buildBookHtml(i);
  const size = sizeById(i.size);
  const M = bookMetrics(size);
  // the page size, in PDF points: exactly the chosen print size (to the nearest point, 0.35 mm)
  const { uri } = await Print.printToFileAsync({ html, width: M.w, height: M.h });
  const fileName = albumFileName(i.child.name, i.style); // e.g. "Maya Classic Album By 4D-Ages.pdf" instead of a random temporary name
  const named = withFriendlyName(uri, fileName);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(named, { mimeType: "application/pdf", dialogTitle: fileName.replace(/\.pdf$/, ""), UTI: "com.adobe.pdf" });
  }
}
