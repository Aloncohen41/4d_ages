/* Hearts and comments, counted and grouped. Pure (no phone or cloud needed), so it can be tested. */

export interface Reaction {
  memoryId: string;
  userId: string;
  author: string;
  heart: boolean;
  comment: string;
  at: string; // when it was last changed
}

/** Group a child's reactions by post (oldest first on each post). Pure, for tests. */
export function groupReactions(list: Reaction[]): Record<string, Reaction[]> {
  const out: Record<string, Reaction[]> = {};
  for (const r of [...list].sort((a, b) => a.at.localeCompare(b.at))) (out[r.memoryId] ??= []).push(r);
  return out;
}

/** The hearts and comments on a post, counted. */
export const reactionCounts = (list: Reaction[] = []) => ({ hearts: list.filter((r) => r.heart).length, comments: list.filter((r) => r.comment.trim()).length });
