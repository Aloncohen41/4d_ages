import { slidesOf } from "../src/lib/slides";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const mk = (id: string, date: string, media: any[], o: any = {}) => ({ id, childId: "c", type: "photo", description: id, date, media, tagIds: [], createdAt: 1, emoji: "📷", palette: "peach", source: "x", ...o });
const ph = (id: string, uri: string) => ({ id, kind: "photo", uri });
const vid = (id: string, uri: string, thumb?: string) => ({ id, kind: "video", uri, ...(thumb ? { thumb } : {}) });
const mem: any[] = [
  mk("c", "2025-03-03", [ph("1", "file:///c.jpg")]),
  mk("a", "2025-01-01", [ph("1", "file:///a1.jpg"), ph("2", "file:///a2.jpg"), vid("3", "file:///a.mp4", "file:///a-thumb.jpg")]),
  mk("b", "2025-02-02", [ph("1", "file:///a1.jpg")]),                                  // the SAME file as in "a"
  mk("m", "2025-02-10", [], { type: "milestone", title: "Crawls", emoji: "🧎" }),        // illustrated
  mk("g", "2025-02-12", [], { type: "measure", heightCm: 70 }),                          // a measurement with no picture
  mk("v", "2025-02-20", [vid("1", "file:///v.mp4")]),                                   // video without a thumbnail yet
];
const std = slidesOf(mem);
ok("oldest first, regardless of the order given", std.map((s) => s.memoryId).join() === "a,m,c");
ok("one slide per memory, using its MAIN picture", std[0].uri === "file:///a1.jpg" && !std[0].video);
ok("the same picture file never appears twice in one reel", !std.some((s) => s.memoryId === "b") && new Set(std.filter((s) => s.uri).map((s) => s.uri)).size === std.filter((s) => s.uri).length);
ok("illustrated memories (milestones with no picture) keep their emoji slide; measurements without a picture and unplayable videos are skipped", std.some((s) => s.memoryId === "m" && s.uri === null && s.emoji === "🧎") && !std.some((s) => s.memoryId === "g" || s.memoryId === "v"));
const each = slidesOf(mem, { perMedia: true });
ok("per media: every photo and video thumbnail becomes its own slide, in order", each.map((s) => s.id).join() === "a:1,a:2,a:3,c:1");
ok("per media: a video shows its thumbnail and is flagged; duplicates still removed", each[2].video === true && each[2].uri === "file:///a-thumb.jpg" && !each.some((s) => s.memoryId === "b"));
ok("per media: memories with no pictures are not offered", !each.some((s) => s.memoryId === "m" || s.memoryId === "g"));
const first = slidesOf([mk("x", "2025-01-01", [vid("1", "file:///x.mp4", "file:///xt.jpg"), ph("2", "file:///x2.jpg")])]);
ok("the post's chosen main picture decides its slide (a video's cover frame when it is first)", first[0].uri === "file:///xt.jpg" && first[0].video === true);
ok("nothing in, nothing out", slidesOf([]).length === 0);
console.log(fails ? `${fails} FAILED` : "all slide tests passed");
