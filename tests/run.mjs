// Runs every logic test (no phone needed): npm test
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const files = readdirSync(new URL(".", import.meta.url)).filter((f) => f.endsWith(".test.ts")).sort();
let bad = 0;
for (const f of files) {
  const r = spawnSync("npx", ["tsx", `tests/${f}`], { encoding: "utf8", shell: process.platform === "win32" });
  const out = (r.stdout || "") + (r.stderr || "");
  const passed = /passed/.test(out) && !/FAIL /.test(out) && !/FAILED/.test(out) && r.status === 0;
  console.log(`${passed ? "✓" : "✗"} ${f}`);
  if (!passed) { bad++; console.log(out.split("\n").filter((l) => /FAIL|rror/.test(l)).join("\n")); }
}
console.log(bad ? `\n${bad} of ${files.length} test files failed` : `\nAll ${files.length} test files passed`);
process.exit(bad ? 1 : 0);
