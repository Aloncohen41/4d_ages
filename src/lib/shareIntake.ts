import { requireNativeModule } from "expo";
import { SharedItem } from "./types";
import { RawShared, normalizeShared } from "./sharedMedia";

interface NativeShare {
  hasInitialShare(): boolean;
  consumeInitialShare(): Promise<RawShared[]>;
  takePending(): RawShared[];
  restartApp(): void;
  addListener(event: "onShare" | "onShareStart", cb: (e: { count?: number }) => void): { remove: () => void };
}

let cached: NativeShare | null | undefined;
function native(): NativeShare | null {
  if (cached === undefined) {
    try {
      cached = requireNativeModule<NativeShare>("ShareIntake");
    } catch {
      cached = null; // the app hasn't been rebuilt with the module yet
    }
  }
  return cached ?? null;
}

export const isShareIntakeAvailable = () => native() !== null;
export const hasInitialShare = () => !!native()?.hasInitialShare();

/** Restarts the app (a new process). Returns false if this build can't (the app needs a rebuild once). */
export function restartApp(): boolean {
  const mod = native();
  if (!mod || typeof mod.restartApp !== "function") return false;
  try {
    mod.restartApp();
    return true;
  } catch {
    return false;
  }
}

/** Files that opened the app from the share sheet. */
export async function readInitialShare(): Promise<SharedItem[]> {
  const raw = await native()?.consumeInitialShare();
  return (raw || []).map(normalizeShared);
}

/** Called while the app is open: first when copying starts (with the count), then with the finished files. */
export function listenForShares(onStart: (count: number) => void, onItems: (items: SharedItem[]) => void): () => void {
  const mod = native();
  if (!mod) return () => undefined;
  const a = mod.addListener("onShareStart", (e) => onStart(e.count ?? 0));
  const b = mod.addListener("onShare", () => onItems(mod.takePending().map(normalizeShared)));
  return () => {
    a.remove();
    b.remove();
  };
}
