import type { Context } from "hono";
import type { StepUpNeeded } from "../shared/security.ts";
import type { MemberEnv } from "./recipes.ts";

export const confirmItsYou = "Confirm it's you first.";

/**
 * For routes behind kitchenMember that touch money or logins (nemlig.com, passkeys): this device must have proved
 * who it is in the last few minutes, with a passkey when you have one, else with your password.
 * Returns the 401 to send back, or undefined to carry on.
 *
 *   const stepUp = requireRecentAuth(c); if (stepUp) return stepUp;
 */
export function requireRecentAuth(c: Context<MemberEnv>, minutes = 5) {
  const { session, checkedAt } = c.get("member");
  const method = session.hasPasskey ? "passkey" : "password";
  const recent = checkedAt.getTime() - session.authenticatedAt.getTime() <= minutes * 60 * 1000;
  if (recent && (method === "password" || session.authMethod === "passkey")) return undefined;
  return c.json({ error: confirmItsYou, stepUp: true, method } satisfies StepUpNeeded, 401);
}
