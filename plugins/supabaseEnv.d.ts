export type KeyKind = "publishable" | "secret" | "unknown";
export function classifyKey(value: unknown): KeyKind;
export function projectUrl(value: unknown): string;
export function refFromConnectionString(value: unknown): string;
export function pickSupabase(env: Record<string, string | undefined>): { url: string; key: string; urlFrom: string; keyFrom: string; secretSeen: boolean };
export function build<T extends object>(config: T, env: Record<string, string | undefined>, log?: (message: string) => void): T & { extra: Record<string, unknown> };
