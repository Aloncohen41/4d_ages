/*
 * The verification email's button opens  fourdages://auth-callback…  with the sign-in in the link. Supabase sends either a one-time
 * `code` (in the query) or the tokens themselves (in the #fragment), or an error. Pure parsing, so it can be tested without a phone.
 */
export interface AuthCallback {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

/** The sign-in carried by an auth-callback link, or null for any other link (a shared photo, an old link…). */
export function parseAuthCallback(url: string | null | undefined): AuthCallback | null {
  if (!url || !/^fourdages:\/\/auth-callback/i.test(url)) return null;
  const params = new Map<string, string>();
  const [beforeHash, hash = ""] = url.split("#");
  const query = beforeHash.includes("?") ? beforeHash.slice(beforeHash.indexOf("?") + 1) : "";
  for (const part of [query, hash]) {
    for (const pair of part.split("&")) {
      if (!pair) continue;
      const i = pair.indexOf("=");
      const key = decodeURIComponent((i < 0 ? pair : pair.slice(0, i)).replace(/\+/g, " "));
      const value = i < 0 ? "" : decodeURIComponent(pair.slice(i + 1).replace(/\+/g, " "));
      if (key) params.set(key, value);
    }
  }
  const error = params.get("error_description") || params.get("error");
  return {
    ...(params.get("code") ? { code: params.get("code") } : {}),
    ...(params.get("access_token") ? { accessToken: params.get("access_token") } : {}),
    ...(params.get("refresh_token") ? { refreshToken: params.get("refresh_token") } : {}),
    ...(error ? { error: /expired|invalid/i.test(error) ? "This link has expired or was already used. Sign in, or send a new verification email." : error } : {}),
  };
}
