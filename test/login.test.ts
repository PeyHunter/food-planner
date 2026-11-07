import { beforeAll, expect, test } from "vitest";
import { seed } from "../src/server/seed.ts";
import { cookieFrom, createTestApp, days } from "./support/test-app.ts";

let app: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  app = await createTestApp();
  await seed(app.database, { peyton: "pey-pass", ronja: "ron-pass" });
});

const logIn = (username: string, password: string) =>
  app.request("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });

const session = (response: Response) => cookieFrom(response, "fp_session")?.split(";")[0];

test("health check answers ok", async () => {
  const response = await app.request("/healthz");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "ok" });
});

test("a good password logs in with a 400-day cookie, and /api/me knows who it is", async () => {
  const response = await logIn("Peyton", "pey-pass");
  expect(response.status).toBe(200);
  const setCookie = cookieFrom(response, "fp_session")!;
  expect(setCookie).toMatch(/HttpOnly/);
  expect(setCookie).toMatch(/Max-Age=34560000/);

  const me = await app.request("/api/me", { headers: { cookie: session(response)! } });
  expect(me.status).toBe(200);
  expect(await me.json()).toMatchObject({ username: "peyton", kitchen: { name: "Home" } });
});

test("a wrong password or unknown user is refused in plain words", async () => {
  for (const [username, password] of [["peyton", "nope"], ["nobody", "pey-pass"]] as const) {
    const response = await logIn(username, password);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "That username or password is wrong." });
    expect(session(response)).toBeUndefined();
  }
});

test("without a session /api/me says not logged in", async () => {
  expect((await app.request("/api/me")).status).toBe(401);
  expect((await app.request("/api/me", { headers: { cookie: "fp_session=made-up" } })).status).toBe(401);
});

test("logout ends the session", async () => {
  const cookie = session(await logIn("ronja", "ron-pass"))!;
  const out = await app.request("/api/logout", { method: "POST", headers: { cookie } });
  expect(out.status).toBe(204);
  expect(cookieFrom(out, "fp_session")).toMatch(/Max-Age=0/);
  expect((await app.request("/api/me", { headers: { cookie } })).status).toBe(401);
});

test("a session stops working after 400 days", async () => {
  const cookie = session(await logIn("ronja", "ron-pass"))!;
  app.clock.advance(days(399));
  expect((await app.request("/api/me", { headers: { cookie } })).status).toBe(200);
  app.clock.advance(days(2));
  expect((await app.request("/api/me", { headers: { cookie } })).status).toBe(401);
});

test("after 10 wrong passwords the username is locked for 15 minutes", async () => {
  for (let i = 0; i < 10; i++) expect((await logIn("peyton", "wrong")).status).toBe(401);
  const locked = await logIn("peyton", "pey-pass");
  expect(locked.status).toBe(429);
  app.clock.advance(15 * 60 * 1000);
  expect((await logIn("peyton", "pey-pass")).status).toBe(200);
});
