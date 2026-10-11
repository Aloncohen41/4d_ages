import { useEffect } from "react";
import { router } from "expo-router";
import { useActiveChild, useStore } from "../lib/store";

/**
 * Sharing has its own screen (app/share.tsx). Anything that opens "sharing" (the profile's Share the book, Settings, the welcome page's Join)
 * sets shareOpen, and this sends it to that screen: for the selected child, or to join a book when there's no child yet.
 */
export function ShareSheet() {
  const open = useStore((s) => s.shareOpen);
  const setOpen = useStore((s) => s.setShareOpen);
  const child = useActiveChild();
  useEffect(() => {
    if (!open) return;
    setOpen(false);
    router.push(child ? { pathname: "/share", params: { child: child.id } } : { pathname: "/share", params: { mode: "join" } });
  }, [open, child, setOpen]);
  return null;
}
