/** The few storage calls we need (AsyncStorage satisfies this). */
export interface KV {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/**
 * When saved data from an OLDER app version is found, keep an untouched copy under "<key>-backup-v<old version>"
 * before any migration can change it. Never overwrites an existing backup, and never throws.
 */
export async function backupIfOlder(kv: KV, key: string, current: number, raw: string | null): Promise<boolean> {
  if (!raw) return false;
  try {
    const v = Number(JSON.parse(raw).version ?? 0);
    if (!(v < current)) return false;
    const backup = `${key}-backup-v${v}`;
    if (await kv.getItem(backup)) return false;
    await kv.setItem(backup, raw);
    return true;
  } catch {
    return false; // unreadable data is simply left alone
  }
}
