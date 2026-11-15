import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { expect, inject, test } from "vitest";
import { ensureHousehold } from "../src/server/household.ts";
import { sniffType } from "../src/server/kid-documents.ts";
import type { KidDocument } from "../src/shared/children.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n");

async function setUp() {
  const app = await createTestApp();
  const cookie = (await app.logIn("ronja", startingUsers[1]!.password)).cookie!;
  const upload = (bytes: Uint8Array, name: string, title = "", as = cookie) => {
    const form = new FormData();
    form.set("file", new File([bytes], name));
    form.set("title", title);
    return app.request("/api/kid-documents", { method: "POST", headers: { cookie: as }, body: form });
  };
  const list = async (as = cookie) => (await (await app.request("/api/kid-documents", { headers: { cookie: as } })).json()) as KidDocument[];
  return { app, cookie, upload, list };
}

test("a food plan PDF and a photo are kept, opened inline and removed", async () => {
  const { app, cookie, upload, list } = await setUp();
  expect((await upload(pdf, "Kostplan 6-12 mdr.pdf")).status).toBe(201);
  const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#fff" } }).png().toBuffer();
  expect((await upload(new Uint8Array(png), "IMG_2041.PNG", "Sundhedsplejens skema")).status).toBe(201);

  const papers = await list();
  expect(papers.map((paper) => [paper.title, paper.fileType, paper.by])).toEqual([
    ["Sundhedsplejens skema", "png", "ronja"],
    ["Kostplan 6-12 mdr", "pdf", "ronja"],
  ]);
  const opened = await app.request(papers[1]!.url, { headers: { cookie } });
  expect(opened.headers.get("content-type")).toBe("application/pdf");
  expect(opened.headers.get("content-disposition")).toMatch(/^inline; filename\*=UTF-8''Kostplan%206-12%20mdr\.pdf$/);
  expect(opened.headers.get("x-content-type-options")).toBe("nosniff");
  expect(new Uint8Array(await opened.arrayBuffer())).toEqual(pdf);
  expect((await app.request(papers[1]!.url)).status).toBe(401);

  const file = join(inject("scratchDir"), "documents", `${papers[1]!.id}.pdf`);
  expect(existsSync(file)).toBe(true);
  expect((await app.request(`/api/kid-documents/${papers[1]!.id}`, { method: "DELETE", headers: { cookie } })).status).toBe(204);
  expect(existsSync(file)).toBe(false);
  expect((await list()).map((paper) => paper.title)).toEqual(["Sundhedsplejens skema"]);
});

test("only real PDFs and photos are taken, whatever the name says", async () => {
  const { upload, list } = await setUp();
  const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
  expect((await upload(html, "plan.pdf")).status).toBe(400);
  expect((await upload(new Uint8Array(), "empty.pdf")).status).toBe(400);
  expect(await list()).toEqual([]);
  expect(sniffType(pdf)).toBe("pdf");
  expect(sniffType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
  expect(sniffType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
});

test("papers stay in their own kitchen, and a kitchen without kids can't add any", async () => {
  const { app, upload, list } = await setUp();
  expect((await upload(pdf, "plan.pdf")).status).toBe(201);
  const [paper] = await list();
  await ensureHousehold(app.database, [{ username: "isabel", password: "peapear" }, { username: "christopher", password: "limekale" }], { name: "Isabel's", kids: false });
  const isabel = (await app.logIn("isabel", "peapear")).cookie!;
  expect(await list(isabel)).toEqual([]);
  expect((await app.request(paper!.url, { headers: { cookie: isabel } })).status).toBe(404);
  expect((await app.request(`/api/kid-documents/${paper!.id}`, { method: "DELETE", headers: { cookie: isabel } })).status).toBe(404);
  expect((await upload(pdf, "plan.pdf", "", isabel)).status).toBe(403);
});
