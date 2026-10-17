import React, { useEffect, useRef, useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { useTheme } from "../lib/useTheme";
import { withAlpha } from "../lib/m3";

/*
 * A place on the website that files from the computer can be dragged onto: the Upload window, a family member's photo. Only here, never
 * the whole page, so dragging something around the page (a person in the family tree) is never taken for an upload. While files are over
 * it, it lights up.
 */
export function DropArea({ onFiles, children, style, label }: { onFiles: (files: File[]) => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; label?: string }) {
  const t = useTheme();
  const ref = useRef<View>(null);
  const [over, setOver] = useState(false);
  const latest = useRef(onFiles);
  latest.current = onFiles;
  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    let depth = 0;
    const files = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => { if (!files(e)) return; e.preventDefault(); depth++; setOver(true); };
    const overFn = (e: DragEvent) => { if (!files(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; };
    const leave = (e: DragEvent) => { if (!files(e)) return; depth = Math.max(0, depth - 1); if (!depth) setOver(false); };
    const drop = (e: DragEvent) => {
      if (!files(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      const list = Array.from(e.dataTransfer?.files ?? []);
      if (list.length) latest.current(list);
    };
    el.addEventListener("dragenter", enter);
    el.addEventListener("dragover", overFn);
    el.addEventListener("dragleave", leave);
    el.addEventListener("drop", drop);
    return () => {
      el.removeEventListener("dragenter", enter);
      el.removeEventListener("dragover", overFn);
      el.removeEventListener("dragleave", leave);
      el.removeEventListener("drop", drop);
    };
  }, []);
  return (
    <View ref={ref} aria-label={label} style={[style, over ? { backgroundColor: withAlpha(t.accent, 0.12), borderColor: t.accent } : null]}>
      {children}
    </View>
  );
}

/** Opens the computer's file chooser and hands back what was chosen. */
export function chooseFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = "none";
    input.onchange = () => { resolve(Array.from(input.files ?? [])); input.remove(); };
    document.body.appendChild(input);
    input.click();
  });
}
