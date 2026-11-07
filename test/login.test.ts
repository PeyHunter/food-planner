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
  expect(await me.json()).toEqual({ username: "peyton", kitchen: { id: expect.any(String), name: "Our kitchen" } });
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

test("after 10 wrong passwords that name is locked for 15 minutes, even with the right password", async () => {
  const app = await createTestApp();
  for (let i = 0; i < 10; i++) expect((await app.logIn("peyton", "wrong")).response.status).toBe(401);

  expect((await app.logIn("peyton", peyton!.password)).response.status).toBe(429);
  expect((await app.logIn("ronja", startingUsers[1]!.password)).response.status).toBe(204);
  app.clock.advance(15 * 60 * 1000 + 1);
  expect((await app.logIn("peyton", peyton!.password)).response.status).toBe(204);
});
