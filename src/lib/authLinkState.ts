import { create } from "zustand";

/** What went wrong with the last verification link (expired, already used…), shown on the login page. Empty when nothing did. */
export const useAuthLinkError = create<{ error: string }>(() => ({ error: "" }));
export const setAuthLinkError = (error: string) => useAuthLinkError.setState({ error });

/**
 * Set when a password-reset link was opened (or a reset was asked for a little before a link arrived): the app then asks for a new password.
 * `resetAskedAt` is when "Forgot password?" was used on this phone.
 */
export const usePasswordReset = create<{ needed: boolean; resetAskedAt: number }>(() => ({ needed: false, resetAskedAt: 0 }));
