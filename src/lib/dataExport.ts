/*
 * "Download a copy of my data": everything in the account's books, in one file you can keep, open and take elsewhere. Inside the zip:
 * the books as a readable data file (JSON), every photo, video and recording kept on this device, and a note that explains it. It's the
 * same data the backup keeps, plus the files themselves.
 */
import { strToU8, zipSync, Zippable } from "fflate";
import { APP_NAME, APP_VERSION } from "../brand";
import { STORE_VERSION, useStore } from "./store";
import { baseName, buildBackup, filesIn } from "./backupData";
import { fileBytes, fileExists, writeFile } from "./localFiles";
import { todayISO } from "./date";

import { tr } from "./i18n";
const README = (date: string) => `${APP_NAME}: a copy of your data, made on ${date}.

- "${APP_NAME} data.json" holds everything in your books: your children, pregnancies and pets, their posts, milestones, growth, health
  notes, family members, tags and settings, in a standard format (JSON) that other programs can read.
- The "media" folder holds the photos, videos and voice recordings that were on this device. Each post in the data file names its files.

Photos and videos that are only in your account (added on another device and not opened here yet) are not in this copy. Open them in
${APP_NAME} on this device first, or make the copy on the device you added them on.
`;

export async function exportMyData(onProgress?: (text: string) => void): Promise<{ uri: string; fileName: string }> {
  const st = useStore.getState();
  const backup = buildBackup(st as unknown as Record<string, unknown>, `${APP_NAME} ${APP_VERSION}`, STORE_VERSION, Date.now());
  const date = todayISO();
  const files: Zippable = {
    [`${APP_NAME} data.json`]: [strToU8(JSON.stringify(backup, null, 2)), { level: 6 }],
    "README.txt": strToU8(README(date)),
  };
  const media = [...filesIn(backup.data)].filter((u) => fileExists(u));
  let k = 0;
  for (const uri of media) {
    onProgress?.(`Adding photos and videos: ${++k} of ${media.length}`);
    try {
      files[`media/${baseName(uri)}`] = [await fileBytes(uri), { level: 0 }]; // pictures are already compressed
    } catch {
      /* a file that can't be read is left out */
    }
  }
  onProgress?.(tr("Making the file…"));
  const fileName = `${APP_NAME} data ${date}.zip`;
  const uri = await writeFile(zipSync(files), fileName);
  return { uri, fileName };
}
