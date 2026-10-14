/*
 * Making a video on the website. The phone draws each frame and encodes it (SlideshowEncoder.kt); a browser can't encode frame by frame, so
 * here the same video is drawn on a canvas as it plays and recorded (MediaRecorder), with the music and the clips' own sound mixed in (Web
 * Audio). It's the same payload and the same looks, drawn the same way: Classic, Story, Snapshots and Journal, cards of words, the journey's
 * map, and videos that play. Recording takes as long as the video lasts, so the page shows the progress.
 */

type Json = Record<string, unknown>;
interface Item {
  kind: "photo" | "intro" | "card" | "map" | "clip";
  img?: HTMLImageElement | null;
  video?: HTMLVideoElement;
  emoji: string; bg: string; hill: string; age: string; date: string; caption: string;
  pins?: { x: number; y: number; fresh: boolean }[];
  clipStart: number; start: number; dur: number;
}

let cancelled = false;
export function cancelWebVideo() {
  cancelled = true;
}
export const webVideoSupported = () => typeof document !== "undefined" && typeof MediaRecorder !== "undefined" && !!document.createElement("canvas").captureStream;

const loadImage = (src?: string | null): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const loadVideo = (src: string, start: number): Promise<HTMLVideoElement | null> =>
  new Promise((resolve) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.playsInline = true;
    v.preload = "auto";
    v.src = src;
    v.onloadeddata = () => { v.currentTime = start / 1000; resolve(v); };
    v.onerror = () => resolve(null);
  });

const ease3 = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);

/** Lines of text that fit a width, at most `max` of them (the last ends with … if cut). */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else { lines.push(line); line = w; if (lines.length === max) break; }
  }
  if (lines.length < max && line) lines.push(line);
  if (lines.length === max && words.join(" ").length > lines.join(" ").length) {
    let last = lines[max - 1];
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    lines[max - 1] = `${last}…`;
  }
  return lines;
}

