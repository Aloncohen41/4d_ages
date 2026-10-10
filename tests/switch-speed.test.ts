/* Switching child must be quick: the feed is windowed, the data file isn't rewritten, and the page content never blocks the tap — without ever risking a write to the wrong child. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PAGE, windowKey, windowSize, growWindow, showAllWindow, hasMore } from "../src/lib/feedWindow";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");

// ---- the feed window
const k1 = windowKey("maya", "all", ""), k2 = windowKey("leo", "all", "");
let w = { key: k1, n: PAGE };
ok("a long history starts with just the newest page (20), not all of it", windowSize(w, k1) === 20 && PAGE === 20);
const total = 500;
let rounds = 0; while (hasMore(total, windowSize(w, k1))) { w = growWindow(w, k1, total); rounds++; }
ok("scrolling toward the end adds a page at a time until everything is shown (500 posts → 25 rounds), never beyond the total", rounds === 24 && windowSize(w, k1) === 500 && growWindow(w, k1, total).n === 500);
ok("switching to another child starts again from the newest page (the other child's window doesn't carry over)", windowSize(w, k2) === 20);
ok("changing the category filter or the date range also starts again", windowSize({ key: windowKey("maya", "all", ""), n: 200 }, windowKey("maya", "story", "")) === 20 && windowSize({ key: windowKey("maya", "all", ""), n: 200 }, windowKey("maya", "all", "June 2026")) === 20);
ok("“Jump to the beginning” shows everything at once", showAllWindow(k1, 500).n === 500 && !hasMore(500, showAllWindow(k1, 500).n));
ok("a short history shows all of it from the start (nothing to load)", !hasMore(7, windowSize({ key: "x", n: 20 }, "x")) && growWindow({ key: k1, n: 20 }, k1, 7).n >= 7);
const cardsMountedOnSwitch = (history: number) => Math.min(history, windowSize({ key: "other", n: 999 }, k1));
ok("so switching to a child with 800 posts builds 20 cards instead of 800 (40× fewer, ~30 elements each)", cardsMountedOnSwitch(800) === 20 && 800 / cardsMountedOnSwitch(800) === 40);

// ---- the wiring
const home = read("app/(tabs)/index.tsx"), screen = read("src/components/Screen.tsx"), store = read("src/lib/store.ts");
ok("Home builds only the visible window of posts, adds more near the end, and has a button as a fallback", /list\.slice\(0, n\)/.test(home) && /useNearEnd\(\(\) => \{ if \(hasMore\) more\(\); \}\)/.test(home) && /Show older posts/.test(home) && /for \(const p of shown\)/.test(home));
ok("“Jump to the beginning” loads everything first, then scrolls (twice, in case pictures change the height)", /showAllWindow\(key, list\.length\)/.test(home) && (home.match(/setTimeout\(scroll\.toBottom/g) || []).length === 2 && /onPress=\{jumpToStart\}/.test(home));
ok("the page scroller reports when you are near the end, and when the content is too short to scroll", /subscribeNearEnd/.test(screen) && /onScroll=/.test(screen) && /onContentSizeChange=/.test(screen));
ok("the saved-data file is written through the skip-selection-only storage", /createDataStorage\(AsyncStorage/.test(store) && !/createJSONStorage/.test(store));

// who may use the deferred child: page content only
const pageFiles = ["app/(tabs)/index.tsx", "app/(tabs)/milestones.tsx", "app/(tabs)/growth.tsx", "app/family.tsx", "app/(tabs)/book.tsx", "src/components/MilestoneChecklist.tsx", "src/components/Memories.tsx"];
ok("page content (Home, Milestones, Growth, Family, Book, the checklist, the banners) uses the deferred child", pageFiles.every((f) => /useShownChild\(\)/.test(read(f)) && !/useActiveChild/.test(read(f))));
const heroFn = screen.slice(screen.indexOf("function Hero()"), screen.indexOf("/** Tap the age"));
ok("the profile card uses the deferred child", /useShownChild\(\)/.test(heroFn));
const writers = ["src/components/EntrySheet.tsx", "src/components/EditPhotoSheet.tsx", "src/components/ShareSheet.tsx", "src/components/ImportSheet.tsx", "src/components/TagBrowser.tsx", "src/components/CollectionSheet.tsx", "src/components/ReinforceSheet.tsx", "src/components/RemindersCard.tsx", "src/components/Fab.tsx", "src/lib/addPhotos.ts", "src/lib/saveMilestone.ts"];
ok("everything that SAVES data keeps the immediate selection: no sheet, form, import or + button can ever target a stale child", writers.every((f) => !/useShownChild/.test(read(f))));
const topBar = screen.slice(screen.indexOf("export function TopBar()"), screen.indexOf("export function Screen("));
ok("the top bar (the chips) responds at once: it uses the immediate selection", /useActiveChild\(\)/.test(topBar) && !/useShownChild/.test(topBar));
ok("while the new child's pages are being prepared the page dims AND ignores taps", /useChildSwitching\(\)/.test(screen) && /opacity: switching \? 0\.45 : 1/.test(screen) && /pointerEvents=\{switching \? "none" : "auto"\}/.test(screen));
ok("the deferred child is React's own useDeferredValue (time-sliced; the tap is never blocked)", /return useDeferredValue\(useActiveChild\(\)\)/.test(store) && /selected\?\.id !== shown\?\.id/.test(store));
console.log(fails ? `${fails} FAILED` : "all switch-speed tests passed");
