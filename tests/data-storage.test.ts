/* Switching child must not rewrite the whole saved-data file; every real change still must be saved. */
import { createDataStorage, onlySelectionChanged, KeyValue } from "../src/lib/dataStorage";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };

const disk = () => { const d: any = { data: {} as Record<string, string>, writes: 0, bytes: 0, reads: 0 };
  d.getItem = async (k: string) => { d.reads++; return d.data[k] ?? null; };
  d.setItem = async (k: string, v: string) => { d.writes++; d.bytes += v.length; d.data[k] = v; };
  d.removeItem = async (k: string) => { delete d.data[k]; }; return d as KeyValue & typeof d; };
const memories = Array.from({ length: 2000 }, (_, i) => ({ id: "m" + i, childId: i % 2 ? "maya" : "leo", description: "x".repeat(150) }));
const base = () => ({ kids: [{ id: "maya" }, { id: "leo" }], activeId: "maya", memories, tags: [], relatives: [], notif: { enabled: false } });

(async () => {
  // the pure rule
  const a = base();
  ok("only the selection differing → nothing worth saving", onlySelectionChanged(a, { ...a, activeId: "leo" }));
  ok("a new memory (new array) → worth saving", !onlySelectionChanged(a, { ...a, memories: [...a.memories, { id: "new", childId: "maya", description: "" }] }));
  ok("a changed setting → worth saving", !onlySelectionChanged(a, { ...a, notif: { enabled: true } }));
  ok("a key added or removed → worth saving", !onlySelectionChanged(a, { ...a, extra: 1 }) && !onlySelectionChanged(a, { kids: a.kids, activeId: "maya", memories: a.memories }));
  ok("selection AND data changing together → worth saving (the new selection travels with it)", !onlySelectionChanged(a, { ...a, activeId: "leo", kids: [...a.kids, { id: "z" }] }));

  // the real flow, on a pretend phone
  const kv = disk(); kv.data["k"] = JSON.stringify({ state: base(), version: 5 });
  const seen: string[] = [];
  const st = createDataStorage(kv, async (_n, raw) => { seen.push(raw ? "backup-check" : "empty"); });
  const loaded = await st.getItem("k");
  ok("opening reads the file, runs the safety-backup check first, and returns the saved state", loaded?.version === 5 && loaded.state.memories.length === 2000 && seen.join() === "backup-check");
  const S = loaded!.state;

  const w0 = kv.writes;
  for (let i = 0; i < 20; i++) await st.setItem("k", { state: { ...S, activeId: i % 2 ? "maya" : "leo" }, version: 5 });
  ok("switching child 20 times writes NOTHING to the saved-data file (it used to write all 2,000 memories each time)", kv.writes === w0);

  // like the real store: a change produces a NEW state object whose unchanged slices are the very same objects as before
  const afterAdd = { ...S, memories: [...S.memories, { id: "n1", childId: "maya", description: "a new memory" }] };
  await st.setItem("k", { state: afterAdd, version: 5 });
  ok("adding a memory still saves, immediately", kv.writes === w0 + 1 && JSON.parse(kv.data["k"]).state.memories.length === 2001);

  const w1 = kv.writes;
  await st.setItem("k", { state: { ...afterAdd, activeId: "leo" }, version: 5 });
  ok("after a real save, selection-only changes are still skipped (compared with what was last written)", kv.writes === w1);
  const afterDelete = { ...afterAdd, activeId: "leo", memories: afterAdd.memories.slice(1) };
  await st.setItem("k", { state: afterDelete, version: 5 });
  ok("a deletion saves", kv.writes === w1 + 1 && JSON.parse(kv.data["k"]).state.memories.length === 2000);

  // nothing is ever lost
  const reopened = await createDataStorage(kv).getItem("k");
  ok("reopening gives back exactly the last real save (nothing lost by skipping selection-only writes)", reopened!.state.memories.length === 2000 && reopened!.state.kids.length === 2);
  const fresh = createDataStorage(disk());
  ok("a brand-new install (no file): reads nothing, and the first save always writes", (await fresh.getItem("k")) === null);
  const k2 = disk(); const f2 = createDataStorage(k2); await f2.getItem("k"); await f2.setItem("k", { state: base(), version: 5 });
  ok("…the very first save after an empty start is written", k2.writes === 1);
  const k3 = disk(); const f3 = createDataStorage(k3); await f3.setItem("k", { state: base(), version: 5 }); await f3.removeItem("k"); await f3.setItem("k", { state: base(), version: 5 });
  ok("after the data is erased, the next save writes again", k3.writes === 2);
  console.log(fails ? `${fails} FAILED` : "all data-storage tests passed"); process.exit(fails ? 1 : 0);
})();
