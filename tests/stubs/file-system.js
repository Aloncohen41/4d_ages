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
  get size() { return files.has(this.uri) ? String(files.get(this.uri)).length : null; }
  // like the real one (SDK 57): the copy finishes a moment later, reading the source then, so deleting the source first leaves nothing
  copy(dest) {
    if (this.uri.includes("BROKEN")) return Promise.reject(new Error("disk error"));
    const from = this.uri;
    return new Promise((resolve, reject) => setTimeout(() => { if (!files.has(from)) return reject(new Error("ENOENT: " + from)); files.set(dest.uri, files.get(from)); resolve(); }, 5));
  }
  delete() { files.delete(this.uri); }
}
module.exports = { File, Directory, Paths: { document: new Directory("file:///docs"), cache: new Directory("file:///cache") }, __files: files };
