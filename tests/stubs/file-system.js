// A tiny in-memory stand-in for expo-file-system, used only by tests: files exist only if a test put them in `__files`.
const files = new Map();
const join = (parts) => parts.map((p, i) => (typeof p === "string" ? p : p.uri)).map((p, i) => (i === 0 ? p : p.replace(/^\/+/, ""))).map((p, i, a) => (i < a.length - 1 ? p.replace(/\/+$/, "") : p)).join("/");
class Directory {
  constructor(...parts) { this.uri = join(parts); }
  get exists() { return true; }
  create() {}
}
class File {
  constructor(...parts) { this.uri = join(parts); }
  get exists() { return files.has(this.uri); }
  copy(dest) { if (this.uri.includes("BROKEN")) throw new Error("disk error"); if (files.has(this.uri)) files.set(dest.uri, files.get(this.uri)); }
  delete() { files.delete(this.uri); }
}
module.exports = { File, Directory, Paths: { document: new Directory("file:///docs"), cache: new Directory("file:///cache") }, __files: files };
