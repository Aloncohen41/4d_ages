/*
 * The tests read the app's code to check the words on screen. Those words now go through tr() (see src/lib/i18n.ts), so this shows the code
 * as written in English again before it's checked: {tr("Add")} → Add, label={tr("Add")} → label="Add", tr("{0}'s book", [name]) →
 * `${name}'s book`, get label() { return tr("All"); } → label: "All". Only for reading in tests.
 */

/** The text from `open` (an opening bracket) to its matching close, honouring strings. Returns the index after the close. */
function matchClose(s: string, open: number): number {
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const stack: string[] = [];
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < s.length && s[i] !== c; i++) if (s[i] === "\\") i++;
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack[stack.length - 1]) { stack.pop(); if (!stack.length) return i + 1; }
  }
  return s.length;
}

/** Splits "a, f(b, c), d" at its top-level commas. */
function splitTop(s: string): string[] {
  const out: string[] = []; let depth = 0, cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === "`") { let j = i + 1; for (; j < s.length && s[j] !== c; j++) if (s[j] === "\\") j++; cur += s.slice(i, j + 1); i = j; continue; }
    if ("([{".includes(c)) depth++;
    if (")]}".includes(c)) depth--;
    if (c === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function untr(src: string): string {
  if (!/\btr\(/.test(src)) return src;
  let s = src.replace(/get (\w+)\(\) \{ return (tr\([\s\S]*?\)); \}/g, (_m, name, call) => `${name}: ${call}`);
  let out = "";
  let i = 0;
  const re = /\btr\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const start = m.index, open = start + 2, end = matchClose(s, open);
    const args = splitTop(s.slice(open + 1, end - 1));
    let english: string;
    try { english = JSON.parse(args[0]); } catch { continue; }
    const vars = args[1] ? splitTop(args[1].replace(/^\[|\]$/g, "")) : [];
    // where the call sits: {tr(…)} as a child, ={tr(…)} as a prop, or anywhere else
    const before = s.slice(0, start), after = s.slice(end);
    // (inside a template string, ${tr(…)} is a value, not words on screen)
    const asChild = /(^|[^$])\{\s*$/.test(before) && /^\s*\}/.test(after) && !/=\s*\{\s*$/.test(before);
    const asProp = /=\{\s*$/.test(before) && /^\s*\}/.test(after);
    let by: string; let from = start, to = end;
    if (asChild) {
      by = english.replace(/\{(\d+)\}/g, (_x, k) => `{${vars[Number(k)] ?? ""}}`);
      from = before.lastIndexOf("{"); to = end + after.indexOf("}") + 1;
    } else if (asProp && !vars.length) {
      by = JSON.stringify(english);
      from = before.lastIndexOf("{"); to = end + after.indexOf("}") + 1;
    } else if (vars.length) {
      by = "`" + english.replace(/`/g, "\\`").replace(/\{(\d+)\}/g, (_x, k) => "${" + (vars[Number(k)] ?? "") + "}") + "`";
    } else by = JSON.stringify(english);
    if (/\btr\(/.test(by)) by = untr(by); // a translation inside another one's values
    out += s.slice(i, from) + by;
    i = to;
    re.lastIndex = to;
  }
  return out + s.slice(i);
}
