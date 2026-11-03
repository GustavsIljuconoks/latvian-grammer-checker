import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, it } from "vitest";
import { as, setup } from "./helpers";

describe("serving the built client (Docker)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "client-"));
  mkdirSync(path.join(dir, "assets"));
  writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>Proof</title>");
  writeFileSync(path.join(dir, "assets", "app.js"), "console.log(1)");
  const { app } = setup({ clientDir: dir });

  it("serves files and falls back to the app for browser routes", async () => {
    await request(app).get("/assets/app.js").expect(200, "console.log(1)");
    await request(app).get("/").expect(200, /<title>Proof<\/title>/);
    await request(app).get("/dokuments/123").expect(200, /<title>Proof<\/title>/);
  });

  it("keeps API errors as JSON", async () => {
    await request(app).get("/api/nope").set(as("u1")).expect(404, { code: "NOT_FOUND" });
    await request(app).get("/api/documents").expect(401, { code: "UNAUTHORIZED" });
  });
});
