import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { filesToItems } from "../lib/shareIntake";
import { skippedMessage } from "../lib/sharedMedia";
import { toast } from "../lib/toast";
import { tr } from "../lib/i18n";
import { TYPE } from "../theme";
import { Icon } from "./Icon";

/*
 * The website: drag photos, videos or sound recordings from the computer anywhere onto the page, and they open in the "new post" screen
 * (whose, what, the dates, the people in them), the same as choosing them with Upload. While something is dragged over the page, it says
 * so. Only on when there's a book to add to.
 */
export function DropZone() {
  const t = useTheme();
  const canAdd = useStore((s) => s.kids.some((k) => k.role !== "viewer"));
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!canAdd) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setOver(true); };
    const overFn = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; };
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setOver(false); };
    const drop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (!files.length) return;
      const st = useStore.getState();
      st.setIncoming({ items: st.incoming?.items ?? [], busy: files.length });
      const r = await filesToItems(files);
      if (r.skipped.length) toast(skippedMessage(r.skipped), true);
      const cur = useStore.getState().incoming;
      const items = [...(cur?.items ?? []), ...r.items];
      useStore.getState().setIncoming(items.length ? { items, source: "picker" } : null);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", overFn);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", overFn);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [canAdd]);
  if (!over) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", inset: 0, zIndex: 500, padding: 24, backgroundColor: "rgba(0,0,0,.25)" } as object}>
      <View style={{ flex: 1, borderRadius: 32, borderWidth: 3, borderStyle: "dashed", borderColor: t.accent, backgroundColor: t.bg, opacity: 0.95, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Icon name="upload" size={56} color={t.accent} />
        <Text style={[TYPE.headlineSmall, { color: t.ink }]}>{tr("Drop to add them")}</Text>
        <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>{tr("Photos, videos and sound recordings")}</Text>
      </View>
    </View>
  );
}
