/**
 * Defense-in-depth sanitiser for `href` values that arrive from the API.
 *
 * The FRO4A backend builds `tonviewerUrl` from the immutable `TONVIEWER_BASE`
 * env, so it is always an `https://` explorer link. A compromised or spoofed
 * API response must nevertheless never be able to place a script-scheme,
 * `data:` or credentialed URL into an anchor, so every API-provided link is
 * validated here before React renders it (`target="_blank"` anchors keep
 * `rel="noreferrer noopener"`).
 */
export function safeExternalUrl(candidate: string | null | undefined, fallback: string): string {
  if (typeof candidate !== 'string') return fallback;
  const trimmed = candidate.trim();
  if (!/^https:\/\//i.test(trimmed)) return fallback;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return fallback;
    if (parsed.username.length > 0 || parsed.password.length > 0) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}
