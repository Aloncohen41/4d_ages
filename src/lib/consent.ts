/*
 * Agreeing to the terms and the privacy policy, and consenting to keeping health information (pregnancy, growth, health notes): asked when
 * an account is made, and again whenever the terms change (LEGAL_VERSION). The agreement is kept with the account, with its date, so it's
 * the same on every phone and on the website.
 */
import type { Session } from "@supabase/supabase-js";

/** Raise this when the terms or the privacy policy change in a way people must agree to again. */
export const LEGAL_VERSION = 2;

export interface LegalAgreement { version: number; at: string; health: boolean }

export function agreementOf(session: Session | null): LegalAgreement | null {
  const v = session?.user.user_metadata?.legal as LegalAgreement | undefined;
  return v && typeof v.version === "number" ? v : null;
}

/** Signed in, but hasn't agreed to these terms (or to keeping health information) yet. */
export const needsAgreement = (session: Session | null) => {
  if (!session) return false;
  const a = agreementOf(session);
  return !a || a.version < LEGAL_VERSION || !a.health;
};

export const agreementNow = (now = new Date()): LegalAgreement => ({ version: LEGAL_VERSION, at: now.toISOString(), health: true });
