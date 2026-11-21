/** Profile > Devices: one logged-in browser. */
export type Device = { id: string; browser: string; createdAt: string; lastUsedAt: string; current: boolean };
/** Profile > Passkeys. */
export type Passkey = { id: string; name: string; createdAt: string; lastUsedAt: string | null };
/** Profile > Activity. */
export type Activity = { action: string; detail: string; at: string };
/** A 401 with this body means "Confirm it's you" (passkey, or password when you have none), then try again. */
export type StepUpNeeded = { error: string; stepUp: true; method: "passkey" | "password" };

/** "Safari on iPhone" from a User-Agent header; good enough to tell your own devices apart. */
export function browserName(userAgent: string) {
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\/|FxiOS\//.test(ua)
      ? "Firefox"
      : /CriOS\/|Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "";
  const system = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  if (browser && system) return `${browser} on ${system}`;
  return browser || system || "Unknown browser";
}
