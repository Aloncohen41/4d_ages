import { useEffect, useState } from "react";

/** The world map picture (assets/world-map.png) as a file on the phone, for the book's map pages; undefined until it's ready. */
export function useWorldMap(): string | undefined {
  const [uri, setUri] = useState<string | undefined>();
  useEffect(() => {
    let alive = true;
    worldMapUri().then((u) => { if (alive) setUri(u); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return uri;
}

export async function worldMapUri(): Promise<string | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Asset } = require("expo-asset") as typeof import("expo-asset");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const map = Asset.fromModule(require("../../assets/world-map.png"));
  await map.downloadAsync();
  return map.localUri ?? map.uri;
}
