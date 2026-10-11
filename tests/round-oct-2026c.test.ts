/*
 * October 2026, third round: real photos for the pregnancy weeks, a shorter invite message that says what they can do, the book's family page
 * in each theme's words, "Maya's Days" / "Maya's Years", dates read from inside picked files, the update check, more than one account on a
 * phone, and deleting a child's profile.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FRUIT_WEEKS } from "../src/lib/pregnancy";
import { inviteMessage } from "../src/lib/shareFlow";
import { FAMILY_TITLES } from "../src/lib/bookHtml";
import { BOOK_STYLES, bookName } from "../src/lib/bookPages";
import { exifDateIn, videoDateIn } from "../src/lib/fileDate";
import { isNewer, releaseOf, shouldOffer, ASK_AGAIN_MS } from "../src/lib/updateCheck";
import { ACCOUNT_FIELDS, accountKey, swapAccounts } from "../src/lib/accounts";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");

(async () => {
  // ---- pregnancy weeks: a photo of the real fruit
  const sources = JSON.parse(read("assets/fruit/sources.json")) as Record<string, { licence: string; source: string }>;
  const pics = new Set(FRUIT_WEEKS.map((w) => w.pic));
  ok("every week from 4 to 40 has a photo of its fruit, and every photo is bundled", FRUIT_WEEKS.every((w) => existsSync(join(root, "assets/fruit", `${w.pic}.jpg`))) && [...pics].every((p) => read("src/lib/fruitPictures.ts").includes(`"${p}": require("../../assets/fruit/${p}.jpg")`)));
  ok("each photo is public domain or CC0, with where it came from", [...pics].every((p) => sources[p] && /^(Public domain|CC0)$/.test(sources[p].licence) && /^https:\/\//.test(sources[p].source)));
  ok("Growth shows the photo (big for this week, small on the week-by-week scale), not an emoji", /source=\{FRUIT_PICTURES\[size\.pic\]\}/.test(read("src/components/Pregnancy.tsx")) && /source=\{FRUIT_PICTURES\[w\.pic\]\}/.test(read("src/components/Pregnancy.tsx")) && !/\{size\.emoji\}|\{w\.emoji\}/.test(read("src/components/Pregnancy.tsx")));

  // ---- the invite message
  const fam = inviteMessage("family", "Maya", "4F9A2C1B", "https://x/join/?code=4F9A2C1B", "4D Ages", "rosa@gmail.com");
  const par = inviteMessage("parent", "Maya", "4F9A2C1B", "https://x/join/?code=4F9A2C1B", "4D Ages");
  ok("the invite says plainly what they can do: view only, or view and add", /view only/.test(fam) && !/add/.test(fam.split("\n")[0]) && /view and add/.test(par));
  ok("it's short: three lines, the link, and the code with who it's for", fam.split("\n").length === 3 && fam.length < 160 && fam.includes("rosa@gmail.com") && fam.includes("4F9A2C1B"));

  // ---- the family page, in the words of each theme
  ok("each theme names the family page its own way (Little Stars: The stars in your sky; Blossom: The birds that make you bloom)", FAMILY_TITLES.stars === "The stars in your sky" && FAMILY_TITLES.blossom === "The birds that make you bloom" && BOOK_STYLES.every((x) => FAMILY_TITLES[x.id]) && new Set(Object.values(FAMILY_TITLES)).size === BOOK_STYLES.length);
  ok("the book uses it instead of “The people who love you”", /<h2>\$\{esc\(FAMILY_TITLES\[style\]\)\}<\/h2>/.test(read("src/lib/bookHtml.ts")) && !/The people who love you<\/h2>/.test(read("src/lib/bookHtml.ts")));

  // ---- the book's name
  ok("the book is “Maya's Days” until she's two, then “Maya's Years”", bookName({ name: "Maya", birth: "2025-03-01" }, "2027-02-28") === "Maya's Days" && bookName({ name: "Maya", birth: "2025-03-01" }, "2027-03-01") === "Maya's Years" && bookName({ name: "Bump", birth: "2027-02-01", expecting: true }, "2026-10-11") === "Bump's Days");
  ok("the Book tab and the cover both use it", /<Heading title=\{bookName\(child, todayISO\(\)\)\}/.test(read("app/(tabs)/book.tsx")) && /bookName\(child, todayISO\(\)\)/.test(read("src/lib/bookHtml.ts")) && !/Keepsake book/.test(read("app/(tabs)/book.tsx").split("*/").slice(1).join("")));

  // ---- the date inside a picked file
  const ascii = (s: string) => Uint8Array.from(Buffer.from(s, "latin1"));
  ok("a photo's EXIF date is found in the file (the earliest one: when it was taken, not when it was edited)", exifDateIn(ascii("\xff\xd8junk2024:06:01 09:00:00\0more2024:05:17 10:11:12\0"), "2026-10-11") === "2024-05-17" && exifDateIn(ascii("0000:00:00 00:00:00 2031:01:01 00:00:00"), "2026-10-11") === null && exifDateIn(ascii("no dates here"), "2026-10-11") === null);
  const mvhd = (v: number, secs: number) => { const b = new Uint8Array(32); b.set(ascii("mvhd"), 4); b[8] = v; const at = 12; if (v === 1) { const big = BigInt(secs); for (let i = 0; i < 8; i++) b[at + i] = Number((big >> BigInt(8 * (7 - i))) & BigInt(255)); } else { b[at] = (secs >>> 24) & 255; b[at + 1] = (secs >>> 16) & 255; b[at + 2] = (secs >>> 8) & 255; b[at + 3] = secs & 255; } return b; };
  const secsFor = (iso: string) => Math.round(new Date(iso + "T12:00:00").getTime() / 1000) + 2082844800;
  ok("a video's recording date is found in its movie header (both header versions; an unset date is ignored)", videoDateIn(mvhd(0, secsFor("2025-08-09")), "2026-10-11") === "2025-08-09" && videoDateIn(mvhd(1, secsFor("2024-12-31")), "2026-10-11") === "2024-12-31" && videoDateIn(mvhd(0, 0), "2026-10-11") === null);
  ok("the picker uses it when the picker gives no date, so a photo isn't dated today by mistake", /const fromFile = found \? null : readFileDate\(uri, kind, todayISO\(\)\)/.test(read("src/lib/media.ts")) && /dated: !!\(found \|\| fromFile\)/.test(read("src/lib/media.ts")));

  // ---- a newer version
  ok("versions compare properly (1.0.10 is newer than 1.0.9)", isNewer("v1.0.7", "1.0.6") && isNewer("1.0.10", "1.0.9") && isNewer("2.0.0", "1.9.9") && !isNewer("v1.0.6", "1.0.6") && !isNewer("1.0.5", "1.0.6"));
  const rel = releaseOf({ tag_name: "v1.0.7", html_url: "https://g/r", assets: [{ name: "4d-ages-1.0.7.apk.sha256", browser_download_url: "https://g/sha" }, { name: "4d-ages-1.0.7.apk", browser_download_url: "https://g/apk" }] });
  ok("the latest release's APK is offered (drafts and pre-releases never are)", rel?.version === "1.0.7" && rel.apkUrl === "https://g/apk" && releaseOf({ tag_name: "v9", prerelease: true }) === null);
  ok("offered when newer; after Later, not again for a day (a newer version is offered straight away)", shouldOffer(rel, "1.0.6", null, 0) && !shouldOffer(rel, "1.0.7", null, 0) && !shouldOffer(rel, "1.0.6", { version: "1.0.7", at: 0 }, ASK_AGAIN_MS - 1) && shouldOffer(rel, "1.0.6", { version: "1.0.7", at: 0 }, ASK_AGAIN_MS) && shouldOffer(rel, "1.0.6", { version: "1.0.6", at: 0 }, 1));
  ok("the check runs when the app opens, and Settings, About can check by hand", /<UpdatePrompt \/>/.test(read("app/_layout.tsx")) && /Check for updates/.test(read("src/components/AboutCard.tsx")));

  // ---- more than one account on a phone
  const disk = new Map<string, string>();
  const kv = { getItem: async (k: string) => disk.get(k) ?? null, setItem: async (k: string, v: string) => { disk.set(k, v); }, removeItem: async (k: string) => { disk.delete(k); } };
  const aState = { kids: [{ id: "maya" }], activeId: "maya", memories: [{ id: "m1", childId: "maya", dirty: true }], appearance: "dark" } as Record<string, unknown>;
  const toB = await swapAccounts(kv, "store", 6, aState, "A", "B", (x) => x);
  ok("another account signing in: the first account's books are set aside on the phone (even what wasn't uploaded yet)", disk.has(accountKey("store", "A")) && JSON.parse(disk.get(accountKey("store", "A"))!).state.memories[0].id === "m1" && (toB.next.kids as unknown[]).length === 0 && !("appearance" in toB.next));
  await toB.done();
  const bState = { ...aState, ...toB.next, kids: [{ id: "noa" }], activeId: "noa" };
  const backToA = await swapAccounts(kv, "store", 6, bState, "B", "A", (x) => x);
  await backToA.done();
  ok("…and come back when they sign in again (and the other account's are set aside in turn)", (backToA.next.kids as { id: string }[])[0].id === "maya" && (backToA.next.memories as { id: string }[])[0].id === "m1" && !disk.has(accountKey("store", "A")) && disk.has(accountKey("store", "B")));
  ok("only the account's books move; the phone's settings stay", ACCOUNT_FIELDS.every((k) => !["appearance", "appLock", "notif", "heightUnit", "weightUnit", "growthChart"].includes(k)));
  const sm = read("src/components/SyncManager.tsx");
  ok("nobody is signed out or told the phone belongs to another account", /await useStore\.getState\(\)\.switchAccount\(userId\)/.test(sm) && !/Another account's book is on this phone/.test(sm) && !/signOut/.test(sm));
  ok("a book still has at most two parents", /MAX_PARENTS = 2/.test(read("src/lib/sync.ts")));

  // ---- deleting a profile
  const schema = read("supabase/schema.sql"), screen = read("src/components/Screen.tsx");
  ok("deleting a profile: the creator deletes it (or hands it to the other parent, if they're in it); anyone else just leaves", /create or replace function public\.delete_child\(p_child text\)/.test(schema) && /return 'handed'/.test(schema) && /return 'left'/.test(schema) && /grant execute on function public\.delete_child\(text\) to authenticated/.test(schema) && /'delete_child'/.test(read("scripts/setup-database.mjs")));
  ok("the photos are removed too when the book is deleted for good", /if \(plan\.outcome === "deleted"\) \{[\s\S]*?cloudFiles\(childId\)/.test(read("src/lib/sync.ts")));
  ok("the profile has Share (opening the share screen once the sheet has closed) and Delete, confirmed twice when it can't be undone", /Share \{child\.name\}'s book/.test(screen) && /Delete \$\{child\.name\}'s profile/.test(screen) && /Delete for good/.test(screen) && /stays with \$\{keeper\}/.test(screen));

  console.log(fails ? `${fails} FAILED` : "all round-three tests passed");
  if (fails) process.exit(1);
})();
