/*
 * The timeline shows the newest posts first and adds older ones as you scroll toward them, instead of building every post in the child's
 * whole history at once. (Each post is a few dozen on-screen elements: a long history meant thousands of them, every time you switched child.)
 */
export const PAGE = 20;

/** `key` identifies what is being listed (which child, filter and date range); a different key starts again from the newest page. */
export interface FeedWindow { key: string; n: number }

export const windowKey = (childId: string | undefined, type: string, period: string) => `${childId ?? ""}|${type}|${period}`;
export const windowSize = (w: FeedWindow, key: string) => (w.key === key ? w.n : PAGE);
export const growWindow = (w: FeedWindow, key: string, total: number): FeedWindow => ({ key, n: Math.min(Math.max(total, PAGE), windowSize(w, key) + PAGE) });
export const showAllWindow = (key: string, total: number): FeedWindow => ({ key, n: Math.max(total, PAGE) });
export const hasMore = (total: number, n: number) => total > n;
