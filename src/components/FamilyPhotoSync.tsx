import { useEffect } from "react";
import { useStore } from "../lib/store";
import { profilePhotosToFamily } from "../lib/family";
import { coverOf } from "../lib/display";

/** Keeps each child's and pet's profile picture on their entry in the family (see profilePhotosToFamily). */
export function FamilyPhotoSync() {
  const kids = useStore((s) => s.kids);
  const hydrated = useStore((s) => s.hydrated);
  const key = kids.map((k) => `${k.id}:${k.avatarPhotoId ?? ""}:${JSON.stringify(k.avatarCrop ?? null)}`).join("|");
  useEffect(() => {
    if (!hydrated) return;
    const s = useStore.getState();
    const photoOf = (id: string) => { const c = coverOf(s.memories.find((m) => m.id === id)?.media); return c?.kind === "photo" ? c.uri : undefined; };
    const next = profilePhotosToFamily(s.relatives, s.kids, photoOf);
    if (next !== s.relatives) useStore.setState({ relatives: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, key]);
  return null;
}
