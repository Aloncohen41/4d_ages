import type { KeyValue } from "./dataStorage";

/*
 * More than one account on a phone. Each account's books are its own: when someone else signs in, the books of the account that was here are
 * set aside on the phone (with their photos, and anything not yet uploaded), and come back when that account signs in again. Nothing is deleted
 * and nobody is turned away. The phone's own settings (theme, units, app lock, reminders) stay as they are.
 */

/** The parts of the saved data that belong to an account (everything else is the phone's). */
export const ACCOUNT_FIELDS = [
  "kids", "activeId", "memories", "relatives", "customDefs", "classics", "foodTries", "tags", "milestoneAnswers", "tombstones", "syncMeta", "familyOrder", "bookPrefs", "videoEvents",
] as const;
export type AccountField = (typeof ACCOUNT_FIELDS)[number];

/** An account with nothing on this phone yet. */
export const EMPTY_ACCOUNT: Record<AccountField, unknown> = {
  kids: [], activeId: "", memories: [], relatives: [], customDefs: {}, classics: [], foodTries: [], tags: [], milestoneAnswers: {}, tombstones: [], syncMeta: {}, familyOrder: {}, bookPrefs: {}, videoEvents: {},
};

/** Where an account's books wait on this phone while another account is signed in. */
export const accountKey = (storeKey: string, userId: string) => `${storeKey}-account-${userId}`;

/**
 * Sets the books of `from` aside and returns the books `to` left on this phone (or an empty account). The saved copy of `to` is removed only
 * after the caller has taken it in (`done`), so a crash in between loses nothing.
 */
export async function swapAccounts<S extends Record<string, unknown>>(
  kv: KeyValue, storeKey: string, version: number, state: S, from: string | undefined, to: string,
  migrate: (saved: Record<string, unknown>, fromVersion: number) => Record<string, unknown>,
): Promise<{ next: Record<AccountField, unknown>; done: () => Promise<void> }> {
  if (from && from !== to) {
    const mine = Object.fromEntries(ACCOUNT_FIELDS.map((k) => [k, state[k]]));
    await kv.setItem(accountKey(storeKey, from), JSON.stringify({ state: mine, version }));
  }
  const raw = await kv.getItem(accountKey(storeKey, to));
  let next = { ...EMPTY_ACCOUNT };
  if (raw) {
    try {
      const saved = JSON.parse(raw) as { state: Record<string, unknown>; version?: number };
      const upgraded = (saved.version ?? version) < version ? migrate(saved.state, saved.version ?? 0) : saved.state;
      next = { ...EMPTY_ACCOUNT, ...Object.fromEntries(ACCOUNT_FIELDS.filter((k) => k in upgraded).map((k) => [k, upgraded[k]])) };
    } catch {
      next = { ...EMPTY_ACCOUNT }; // unreadable: start empty (the account's books come back from the cloud)
    }
  }
  return { next, done: () => (raw ? kv.removeItem(accountKey(storeKey, to)) : Promise.resolve()) };
}
