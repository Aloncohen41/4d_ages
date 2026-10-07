import * as ImagePicker from "expo-image-picker";
import { Directory, File, Paths } from "expo-file-system";
import { Child, MediaItem, MediaKind, Memory } from "./types";
import { dateFromFileName, exifToISO, todayISO } from "./date";
import { defaultThumb } from "./videoThumbs";
import { APP_NAME } from "../brand";
import { RESTART_MANUAL_TITLE, RESTART_MESSAGE, RESTART_TITLE, isPickerRegistrationError, restartManualMessage } from "./pickerErrors";
import { restartApp } from "./shareIntake";

export interface Picked {
  uri: string; // permanent copy inside the app's own storage
  kind: MediaKind;
  date: string;
  thumb?: string; // for videos: a frame to show for it
}

/** Picked files → media items for a memory. */
export const toMediaItems = (picked: Picked[]): MediaItem[] => picked.map((p) => ({ id: `mi-${rid()}`, uri: p.uri, kind: p.kind, ...(p.thumb ? { thumb: p.thumb } : {}) }));

const rid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Copy a picked file into the app's private storage so it survives cache cleaning. */
export function persistFile(uri: string, ext: string): string {
  try {
    const dir = new Directory(Paths.document, "media");
    if (!dir.exists) dir.create({ intermediates: true });
    const dest = new File(dir, `${rid()}.${ext}`);
    new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri; // fall back to the original location
  }
}

export function deleteFile(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* already gone */
  }
}

function extOf(name: string | null | undefined, uri: string, kind: MediaKind): string {
  const src = name || uri.split("?")[0];
  const m = src.match(/\.([A-Za-z0-9]{2,5})$/);
  if (m) return m[1].toLowerCase();
  return kind === "video" ? "mp4" : "jpg";
}

/** The picker is stuck until the app restarts: say so plainly and offer the restart (instead of an error the parent can't act on). */
function offerRestart() {
  // loaded only now, so the data store (which imports this file) never needs the UI library just to start
  const { Alert } = require("react-native") as typeof import("react-native");
  Alert.alert(RESTART_TITLE, RESTART_MESSAGE, [
    { text: "Not now", style: "cancel" },
    { text: "Restart", onPress: () => { if (!restartApp()) Alert.alert(RESTART_MANUAL_TITLE, restartManualMessage(APP_NAME)); } },
  ]);
}

/** Open the system photo picker (Google Photos included). The parent chooses every item. */
export async function pickMedia(opts: { videos: boolean; multiple: boolean }): Promise<Picked[]> {
  let res: Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>;
  try {
    res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: opts.videos ? ["images", "videos"] : ["images"],
      allowsMultipleSelection: opts.multiple,
      selectionLimit: opts.multiple ? 0 : 1,
      exif: true,
      quality: 0.85,
    });
  } catch (e) {
    if (isPickerRegistrationError(e)) {
      offerRestart();
      return []; // nothing was chosen; callers carry on as if the picker was closed
    }
    throw e;
  }
  if (res.canceled) return [];
  return Promise.all(res.assets.map(async (a) => {
    const kind: MediaKind = a.type === "video" ? "video" : "photo";
    const ex = (a.exif || {}) as Record<string, unknown>;
    const date =
      exifToISO(String(ex.DateTimeOriginal ?? "")) ||
      exifToISO(String(ex.DateTime ?? "")) ||
      dateFromFileName(a.fileName) ||
      todayISO();
    const uri = persistFile(a.uri, extOf(a.fileName, a.uri, kind));
    const thumb = kind === "video" ? await defaultThumb(uri) : undefined; // videos get a thumbnail straight away
    return { uri, kind, date, thumb };
  }));
}

/** Each picked photo or video becomes a memory of type "photo". */
export function toMemories(child: Child, picked: Picked[], source = "Added"): Memory[] {
  const palettes = ["peach", "sage", "butter", "rose", "sky", "lav"];
  const ts = Date.now();
  return picked.map((p, i) => ({
    id: `up-${rid()}`,
    childId: child.id,
    type: "photo" as const,
    date: p.date < child.birth ? child.birth : p.date,
    description: p.kind === "video" ? "A little moment on video." : "A new memory.",
    media: toMediaItems([p]),
    tagIds: [],
    createdAt: ts,
    emoji: p.kind === "video" ? "🎬" : "📷",
    palette: palettes[i % palettes.length],
    source,
  }));
}
