import { browserSupportsWebAuthn, startAuthentication, startRegistration, type PublicKeyCredentialCreationOptionsJSON, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import type { Activity, Device, Passkey, StepUpNeeded } from "../../shared/security.ts";
import { t } from "../i18n.ts";
import { call, json } from "../recipes/api.ts";

/** The server wants "Confirm it's you" before it does this. */
export class StepUpError extends Error {
  constructor(
    message: string,
    readonly method: StepUpNeeded["method"],
  ) {
    super(message);
  }
}

/** Like `call`, but a 401 asking for "Confirm it's you" throws StepUpError so the caller can show the sheet and try again. */
async function guarded<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new Error(t("Can't reach the server right now. Try again in a moment."));
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Partial<StepUpNeeded>;
    if (body.stepUp) throw new StepUpError(t(body.error ?? "Confirm it's you first."), body.method ?? "password");
    throw new Error(t(body.error ?? "That didn't work. Try again."));
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const passkeysWork = () => browserSupportsWebAuthn();

/** The phone's own "cancel" is not an error worth showing. */
export const cancelled = (error: unknown) => error instanceof Error && (error.name === "NotAllowedError" || error.name === "AbortError");

export async function logInWithPasskey() {
  const optionsJSON = await call<PublicKeyCredentialRequestOptionsJSON>("/api/passkeys/login/options", { method: "POST" });
  const answer = await startAuthentication({ optionsJSON });
  await call<void>("/api/passkeys/login", json("POST", answer));
}

export const listPasskeys = () => call<Passkey[]>("/api/passkeys");
export async function addPasskey() {
  const optionsJSON = await guarded<PublicKeyCredentialCreationOptionsJSON>("/api/passkeys/register/options", { method: "POST" });
  const answer = await startRegistration({ optionsJSON });
  await guarded<void>("/api/passkeys/register", json("POST", answer));
}
export const removePasskey = (id: string) => guarded<void>(`/api/passkeys/${encodeURIComponent(id)}`, { method: "DELETE" });

export const confirmWithPassword = (password: string) => call<void>("/api/step-up", json("POST", { password }));
export async function confirmWithPasskey() {
  const asked = await call<{ method: "password" } | { method: "passkey"; options: PublicKeyCredentialRequestOptionsJSON }>("/api/step-up/options", { method: "POST" });
  if (asked.method === "password") throw new Error(t("Type your password."));
  const response = await startAuthentication({ optionsJSON: asked.options });
  await call<void>("/api/step-up", json("POST", { response }));
}

export const listDevices = () => call<Device[]>("/api/devices");
export const logOutDevice = (id: string) => call<void>(`/api/devices/${id}`, { method: "DELETE" });
export const logOutOthers = () => call<{ loggedOut: number }>("/api/devices/log-out-others", { method: "POST" });
export const listActivity = () => call<Activity[]>("/api/activity");
