/* "Open where I left off": the remembered child and tab, restored on launch; and an old notification tap can't override them. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TAB_NAMES, RESUME_KEY, isTab, tabPath, parseResume, createResume, pickChild, shouldHandleNotification, KeyValueStorage } from "../src/lib/resume";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");

/** an in-memory phone: shared between "launches" so we can close and reopen the app */
const phone = (): KeyValueStorage & { data: Record<string, string>; writes: number; fail?: boolean } => {
  const p: any = { data: {}, writes: 0, fail: false };
  p.getItem = async (k: string) => { if (p.fail) throw new Error("disk"); return p.data[k] ?? null; };
  p.setItem = async (k: string, v: string) => { if (p.fail) throw new Error("disk"); p.writes++; p.data[k] = v; };
  return p;
};
const wait = () => new Promise((r) => setTimeout(r, 5));

(async () => {
  // ---- remembering and reopening
  const disk = phone();
  const launch1 = createResume(disk); await launch1.load();
  launch1.save({ childId: "leo" }); launch1.save({ tab: "growth" });
  await wait();
  const launch2 = createResume(disk);                               // the app is closed and opened again
  const r = await launch2.load();
  ok("after closing and reopening, the child and the tab are exactly as left (child “leo”, tab “growth”)", r.childId === "leo" && r.tab === "growth");
  launch2.save({ tab: "family" }); await wait();
  ok("saving one thing keeps the other (changing the tab doesn't forget the child)", JSON.parse(disk.data[RESUME_KEY]).childId === "leo" && JSON.parse(disk.data[RESUME_KEY]).tab === "family");
  ok("it is written immediately on every change (not batched), as a few bytes", disk.writes === 3 && disk.data[RESUME_KEY].length < 120);
  ok("it is its own small record, not the big saved-data file", RESUME_KEY === "4d-ages-resume-v1" && RESUME_KEY !== "4d-ages-v1");

  // ---- never breaks the app
  const empty = createResume(phone()); ok("a first launch (nothing saved) just gives an empty record", JSON.stringify(await empty.load()) === "{}");
  const broken = phone(); broken.data[RESUME_KEY] = "{not json"; ok("a damaged record is ignored, not a crash", JSON.stringify(await createResume(broken).load()) === "{}");
  const odd = parseResume(JSON.stringify({ childId: 42, tab: "settings", handledNotification: "" }));
  ok("unexpected values are dropped (a child that isn't text, a tab that doesn't exist)", JSON.stringify(odd) === "{}");
  const down = phone(); down.fail = true; const dead = createResume(down);
  ok("a phone whose storage fails still opens (and saving never throws or waits)", JSON.stringify(await dead.load()) === "{}" && (dead.save({ tab: "book" }), dead.get().tab === "book"));

  // ---- which child opens
  ok("opens the child you were last on", pickChild(["maya", "leo"], "leo", "maya") === "leo");
  ok("…not just the first one", pickChild(["maya", "leo"], "leo", undefined) !== "maya");
  ok("if that child was removed, it falls back to the one the saved data had selected", pickChild(["maya", "leo"], "gone", "leo") === "leo");
  ok("if neither exists, the first child; with no children, nothing", pickChild(["maya", "leo"], "x", "y") === "maya" && pickChild([], "x", "y") === undefined);

  // ---- which tab opens
  ok("tabs are the six real ones; paths map to the routes (Home is “/”)", TAB_NAMES.length === 6 && tabPath("index") === "/" && tabPath("milestones") === "/milestones" && isTab("book") && !isTab("settings") && !isTab(undefined));

  // ---- the bug: an old notification tap must not drag you back to its child
  const day = phone(); const app = createResume(day); await app.load();
  app.save({ childId: "maya" });                                                   // Maya was selected…
  ok("a notification tap that hasn't been acted on is acted on", shouldHandleNotification("n1", app.get().handledNotification));
  app.save({ handledNotification: "n1" });                                         // …you tapped a notification for Maya; the app acted on it once
  app.save({ childId: "leo" }); await wait();                                      // later you switched to Leo and closed the app
  const next = createResume(day); const r2 = await next.load();
  const open = pickChild(["maya", "leo"], r2.childId, "maya");
  ok("next launch opens Leo, where you left off", open === "leo");
  ok("Android hands the SAME old tap back (restoring from recents): it is recognised and ignored, so Leo stays", shouldHandleNotification("n1", r2.handledNotification) === false);
  ok("a genuinely new notification tap is still acted on", shouldHandleNotification("n2", r2.handledNotification) === true);
  ok("a tap with no id (or none at all) does nothing", !shouldHandleNotification(undefined, undefined));

  // ---- the wiring
  const rootSrc = read("app/_layout.tsx"), tabsSrc = read("app/(tabs)/_layout.tsx");
  ok("the app isn't shown until the record has been read and applied (no flash of the wrong child)", /const ready = \(fontsLoaded \|\| !!fontError\) && hydrated && resumed;/.test(rootSrc) && /if \(!ready\) return <BrandScreen \/>/.test(rootSrc) && /resume\.load\(\)/.test(rootSrc) && /pickChild\(/.test(rootSrc));
  ok("every change of child is saved straight away", /useStore\.subscribe\(\(s, p\) => \{[\s\S]*activeId !== p\.activeId[\s\S]*resume\.save\(\{ childId/.test(rootSrc));
  ok("notification taps are acted on once and then cleared (no replays)", /shouldHandleNotification\(nid, resume\.get\(\)\.handledNotification\)/.test(rootSrc) && /resume\.save\(\{ handledNotification: nid \}\)/.test(rootSrc) && /clearLastNotificationResponseAsync/.test(rootSrc));
  ok("notification taps wait until the screens exist (they used to navigate while the app was still loading)", /if \(!ready \|\| !d \|\| !d\.childId/.test(rootSrc) && /\[response, ready\]/.test(rootSrc));
  ok("the current tab is saved whenever it changes", /resume\.save\(\{ tab: current \}\)/.test(tabsSrc));
  ok("…but not while the saved tab is still being restored (or Home would overwrite it)", /if \(restoreTo\) \{[\s\S]*return;\s*\}\s*if \(isTab\(current\)\) resume\.save/.test(tabsSrc));
  ok("the saved tab is restored without animation, hidden behind a cover that matches the splash, with a timeout so it can't stick", /animationEnabled: !restoring/.test(tabsSrc) && /restoring \? <View style=\{StyleSheet\.absoluteFill\}><BrandScreen \/>/.test(tabsSrc) && /setTimeout\(\(\) => setRestoring\(false\), 1500\)/.test(tabsSrc));
  ok("a first launch (no saved tab) restores nothing and shows no cover", /useState\(saved !== "index"\)/.test(tabsSrc));
  ok("the persisted data is unchanged (the saved-data key and shape are untouched)", /const STORE_KEY = "4d-ages-v1";/.test(read("src/lib/store.ts")) && /activeId: s\.activeId,/.test(read("src/lib/store.ts")));
  console.log(fails ? `${fails} FAILED` : "all open-where-I-left-off tests passed");
  process.exit(fails ? 1 : 0);
})();
