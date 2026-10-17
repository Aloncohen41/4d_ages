import { requireNativeModule } from "expo";
import { SharedItem } from "./types";
import { RawShared, splitShared } from "./sharedMedia";

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

export interface ShareResult { items: SharedItem[]; skipped: string[]; text?: string }

/** Files that opened the app from the share sheet (and the ones that couldn't come in, and any caption). */
export async function readInitialShare(): Promise<ShareResult> {
  const raw = await native()?.consumeInitialShare();
  return splitShared(raw || []);
}

/** Files dragged onto the website's page (see shareIntake.web.ts); the phone has no such thing. */
export async function filesToItems(_files: unknown[]): Promise<ShareResult> {
  return { items: [], skipped: [] };
}

/** Called while the app is open: first when copying starts (with the count), then with the finished files. */
export function listenForShares(onStart: (count: number) => void, onItems: (result: ShareResult) => void): () => void {
  const mod = native();
  if (!mod) return () => undefined;
  const a = mod.addListener("onShareStart", (e) => onStart(e.count ?? 0));
  const b = mod.addListener("onShare", () => onItems(splitShared(mod.takePending())));
  // anything that arrived before this was listening (a cold start from the share sheet) is picked up now
  const waiting = mod.takePending();
  if (waiting.length) onItems(splitShared(waiting));
  return () => {
    a.remove();
    b.remove();
  };
}
