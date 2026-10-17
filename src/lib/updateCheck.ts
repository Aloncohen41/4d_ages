import { APP_VERSION, LATEST_RELEASE_API } from "../brand";

import { tr } from "./i18n";
/*
 * "A new version is available": on opening, the app asks GitHub for the latest release and, if it is newer than this one, offers the APK.
 * The comparison and the choice of file are pure, for tests; the check itself never throws (no connection just means no prompt).
 */

/** True when `latest` ("v1.0.7" or "1.0.7") is a newer version than `current`. */
export function isNewer(latest: string, current: string): boolean {
  const parts = (v: string) => v.replace(/^v/i, "").split(/[.-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
  const a = parts(latest), b = parts(current);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
}

export interface Release { version: string; apkUrl: string; pageUrl: string }

interface GitHubRelease { tag_name?: string; html_url?: string; draft?: boolean; prerelease?: boolean; assets?: { name?: string; browser_download_url?: string }[] }

/** The release's version and its APK (or the release page, if it has no APK attached). */
export function releaseOf(r: GitHubRelease): Release | null {
  if (!r.tag_name || r.draft || r.prerelease) return null;
  const apk = r.assets?.find((a) => a.name?.toLowerCase().endsWith(".apk") && a.browser_download_url);
  const pageUrl = r.html_url ?? "";
  return { version: r.tag_name.replace(/^v/i, ""), apkUrl: apk?.browser_download_url ?? pageUrl, pageUrl };
}

/** How long "Later" keeps the same version from being offered again. */
export const ASK_AGAIN_MS = 24 * 60 * 60 * 1000;

/** Whether to offer this version now, given when (and for which version) "Later" was last tapped. */
export function shouldOffer(release: Release | null, current: string, later: { version: string; at: number } | null, now: number): boolean {
  if (!release || !isNewer(release.version, current)) return false;
  return !later || later.version !== release.version || now - later.at >= ASK_AGAIN_MS;
}

/** The latest published release, or null when it can't be reached. */
export async function latestRelease(): Promise<Release | null> {
  try {
    const res = await fetch(LATEST_RELEASE_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return null;
    return releaseOf((await res.json()) as GitHubRelease);
  } catch {
    return null;
  }
}

export const CURRENT_VERSION = APP_VERSION;
