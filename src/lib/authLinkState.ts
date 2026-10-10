import { create } from "zustand";

/** What went wrong with the last verification link (expired, already used…), shown on the login page. Empty when nothing did. */
export const useAuthLinkError = create<{ error: string }>(() => ({ error: "" }));
export const setAuthLinkError = (error: string) => useAuthLinkError.setState({ error });