export async function recordWebVideo(payload: Json, onProgress: (p: number) => void): Promise<Blob> {
  cancelled = false;
  const w = payload.width as number, h = payload.height as number, fps = (payload.fps as number) || 30;
  const per = payload.perMs as number, fadeMs = payload.fadeMs as number, driftMs = (payload.driftMs as number) ?? per * 1.6;
  const template = (payload.template as string) || "classic";
  const cardBg = (payload.cardBg as string) || "#FFF8F0", cardInk = (payload.cardInk as string) || "#3D2630", accent = (payload.accent as string) || "#C0587E";
  const keepClipSound = payload.clipSound !== false;
  const items: Item[] = [];
  const intro = payload.intro as Json | null;
  const introMs = (payload.introMs as number) || 0;
  if (intro && introMs > 0) items.push({ kind: "intro", img: await loadImage(intro.cover as string | undefined), emoji: (intro.emoji as string) ?? "📖", bg: (intro.bg as string) ?? "#FEFBF6", hill: (intro.ink as string) ?? "#3D2630", age: (intro.title as string) ?? "", date: "", caption: (intro.subtitle as string) ?? "", clipStart: 0, start: 0, dur: introMs });
  for (const o of payload.items as Json[]) {
    if (o.card) { items.push({ kind: "card", emoji: "", bg: cardBg, hill: accent, age: (o.kicker as string) ?? "", date: "", caption: (o.text as string) ?? "", clipStart: 0, start: 0, dur: (o.ms as number) ?? per * 1.4 }); continue; }
    const base = { emoji: (o.emoji as string) ?? "📷", bg: (o.bg as string) ?? "#FBE4D4", hill: (o.hill as string) ?? "#E9A27A", age: (o.age as string) ?? "", date: (o.date as string) ?? "", caption: (o.caption as string) ?? "" };
    const img = await loadImage(o.uri as string | null);
    if (o.clip) {
      const start = (o.clipStartMs as number) ?? 0;
      const video = await loadVideo(o.clip as string, start);
      if (video && isFinite(video.duration)) {
        const dur = Math.min((o.clipMs as number) ?? 30000, video.duration * 1000 - start);
        if (dur >= 500) { items.push({ kind: "clip", img, video, ...base, clipStart: start, start: 0, dur }); continue; }
      }
    }
    items.push({ kind: o.pins ? "map" : "photo", img, ...base, pins: o.pins as Item["pins"], clipStart: 0, start: 0, dur: per });
  }
  if (!items.length) throw new Error("Nothing to put in the video.");
  let t0 = 0;
  for (const it of items) { it.start = t0; t0 += it.dur; }
  const total = t0;

  // the picture
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // the sound: the music (looped, in and out gently, quieter under a clip's own sound) and the clips
  const audio = new AudioContext();
  const out = audio.createMediaStreamDestination();
  const musicGain = audio.createGain();
  musicGain.connect(out);
  const clipsWithSound = keepClipSound ? items.filter((i) => i.kind === "clip") : [];
  if (payload.music) {
    try {
      const buf = await audio.decodeAudioData(await (await fetch(payload.music as string)).arrayBuffer());
      const src = audio.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(musicGain);
      src.start();
    } catch { /* no music rather than no video */ }
  }
  for (const c of clipsWithSound) {
    try {
      const node = audio.createMediaElementSource(c.video!);
      node.connect(out);
    } catch { /* a clip whose sound can't be read plays silently */ }
  }
  items.filter((i) => i.kind === "clip" && !clipsWithSound.includes(i)).forEach((i) => { i.video!.muted = true; });
  const vol = Number(payload.musicVolume ?? 0.8);
  const now0 = audio.currentTime;
  const g = musicGain.gain;
  g.setValueAtTime(0, now0);
  g.linearRampToValueAtTime(vol, now0 + 0.8);
  for (const c of clipsWithSound) {
    g.setValueAtTime(vol, now0 + Math.max(0.8, c.start / 1000 - 0.3));
    g.linearRampToValueAtTime(vol * 0.22, now0 + c.start / 1000);
    g.setValueAtTime(vol * 0.22, now0 + (c.start + c.dur) / 1000);
    g.linearRampToValueAtTime(vol, now0 + (c.start + c.dur) / 1000 + 0.3);
  }
  g.setValueAtTime(vol, now0 + Math.max(1, total / 1000 - 2.5));
  g.linearRampToValueAtTime(0, now0 + total / 1000);

  const stream = new MediaStream([...canvas.captureStream(fps).getVideoTracks(), ...out.stream.getAudioTracks()]);
  const type = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: Math.round(w * h * fps * 0.12) });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const finished = new Promise<void>((r) => (rec.onstop = () => r()));

  /* ---------- drawing (the same as the phone's) ---------- */
  const blurCache = new Map<HTMLImageElement | HTMLVideoElement, HTMLCanvasElement>();
  const backdrop = (src: CanvasImageSource & { width?: number }, key: HTMLImageElement | HTMLVideoElement, sw: number, sh: number) => {
    let b = blurCache.get(key);
    if (!b || key instanceof HTMLVideoElement) {
      b = b ?? document.createElement("canvas");
      b.width = Math.max(2, Math.round(sw / 24)); b.height = Math.max(2, Math.round(sh / 24));
      b.getContext("2d")!.drawImage(src, 0, 0, b.width, b.height);
      blurCache.set(key, b);
    }
    const s = Math.max(w / b.width, h / b.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(b, (w - b.width * s) / 2, (h - b.height * s) / 2, b.width * s, b.height * s);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, w, h);
  };
  const dims = (src: HTMLImageElement | HTMLVideoElement) => (src instanceof HTMLVideoElement ? [src.videoWidth, src.videoHeight] : [src.naturalWidth, src.naturalHeight]);
  const drawFit = (src: HTMLImageElement | HTMLVideoElement, zoom: number) => {
    const [iw, ih] = dims(src);
    if (!iw || !ih) return;
    backdrop(src, src, iw, ih);
    const k = 1 - (zoom - 1) * 0.5;
    const s = Math.min(w / iw, h / ih) * k;
    ctx.drawImage(src, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s);
  };
  const drawCover = (src: HTMLImageElement | HTMLVideoElement, zoom: number, dx = 0) => {
    const [iw, ih] = dims(src);
    if (!iw || !ih) return;
    const s = Math.max(w / iw, h / ih) * zoom;
    ctx.drawImage(src, (w - iw * s) / 2 + dx, (h - ih * s) / 2, iw * s, ih * s);
  };
  const placeholder = (it: Item, zoom: number) => {
    ctx.fillStyle = it.bg; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 90 / 255; ctx.fillStyle = it.hill;
    ctx.beginPath(); ctx.ellipse(w / 2, h, w * 0.6, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = `${Math.min(w, h) * 0.4 * zoom}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(it.emoji, w / 2, h * 0.44);
  };
  const scrim = (from: number, a = 175) => {
    const grd = ctx.createLinearGradient(0, h * from, 0, h);
    grd.addColorStop(0, "rgba(0,0,0,0)"); grd.addColorStop(1, `rgba(0,0,0,${a / 255})`);
    ctx.fillStyle = grd; ctx.fillRect(0, h * from, w, h * (1 - from));
  };
  const shadowed = (on: boolean) => { ctx.shadowColor = on ? "rgba(0,0,0,0.6)" : "transparent"; ctx.shadowBlur = on ? w * 0.012 : 0; ctx.shadowOffsetY = on ? w * 0.003 : 0; };
  const overlay = (it: Item) => {
    scrim(0.5);
    const margin = w * 0.07;
    let y = h - (h > w ? h * 0.085 : h * 0.055);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; shadowed(true);
    if (it.caption.trim()) {
      ctx.font = `${w * 0.04}px sans-serif`; ctx.fillStyle = "#fff";
      const lines = wrap(ctx, it.caption, w * 0.86, 3);
      const lh = w * 0.052;
      y -= lh * (lines.length - 1);
      lines.forEach((l, k) => ctx.fillText(l, margin, y + k * lh));
      y -= w * 0.06;
    }
    if (it.date) { ctx.font = `bold ${w * 0.03}px sans-serif`; ctx.fillStyle = "rgba(255,255,255,0.88)"; ctx.fillText(it.date, margin, y); }
    y -= w * 0.03 * 1.35;
    ctx.font = `bold ${w * 0.075}px Georgia, serif`; ctx.fillStyle = "#fff"; ctx.fillText(it.age, margin, y);
    shadowed(false);
  };
  const drawIntro = (it: Item) => {
    const tw = w * 0.8;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    if (it.img) {
      drawFit(it.img, 1); scrim(0.4);
      shadowed(true);
      ctx.font = `bold ${w * 0.085}px Georgia, serif`; ctx.fillStyle = "#fff";
      const title = wrap(ctx, it.age, tw, 3);
      ctx.font = `${w * 0.04}px sans-serif`;
      const sub = it.caption.trim() ? wrap(ctx, it.caption, tw, 3) : [];
      let y = h - (h > w ? h * 0.09 : h * 0.07) - sub.length * w * 0.052 - (title.length - 1) * w * 0.1;
      ctx.font = `bold ${w * 0.085}px Georgia, serif`;
      title.forEach((l, k) => ctx.fillText(l, w / 2, y + k * w * 0.1));
      y += (title.length - 1) * w * 0.1 + w * 0.07;
      ctx.font = `${w * 0.04}px sans-serif`; ctx.fillStyle = "rgba(255,255,255,0.9)";
      sub.forEach((l, k) => ctx.fillText(l, w / 2, y + k * w * 0.052));
      shadowed(false);
      return;
    }
    ctx.fillStyle = it.bg; ctx.fillRect(0, 0, w, h);
    ctx.font = `${Math.min(w, h) * 0.2}px sans-serif`; ctx.textBaseline = "middle"; ctx.fillText(it.emoji, w / 2, h * 0.36);
    ctx.textBaseline = "alphabetic";
    ctx.font = `bold ${w * 0.085}px Georgia, serif`; ctx.fillStyle = it.hill;
    const title = wrap(ctx, it.age, tw, 3);
    title.forEach((l, k) => ctx.fillText(l, w / 2, h * 0.5 + w * 0.085 + k * w * 0.1));
    ctx.font = `${w * 0.04}px sans-serif`; ctx.globalAlpha = 0.7;
    wrap(ctx, it.caption, tw, 3).forEach((l, k) => ctx.fillText(l, w / 2, h * 0.5 + w * 0.085 + title.length * w * 0.1 + w * 0.03 + k * w * 0.052));
    ctx.globalAlpha = 1;
  };
  const drawCard = (it: Item, local: number) => {
    ctx.fillStyle = cardBg; ctx.fillRect(0, 0, w, h);
    const e = ease3(local / 700);
    ctx.save(); ctx.globalAlpha = e;
    const long = it.caption.length;
    const size = w * (long > 220 ? 0.042 : long > 120 ? 0.05 : 0.062);
    ctx.font = `${size}px Georgia, serif`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const lines = wrap(ctx, it.caption, w * 0.78, 9);
    const lh = size * 1.3;
    const kick = it.age.trim();
    const total = lines.length * lh + (kick ? w * 0.09 : 0);
    let y = (h - total) / 2 + (1 - e) * h * 0.03;
    if (kick) {
      ctx.font = `bold ${w * 0.03}px sans-serif`; ctx.fillStyle = accent;
      ctx.fillText(kick.toUpperCase().split("").join(" "), w / 2, y + w * 0.03);
      ctx.fillRect(w / 2 - w * 0.04, y + w * 0.055, w * 0.08, w * 0.003);
      y += w * 0.09;
    }
    ctx.font = `${size}px Georgia, serif`; ctx.fillStyle = cardInk;
    lines.forEach((l, k) => ctx.fillText(l, w / 2, y + size + k * lh));
    ctx.restore();
  };
  const drawMap = (it: Item, local: number) => {
    ctx.fillStyle = "#ECF1F3"; ctx.fillRect(0, 0, w, h);
    let left = 0, top = 0, mw = w, mh = h;
    if (it.img) {
      const s = Math.min(w / it.img.naturalWidth, (h * 0.78) / it.img.naturalHeight);
      mw = it.img.naturalWidth * s; mh = it.img.naturalHeight * s;
      left = (w - mw) / 2; top = (h - mh) / 2 - h * 0.06;
      ctx.drawImage(it.img, left, top, mw, mh);
    }
    const r = Math.min(w, h) * 0.018;
    const pins = it.pins ?? [];
    ctx.fillStyle = it.hill;
    for (const p of pins.filter((q) => !q.fresh)) { ctx.globalAlpha = 120 / 255; ctx.beginPath(); ctx.arc(left + p.x * mw, top + p.y * mh, r * 0.8, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    const fresh = pins.filter((q) => q.fresh);
    const stagger = fresh.length ? Math.min(450, (per * 0.55) / fresh.length) : 0;
    fresh.forEach((p, k) => {
      const t = Math.min(1, Math.max(0, (local - 250 - k * stagger) / 380));
      if (t <= 0) return;
      const pop = t < 0.7 ? (t / 0.7) * 1.25 : 1.25 - ((t - 0.7) / 0.3) * 0.25;
      const cx = left + p.x * mw, cy = top + p.y * mh;
      const ring = Math.min(1, Math.max(0, (local - 250 - k * stagger) / 900));
      ctx.strokeStyle = it.hill; ctx.lineWidth = r * 0.35; ctx.globalAlpha = (1 - ring) * 0.8;
      ctx.beginPath(); ctx.arc(cx, cy, r * (1.2 + ring * 2.6), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, r * 1.25 * pop, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = it.hill; ctx.beginPath(); ctx.arc(cx, cy, r * pop, 0, Math.PI * 2); ctx.fill();
    });
    overlay(it);
  };
  const storyOverlay = (it: Item, alpha: number) => {
    if (alpha <= 0.01) return;
    ctx.save(); ctx.globalAlpha = alpha;
    scrim(0.45);
    const margin = w * 0.07;
    let y = h - (h > w ? h * 0.09 : h * 0.065);
    ctx.textAlign = "left"; shadowed(true);
    if (it.caption.trim()) {
      ctx.font = `bold ${w * 0.058}px sans-serif`; ctx.fillStyle = "#fff";
      const lines = wrap(ctx, it.caption, w * 0.86, 2);
      y -= (lines.length - 1) * w * 0.07;
      lines.forEach((l, k) => ctx.fillText(l, margin, y + k * w * 0.07));
      y -= w * 0.075;
    }
    const line = [it.age, it.date].filter(Boolean).join("  ·  ").toUpperCase();
    ctx.font = `bold ${w * 0.03}px sans-serif`; ctx.fillStyle = "rgba(255,255,255,0.88)";
    if (line) ctx.fillText(line, margin, y);
    shadowed(false); ctx.restore();
  };
  const snapAngle = (i: number) => [-3.2, 2.6, -1.4, 3.4, -2.4, 1.6][i % 6];
  const drawSnapshot = (i: number, it: Item, src: HTMLImageElement | HTMLVideoElement | null | undefined, enter: number) => {
    const fw = Math.min(w, h) * 0.8, pad = fw * 0.05, pw = fw - pad * 2;
    const [iw, ih] = src ? dims(src) : [1, 1];
    const ph = pw * (ih > iw ? 1.18 : 0.86);
    const fh = ph + pad + fw * 0.2;
    const e = enter < 0 ? 1 : ease3(enter / 650);
    ctx.save();
    ctx.translate(w / 2 + (1 - e) * w * 0.55, h / 2 + (1 - e) * h * 0.25);
    ctx.rotate(((snapAngle(i) + (1 - e) * 14) * Math.PI) / 180);
    ctx.fillStyle = "rgba(0,0,0,0.27)"; ctx.fillRect(-fw / 2 + w * 0.006, -fh / 2 + w * 0.01, fw, fh);
    ctx.fillStyle = "#fff"; ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
    const left = -fw / 2 + pad, top = -fh / 2 + pad;
    if (src && iw && ih) {
      ctx.save(); ctx.beginPath(); ctx.rect(left, top, pw, ph); ctx.clip();
      const s = Math.max(pw / iw, ph / ih);
      ctx.drawImage(src, left + (pw - iw * s) / 2, top + (ph - ih * s) / 2, iw * s, ih * s);
      ctx.restore();
    } else {
      ctx.fillStyle = it.bg; ctx.fillRect(left, top, pw, ph);
      ctx.font = `${pw * 0.35}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(it.emoji, left + pw / 2, top + ph / 2);
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.font = `${fw * 0.06}px "Comic Sans MS", "Segoe Print", cursive`; ctx.fillStyle = "#3A3340";
    const words = it.caption.trim() || [it.age, it.date].filter(Boolean).join(" · ");
    wrap(ctx, words, pw, 2).forEach((l, k) => ctx.fillText(l, left, top + ph + fw * 0.09 + k * fw * 0.07));
    if (it.caption.trim()) {
      ctx.font = `${fw * 0.036}px sans-serif`; ctx.fillStyle = "#8A8090";
      ctx.fillText([it.age, it.date].filter(Boolean).join(" · "), left, fh / 2 - pad * 0.6);
    }
    ctx.restore();
  };
  const drawJournal = (it: Item, src: HTMLImageElement | HTMLVideoElement | null | undefined, local: number) => {
    ctx.fillStyle = cardBg; ctx.fillRect(0, 0, w, h);
    const areaW = w * 0.86, areaH = h * (h > w ? 0.58 : 0.6), top = h * 0.07;
    if (src) {
      const [iw, ih] = dims(src);
      const zoom = 1 + 0.04 * (1 - Math.min(1, local / it.dur));
      const s = Math.min(areaW / iw, areaH / ih);
      const dw = iw * s, dh = ih * s, l = (w - dw) / 2, t = top + (areaH - dh) / 2;
      ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.fillRect(l + w * 0.006, t + w * 0.008, dw, dh);
      ctx.save(); ctx.beginPath(); ctx.rect(l, t, dw, dh); ctx.clip();
      ctx.drawImage(src, w / 2 - (dw * zoom) / 2, t + dh / 2 - (dh * zoom) / 2, dw * zoom, dh * zoom);
      ctx.restore();
    } else placeholder(it, 1);
    const margin = (w - areaW) / 2;
    const y = top + areaH + h * 0.06;
    ctx.textAlign = "left"; ctx.font = `bold ${w * 0.052}px Georgia, serif`; ctx.fillStyle = accent; ctx.fillText(it.age, margin, y);
    if (it.date) { ctx.textAlign = "right"; ctx.font = `${w * 0.03}px sans-serif`; ctx.fillStyle = cardInk; ctx.globalAlpha = 0.6; ctx.fillText(it.date, w - margin, y); ctx.globalAlpha = 1; ctx.textAlign = "left"; }
    if (it.caption.trim()) {
      ctx.font = `${w * 0.04}px Georgia, serif`; ctx.fillStyle = cardInk;
      wrap(ctx, it.caption, areaW, h > w ? 6 : 3).forEach((l, k) => ctx.fillText(l, margin, y + w * 0.075 + k * w * 0.052));
    }
  };
  const pictureOf = (it: Item) => (it.kind === "clip" && it.video && it.video.readyState >= 2 ? it.video : it.img);

  const drawLayer = (i: number, local: number) => {
    const it = items[i];
    if (it.kind === "intro") return drawIntro(it);
    if (it.kind === "card") return drawCard(it, local);
    if (it.kind === "map") return drawMap(it, local);
    const src = pictureOf(it);
    if (template === "story") {
      if (src) drawCover(src, it.kind === "clip" ? 1 : 1.14 - 0.1 * Math.min(1, local / it.dur), it.kind === "clip" ? 0 : (i % 2 ? -1 : 1) * w * 0.035 * (Math.min(1, local / it.dur) - 0.5) * 2);
      else placeholder(it, 1);
      return storyOverlay(it, it.kind === "clip" && it.dur > 6000 ? 1 - Math.min(1, Math.max(0, (local - 3000) / 800)) : 1);
    }
    if (template === "snapshots") { ctx.fillStyle = cardBg; ctx.fillRect(0, 0, w, h); return drawSnapshot(i, it, src, local); }
    if (template === "journal") return drawJournal(it, src, local);
    const zoom = it.kind === "clip" ? 1 : 1 + 0.08 * (1 - ease3(local / driftMs));
    if (src) drawFit(src, zoom); else placeholder(it, zoom);
    const a = it.kind === "clip" && it.dur > 6000 ? 1 - Math.min(1, Math.max(0, (local - 3000) / 800)) : 1;
    if (a > 0.01) { ctx.save(); ctx.globalAlpha = a; overlay(it); ctx.restore(); }
  };

  let cursor = 0;
  const playing = new Set<HTMLVideoElement>();
  const frame = (t: number) => {
    while (cursor < items.length - 1 && t >= items[cursor + 1].start) cursor++;
    // clips play while on screen (and are made ready just before)
    items.forEach((it, k) => {
      if (it.kind !== "clip" || !it.video) return;
      const on = t >= it.start && t < it.start + it.dur;
      if (on && !playing.has(it.video)) { it.video.currentTime = it.clipStart / 1000 + (t - it.start) / 1000; it.video.play().catch(() => undefined); playing.add(it.video); }
      if (!on && playing.has(it.video) && t >= it.start + it.dur + fadeMs) { it.video.pause(); playing.delete(it.video); }
      if (!on && k === cursor + 1 && it.start - t < 1500 && it.video.paused) it.video.currentTime = it.clipStart / 1000;
    });
    const i = cursor, local = t - items[i].start;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    const photo = (k: number) => items[k].kind === "photo" || items[k].kind === "clip";
    if (template === "snapshots" && photo(i)) {
      ctx.fillStyle = cardBg; ctx.fillRect(0, 0, w, h);
      if (i > 0 && photo(i - 1)) drawSnapshot(i - 1, items[i - 1], items[i - 1].img, -1);
      drawSnapshot(i, items[i], pictureOf(items[i]), local);
      return;
    }
    if (i > 0) {
      const fade = Math.min(fadeMs, 0.6 * Math.min(items[i].dur, items[i - 1].dur));
      if (local < fade) {
        drawLayer(i - 1, items[i - 1].dur);
        const x = Math.min(1, local / fade);
        ctx.save(); ctx.globalAlpha = x * x * (3 - 2 * x); drawLayer(i, local); ctx.restore();
        return;
      }
    }
    drawLayer(i, local);
  };

  frame(0);
  rec.start(1000);
  const startAt = performance.now();
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (cancelled) { rec.stop(); return reject(new Error("Export cancelled")); }
      const t = performance.now() - startAt;
      if (t >= total) { frame(total - 1); return resolve(); }
      frame(t);
      onProgress(t / total);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await new Promise((r) => setTimeout(r, 250));
  if (rec.state !== "inactive") rec.stop();
  await finished;
  items.forEach((it) => { it.video?.pause(); it.video?.removeAttribute("src"); });
  audio.close().catch(() => undefined);
  onProgress(1);
  return new Blob(chunks, { type: (type || "video/webm").split(";")[0] });
}
