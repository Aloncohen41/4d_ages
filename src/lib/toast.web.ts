import { create } from "zustand";

/** The website's toast: the message shows at the bottom of the page for a few seconds (drawn by WebToast). */
export const useWebToast = create<{ message: string; at: number; long: boolean }>(() => ({ message: "", at: 0, long: false }));

export function toast(message: string, long = false) {
  useWebToast.setState({ message, at: Date.now(), long });
}
