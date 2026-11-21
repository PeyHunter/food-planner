# Security and ordering from nemlig.com

Written 2026-11-20. Covers how to order from nemlig.com from the app, and how strong logins need to be when money is involved.

## Where we are

- Logins: username + password, hashed with scrypt. Session cookie is HttpOnly, SameSite=Lax, Secure on https.
- Weak spots: passwords are two food words (easy to guess), there is no limit on login attempts, no second factor, and sessions can't be listed or ended from another device.
- nemlig.com has no public API. Its website uses private endpoints behind a Queue-it bot wall. Using them is against the spirit of their terms and can break any day.

## Rule one: the app never touches a card

nemlig.com already keeps the card and charges it. The app should never ask for, store or pass on card numbers. If the app ever takes money itself, use Stripe Checkout (Stripe's own page), so card data never reaches our server.

## Ways to order from nemlig.com

| | How | What we store | Risk | Effort |
|---|---|---|---|---|
| A. Guided basket (built now) | App opens nemlig's search for each item, you tap "add" there | Nothing from nemlig | None | Done |
| B. Fill the basket from the server | Server logs in to nemlig as you (private API), finds products, adds them to your basket. You check out and pay on nemlig.com | Your nemlig login, encrypted | Breaks when nemlig changes; terms risk; our server holds a password to an account with a card | ~3–5 days |
| C. Browser helper on nemlig.com | A bookmarklet or extension runs inside your own logged-in nemlig tab and adds the app's list to the basket | Nothing | Breaks when nemlig changes; awkward on iPhone | ~2–3 days |
| D. Ask nemlig for partner access | Email nemlig's business team | Their token | None | Weeks, maybe never |

Recommendation: B, but only up to "fill the basket". You still press "Pay" on nemlig.com yourself. That keeps the app away from payments and stops a stolen app login from turning into a grocery order. Send D in parallel; switch to it if they say yes.

## If we do B, these come first

1. Logins: add passkeys (Face ID / fingerprint, WebAuthn) as the main way in. Keep passwords as a fallback, but longer ones.
2. Limit login attempts (for example 10 per 15 minutes per name and per IP).
3. Step-up check: connecting nemlig and filling the basket ask for the passkey again.
4. nemlig login stored per person, not per kitchen, encrypted with AES-256-GCM. The key lives in the sealed secret, never in the database. Keep nemlig's session token when possible, and the password only if re-login needs it. "Disconnect nemlig" deletes it at once.
5. Log every nemlig action (who, when, what) and show it on Profile.
6. A "Devices" list on Profile, with "log out everywhere".
7. Encrypted database backups.

A hosted login service (Auth0, Clerk) or a self-hosted one (Keycloak, Authentik) is not worth it at this size. The cluster is small, and passkeys plus the points above give the same protection.
