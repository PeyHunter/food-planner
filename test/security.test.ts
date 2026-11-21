import { randomBytes } from "node:crypto";
import { expect, test } from "vitest";
import { readSecretKey, secretStore } from "../src/server/secrets.ts";
import { browserName } from "../src/shared/security.ts";
import { softwarePasskey } from "./support/passkey.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

const [peyton, ronja] = startingUsers;
const minutes = (count: number) => count * 60 * 1000;
const iPhone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

async function setUp() {
  const app = await createTestApp();
  const { cookie } = await app.logIn("peyton", peyton!.password, { userAgent: iPhone });
  const send = (path: string, method = "GET", body?: unknown, as = cookie!) =>
    app.request(path, { method, headers: { cookie: as, "content-type": "application/json", "user-agent": iPhone }, body: body === undefined ? undefined : JSON.stringify(body) });
  const addPasskey = async (passkey = softwarePasskey(), as = cookie!) => {
    const options = (await (await send("/api/passkeys/register/options", "POST", undefined, as)).json()) as { challenge: string };
    return send("/api/passkeys/register", "POST", passkey.register(options), as);
  };
  const passkeyLogIn = async (passkey: ReturnType<typeof softwarePasskey>) => {
    const options = (await (await app.request("/api/passkeys/login/options", { method: "POST" })).json()) as { challenge: string };
    const response = await app.request("/api/passkeys/login", { method: "POST", headers: { "content-type": "application/json", "user-agent": mac }, body: JSON.stringify(passkey.answer(options)) });
    return { response, cookie: response.headers.getSetCookie().find((line) => line.startsWith("fp_session="))?.split(";")[0] };
  };
  return { app, cookie: cookie!, send, addPasskey, passkeyLogIn };
}

test("add a passkey from Profile, then log in with it and no password", async () => {
  const { app, send, addPasskey, passkeyLogIn } = await setUp();
  const passkey = softwarePasskey();
  expect((await addPasskey(passkey)).status).toBe(204);
  expect(await (await send("/api/passkeys")).json()).toEqual([{ id: passkey.id, name: "Safari on iPhone", createdAt: expect.any(String), lastUsedAt: null }]);

  const { response, cookie } = await passkeyLogIn(passkey);
  expect(response.status).toBe(204);
  expect(await (await app.request("/api/me", { headers: { cookie: cookie! } })).json()).toMatchObject({ username: "peyton" });
  expect((await (await send("/api/passkeys")).json())[0].lastUsedAt).not.toBeNull();
});

test("a passkey answer works once, and a passkey that isn't added is refused", async () => {
  const { app, addPasskey, passkeyLogIn } = await setUp();
  const passkey = softwarePasskey();
  await addPasskey(passkey);
  const options = (await (await app.request("/api/passkeys/login/options", { method: "POST" })).json()) as { challenge: string };
  const answer = JSON.stringify(passkey.answer(options));
  const logIn = () => app.request("/api/passkeys/login", { method: "POST", headers: { "content-type": "application/json" }, body: answer });

  expect((await logIn()).status).toBe(204);
  expect((await logIn()).status).toBe(401);
  expect((await passkeyLogIn(softwarePasskey())).response.status).toBe(401);
});

test("a challenge from another person can't add a passkey to your login", async () => {
  const { app, send, cookie } = await setUp();
  const { cookie: ronjaCookie } = await app.logIn("ronja", ronja!.password);
  const options = (await (await send("/api/passkeys/register/options", "POST", undefined, ronjaCookie!)).json()) as { challenge: string };
  expect((await send("/api/passkeys/register", "POST", softwarePasskey().register(options), cookie)).status).toBe(400);
});

test("after 5 minutes, adding or removing a passkey asks you to confirm it's you; a passkey counts once you have one", async () => {
  const { app, send, addPasskey } = await setUp();
  app.clock.advance(minutes(6));
  const asked = await send("/api/passkeys/register/options", "POST");
  expect(asked.status).toBe(401);
  expect(await asked.json()).toEqual({ error: "Confirm it's you first.", stepUp: true, method: "password" });

  expect(await (await send("/api/step-up/options", "POST")).json()).toEqual({ method: "password" });
  expect((await send("/api/step-up", "POST", { password: "wrong" })).status).toBe(401);
  expect((await send("/api/step-up", "POST", { password: peyton!.password })).status).toBe(204);
  const passkey = softwarePasskey();
  expect((await addPasskey(passkey)).status).toBe(204);

  // Now that peyton has a passkey, the password from the login no longer counts as "it's you".
  const removing = await send(`/api/passkeys/${passkey.id}`, "DELETE");
  expect(await removing.json()).toEqual({ error: "Confirm it's you first.", stepUp: true, method: "passkey" });
  expect((await send("/api/step-up", "POST", { password: peyton!.password })).status).toBe(401);
  const { options } = (await (await send("/api/step-up/options", "POST")).json()) as { options: { challenge: string; allowCredentials: { id: string }[] } };
  expect(options.allowCredentials.map((credential) => credential.id)).toEqual([passkey.id]);
  expect((await send("/api/step-up", "POST", { response: passkey.answer(options) })).status).toBe(204);
  expect((await send(`/api/passkeys/${passkey.id}`, "DELETE")).status).toBe(204);
  expect(await (await send("/api/passkeys")).json()).toEqual([]);
});

