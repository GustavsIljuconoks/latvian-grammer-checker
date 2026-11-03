import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { as, setup } from "./helpers";

describe("API", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
  });

  it("answers health checks without a session", async () => {
    await request(t.app).get("/api/health").expect(200, { ok: true });
  });

  it("rejects requests without a session", async () => {
    await request(t.app).get("/api/documents").expect(401, { code: "UNAUTHORIZED" });
    await request(t.app).post("/api/documents").send({ text: "x" }).expect(401);
  });

  describe("POST /api/documents", () => {
    it("corrects, saves and returns the document", async () => {
      const res = await request(t.app).post("/api/documents").set(as("u1")).send({ text: "Mēs gājam mājās." }).expect(201);
      expect(res.body).toMatchObject({
        title: "Mēs gājām mājās.",
        wordCount: 3,
        correctionCount: 1,
        originalText: "Mēs gājam mājās.",
        correctedText: "Mēs gājām mājās.",
        corrections: [{ original: "gājam", replacement: "gājām", start: 4, end: 9 }],
      });
      expect(t.usage).toEqual([{ userId: "u1", model: "m", inputTokens: 10, outputTokens: 2, fragments: 1 }]);
    });

    it.each([
      [{ text: "   \n" }, 400, "TEXT_EMPTY"],
      [{ text: "a".repeat(20_001) }, 400, "TEXT_TOO_LONG"],
      [{ text: 5 }, 400, "BAD_REQUEST"],
      [{}, 400, "BAD_REQUEST"],
    ])("validates %#", async (body, status, code) => {
      await request(t.app).post("/api/documents").set(as("u1")).send(body).expect(status, { code });
      expect(t.corrector.correct).not.toHaveBeenCalled();
    });

    it("rejects malformed JSON", async () => {
      await request(t.app).post("/api/documents").set(as("u1")).set("content-type", "application/json").send("{").expect(400, { code: "BAD_REQUEST" });
    });

    it("reports a failed correction and saves nothing", async () => {
      await request(t.app).post("/api/documents").set(as("u1")).send({ text: "Teksts #kluda" }).expect(502, { code: "CORRECTION_FAILED" });
      expect(t.docs).toHaveLength(0);
    });

    it("limits checks per user per minute", async () => {
      t = setup({ checksPerMinute: 2 });
      for (let i = 0; i < 2; i++) await request(t.app).post("/api/documents").set(as("u1")).send({ text: "Teksts." }).expect(201);
      await request(t.app).post("/api/documents").set(as("u1")).send({ text: "Teksts." }).expect(429, { code: "RATE_LIMITED" });
      await request(t.app).post("/api/documents").set(as("u2")).send({ text: "Teksts." }).expect(201);
    });
  });

  describe("history", () => {
    async function create(userId: string, text: string): Promise<string> {
      const res = await request(t.app).post("/api/documents").set(as(userId)).send({ text });
      return res.body.id;
    }

    it("lists only the user's own documents, as summaries", async () => {
      await create("u1", "Pirmais.");
      await create("u2", "Svešs.");
      const res = await request(t.app).get("/api/documents").set(as("u1")).expect(200);
      expect(res.body).toHaveLength(1);
      expect(Object.keys(res.body[0]).sort()).toEqual(["correctionCount", "createdAt", "id", "title", "wordCount"]);
    });

    it("filters by date", async () => {
      await create("u1", "Teksts.");
      const future = new Date(Date.now() + 60_000).toISOString();
      const past = new Date(Date.now() - 60_000).toISOString();
      expect((await request(t.app).get(`/api/documents?from=${future}`).set(as("u1"))).body).toHaveLength(0);
      expect((await request(t.app).get(`/api/documents?from=${past}&to=${future}`).set(as("u1"))).body).toHaveLength(1);
      await request(t.app).get("/api/documents?from=vakar").set(as("u1")).expect(400, { code: "BAD_REQUEST" });
    });

    it("gets a document only for its owner", async () => {
      const id = await create("u1", "Mēs gājam.");
      const res = await request(t.app).get(`/api/documents/${id}`).set(as("u1")).expect(200);
      expect(res.body.correctedText).toBe("Mēs gājām.");
      await request(t.app).get(`/api/documents/${id}`).set(as("u2")).expect(404, { code: "NOT_FOUND" });
    });

    it("deletes one document, only for its owner", async () => {
      const id = await create("u1", "Teksts.");
      await request(t.app).delete(`/api/documents/${id}`).set(as("u2")).expect(404);
      await request(t.app).delete(`/api/documents/${id}`).set(as("u1")).expect(204);
      await request(t.app).delete(`/api/documents/${id}`).set(as("u1")).expect(404);
    });

    it("deletes all of a user's documents", async () => {
      await create("u1", "A.");
      await create("u1", "B.");
      await create("u2", "C.");
      await request(t.app).delete("/api/documents").set(as("u1")).expect(204);
      expect(t.docs.map((d) => d.userId)).toEqual(["u2"]);
    });
  });

  describe("account", () => {
    it("signs the user out everywhere", async () => {
      await request(t.app).post("/api/me/sign-out-everywhere").set(as("u1")).expect(204);
      expect(t.account.revokeAllSessions).toHaveBeenCalledWith("u1");
    });

    it("deletes the user's data, then the Clerk account", async () => {
      await request(t.app).post("/api/documents").set(as("u1")).send({ text: "A." });
      await request(t.app).delete("/api/me").set(as("u1")).expect(204);
      expect(t.docs).toHaveLength(0);
      expect(t.usage).toHaveLength(0);
      expect(t.account.deleteUser).toHaveBeenCalledWith("u1");
    });

    it("hides unexpected errors behind INTERNAL", async () => {
      vi.mocked(t.account.deleteUser).mockRejectedValueOnce(new Error("clerk down"));
      vi.spyOn(console, "error").mockImplementationOnce(() => {});
      await request(t.app).delete("/api/me").set(as("u1")).expect(500, { code: "INTERNAL" });
    });
  });

  it("returns NOT_FOUND for unknown API routes", async () => {
    await request(t.app).get("/api/nope").set(as("u1")).expect(404, { code: "NOT_FOUND" });
  });
});
