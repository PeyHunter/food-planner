import { expect, test } from "vitest";
import { createTestApp, days, startingUsers } from "./support/test-app.ts";

const [peyton] = startingUsers;

test("health reports the database as ok", async () => {
  const app = await createTestApp();
  const response = await app.request("/api/health");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "ok" });
});

test("logging in gives a 400-day session cookie and /api/me shows the user and kitchen", async () => {
  const app = await createTestApp();
  const { response, setCookie, cookie } = await app.logIn("Peyton", peyton!.password);

  expect(response.status).toBe(204);
  expect(setCookie).toContain("Max-Age=34560000");
  expect(setCookie).toContain("HttpOnly");
  const me = await app.request("/api/me", { headers: { cookie: cookie! } });
  expect(me.status).toBe(200);
  expect(await me.json()).toEqual({ username: "peyton", language: "en", kitchen: { id: expect.any(String), name: "Our kitchen", kids: true, nemligOn: false } });
});

test("the cookie is Secure when the app runs on https", async () => {
  const app = await createTestApp({ publicUrl: "https://food-planner.example" });
  const { setCookie } = await app.logIn("peyton", peyton!.password);
  expect(setCookie).toContain("Secure");
});

test("a wrong password or unknown name is refused", async () => {
  const app = await createTestApp();
  expect((await app.logIn("peyton", "wrong")).response.status).toBe(401);
  expect((await app.logIn("nobody", peyton!.password)).response.status).toBe(401);
  expect((await app.logIn("peyton", "wrong")).setCookie).toBeNull();
});

test("/api/me without a session is 401", async () => {
  const app = await createTestApp();
  expect((await app.request("/api/me")).status).toBe(401);
  expect((await app.request("/api/me", { headers: { cookie: "fp_session=made-up" } })).status).toBe(401);
});

test("logging out ends the session", async () => {
  const app = await createTestApp();
  const { cookie } = await app.logIn("peyton", peyton!.password);

  const out = await app.request("/api/logout", { method: "POST", headers: { cookie: cookie! } });

  expect(out.status).toBe(204);
  expect((await app.request("/api/me", { headers: { cookie: cookie! } })).status).toBe(401);
});

test("a session lasts 400 days, then ends", async () => {
  const app = await createTestApp();
  const { cookie } = await app.logIn("peyton", peyton!.password);

  app.clock.advance(days(399));
  expect((await app.request("/api/me", { headers: { cookie: cookie! } })).status).toBe(200);
  app.clock.advance(days(2));
  expect((await app.request("/api/me", { headers: { cookie: cookie! } })).status).toBe(401);
});

test("after 10 wrong passwords that name is locked for 15 minutes, even with the right password and from elsewhere", async () => {
  const app = await createTestApp();
  for (let i = 0; i < 10; i++) expect((await app.logIn("peyton", "wrong", { ip: `10.0.0.${i}` })).response.status).toBe(401);

  const locked = await app.logIn("peyton", peyton!.password, { ip: "10.0.1.1" });
  expect(locked.response.status).toBe(429);
  expect(await locked.response.json()).toEqual({ error: "Too many wrong tries. Wait 15 minutes and try again." });
  expect((await app.logIn("ronja", startingUsers[1]!.password, { ip: "10.0.1.2" })).response.status).toBe(204);
  app.clock.advance(15 * 60 * 1000 + 1);
  expect((await app.logIn("peyton", peyton!.password, { ip: "10.0.1.1" })).response.status).toBe(204);
});

test("after 10 wrong tries from one address, that address waits, whatever the name", async () => {
  const app = await createTestApp();
  for (let i = 0; i < 10; i++) await app.logIn(`guess${i}`, "wrong", { ip: "203.0.113.7" });

  expect((await app.logIn("ronja", startingUsers[1]!.password, { ip: "203.0.113.7" })).response.status).toBe(429);
  expect((await app.logIn("ronja", startingUsers[1]!.password, { ip: "203.0.113.8" })).response.status).toBe(204);
});

test("the last X-Forwarded-For entry counts, so a made-up one in front doesn't dodge the limit", async () => {
  const app = await createTestApp();
  for (let i = 0; i < 10; i++) await app.logIn(`guess${i}`, "wrong", { ip: `1.1.1.${i}, 203.0.113.9` });
  expect((await app.logIn("ronja", startingUsers[1]!.password, { ip: "9.9.9.9, 203.0.113.9" })).response.status).toBe(429);
});

test("a good login clears the count, and the count survives a restart because it lives in the database", async () => {
  const app = await createTestApp();
  for (let i = 0; i < 9; i++) await app.logIn("peyton", "wrong", { ip: "10.0.2.1" });
  expect((await app.logIn("peyton", peyton!.password, { ip: "10.0.2.1" })).response.status).toBe(204);
  for (let i = 0; i < 9; i++) await app.logIn("peyton", "wrong", { ip: "10.0.2.1" });
  expect((await app.logIn("peyton", peyton!.password, { ip: "10.0.2.1" })).response.status).toBe(204);

  expect(await app.query("select count(*)::int as n from login_failures")).toEqual([{ n: 0 }]);
  await app.logIn("peyton", "wrong", { ip: "10.0.2.1" });
  expect(await app.query("select key from login_failures order by key")).toEqual([{ key: "ip:10.0.2.1" }, { key: "name:peyton" }]);
});

test("responses carry security headers", async () => {
  const app = await createTestApp();
  const response = await app.request("/api/health");
  expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
  expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  expect(response.headers.get("referrer-policy")).toBe("same-origin");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
});

test("a change sent from a page on another site is refused; the app's own pages and plain clients get through", async () => {
  const app = await createTestApp({ publicUrl: "https://food-planner.example" });
  const { cookie } = await app.logIn("peyton", peyton!.password);
  const post = (origin?: string) => app.request("/api/logout", { method: "POST", headers: { cookie: cookie!, ...(origin ? { origin } : {}) } });

  expect((await post("https://evil.example")).status).toBe(403);
  expect((await app.request("/api/me", { headers: { cookie: cookie! } })).status).toBe(200);
  expect((await post("https://food-planner.example")).status).toBe(204);
  expect((await post()).status).toBe(204);
});
