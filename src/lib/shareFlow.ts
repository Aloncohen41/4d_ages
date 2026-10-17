import { tr } from "./i18n";
/*
 * The words and checks of the share flow: clean codes and emails, plain-language errors, and the invite messages for WhatsApp, email and other
 * apps. Pure, so it can be tested without a phone.
 */

export type InviteKind = "parent" | "family";

/** What someone typed or pasted as a code ("4f9a-2c1b ", "Code: 4F9A2C1B") → "4F9A2C1B". */
export function normalizeCode(text: string): string {
  const m = text.toUpperCase().match(/[A-Z0-9]{8}/g);
  if (m?.length) return m[m.length - 1]; // the code inside a pasted message
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export const isEmail = (text: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text.trim());
export const cleanEmail = (text: string) => text.trim().toLowerCase();

/** The database's and the network's messages, said plainly, with what to do next. */
export function friendlyShareError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/network|fetch|timed? ?out|offline|Failed to/i.test(msg)) return tr("You seem to be offline. Connect to the internet and try again.");
  if (/sign in first|JWT|not authenticated|session/i.test(msg)) return tr("Please sign in again, then try once more.");
  if (/as many parents as it can/i.test(msg)) return tr("This book already has as many parents as it can (two for a child, six for a pet). Someone has to be removed before another can join.");
  if (/already shared by two parents/i.test(msg)) return tr("This book already has two parents. One of them has to remove the other before someone else can join as a parent.");
  if (/different email/i.test(msg)) return tr("This code was made for a different email. Sign in with the email the invite was sent to, or ask for a new code.");
  if (/invalid or has expired|expired/i.test(msg)) return tr("That code isn't valid any more (each code works once, for 7 days). Ask for a new one.");
  if (/don't have access|blocked/i.test(msg)) return msg;
  if (/not part of this child|row-level security|permission/i.test(msg)) return "This book isn't ready to share yet. Tap Try again; if it keeps happening, sign out and back in.";
  return msg || tr("Something went wrong. Try again.");
}

/**
 * The message sent with an invite, short enough to be read: what they can do (view only, or view and add), the link (with the code in it), and
 * which email to sign in with when the invite is for one email.
 */
export function inviteMessage(kind: InviteKind, childName: string, code: string, link: string, appName: string, email?: string): string {
  const intro = kind === "parent"
    ? tr("Join {0}'s baby book on {1}. You can view and add photos and memories.", [childName, appName])
    : tr("You're invited to {0}'s baby book on {1} (view only).", [childName, appName]);
  // the code is inside the link (and on the share screen, to type in by hand), so the message stays short
  return [intro, link, email ? tr("Sign in with {0} to open it.", [email]) : ""].filter(Boolean).join("\n");
}

/** What the person invited will see, in one line. */
export const kindSummary = (kind: InviteKind, childName: string, people: string[]) =>
  kind === "parent"
    ? tr("They'll see everything in {0}'s book and can add to it, like you.", [childName])
    : tr("They'll see only the posts with {0}, and can leave a heart and a comment. They can't change anything.", [people.length ? people.join(", ") : tr("the people you choose")]);