test("Devices lists each login with its browser; log out one, or everywhere else", async () => {
  const { app, send } = await setUp();
  const { cookie: macCookie } = await app.logIn("peyton", peyton!.password, { userAgent: mac });
  const { cookie: thirdCookie } = await app.logIn("peyton", peyton!.password, { userAgent: mac });
  await app.logIn("ronja", ronja!.password);

  const devices = (await (await send("/api/devices")).json()) as { id: string; browser: string; current: boolean }[];
  expect(devices.map((device) => [device.browser, device.current]).sort()).toEqual([
    ["Chrome on Mac", false],
    ["Chrome on Mac", false],
    ["Safari on iPhone", true],
  ]);

  const other = devices.find((device) => !device.current)!;
  expect((await send(`/api/devices/${other.id}`, "DELETE")).status).toBe(204);
  expect((await send(`/api/devices/${other.id}`, "DELETE")).status).toBe(404);
  expect(await (await send("/api/devices/log-out-others", "POST")).json()).toEqual({ loggedOut: 1 });
  for (const gone of [macCookie, thirdCookie]) expect((await app.request("/api/me", { headers: { cookie: gone! } })).status).toBe(401);
  expect((await send("/api/me")).status).toBe(200);
  // Ronja's own login is not peyton's to end.
  expect(await app.query("select count(*)::int as n from sessions")).toEqual([{ n: 2 }]);
});

test("a device's last use is written at most once an hour", async () => {
  const { app, send } = await setUp();
  const lastUsed = async () => ((await (await send("/api/devices")).json()) as { lastUsedAt: string }[])[0]!.lastUsedAt;
  const first = await lastUsed();
  app.clock.advance(minutes(30));
  expect(await lastUsed()).toBe(first);
  app.clock.advance(minutes(31));
  await send("/api/me");
  expect(await lastUsed()).toBe(new Date(Date.parse(first) + minutes(61)).toISOString());
});

test("Activity shows what happened, newest first", async () => {
  const { app, send, addPasskey } = await setUp();
  app.clock.advance(minutes(1));
  await addPasskey();
  app.clock.advance(minutes(1));
  await send("/api/devices/log-out-others", "POST");
  const activity = (await (await send("/api/activity")).json()) as { action: string; detail: string }[];
  expect(activity.map(({ action, detail }) => [action, detail])).toEqual([
    ["Logged out everywhere else", "0 devices"],
    ["Passkey added", "Safari on iPhone"],
    ["Logged in with password", ""],
  ]);
});

test("browser names", () => {
  expect(browserName(iPhone)).toBe("Safari on iPhone");
  expect(browserName(mac)).toBe("Chrome on Mac");
  expect(browserName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1")).toBe("Chrome on iPhone");
  expect(browserName("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0")).toBe("Firefox on Windows");
  expect(browserName("")).toBe("Unknown browser");
});

test("secrets are sealed with AES-256-GCM per person and open only with the same key, person and kind", async () => {
  const { app } = await setUp();
  const [{ id: peytonId } = { id: "" }] = await app.query<{ id: string }>("select id from users where username = 'peyton'");
  const [{ id: ronjaId } = { id: "" }] = await app.query<{ id: string }>("select id from users where username = 'ronja'");
  const key = randomBytes(32);
  const store = secretStore(app.database, () => new Date("2026-03-01T12:00:00Z"), key);

  await store.put(peytonId, "nemlig", '{"email":"p@example.com","password":"hunter2"}');
  expect(await store.get(peytonId, "nemlig")).toBe('{"email":"p@example.com","password":"hunter2"}');
  expect(await store.get(ronjaId, "nemlig")).toBeUndefined();
  const [row] = await app.query<{ ciphertext: string }>("select ciphertext from secrets");
  expect(Buffer.from(row!.ciphertext, "base64").toString()).not.toContain("hunter2");

  await expect(secretStore(app.database, () => new Date(), randomBytes(32)).get(peytonId, "nemlig")).rejects.toThrow();
  // A sealed value moved to someone else's row doesn't open.
  await app.query("update secrets set user_id = $1", [ronjaId]);
  await expect(store.get(ronjaId, "nemlig")).rejects.toThrow();

  await store.put(ronjaId, "nemlig", "new");
  expect(await store.get(ronjaId, "nemlig")).toBe("new");
  await store.delete(ronjaId, "nemlig");
  expect(await store.get(ronjaId, "nemlig")).toBeUndefined();
});

test("the secret key must be 32 bytes in base64", () => {
  expect(readSecretKey(undefined)).toEqual({ error: "APP_SECRET_KEY is not set." });
  expect(readSecretKey(Buffer.alloc(16).toString("base64"))).toEqual({ error: "APP_SECRET_KEY must be 32 bytes in base64 (got 16 bytes)." });
  expect(Buffer.isBuffer(readSecretKey(randomBytes(32).toString("base64")))).toBe(true);
});
