import request from "supertest";
import { describe, expect, it } from "vitest";
import { DEMO_EDITS, DEMO_TEXT } from "../../shared/demo";
import { FREE_CHECKS } from "../../shared/types";
import { createDemoCorrector, unconfiguredCorrector } from "../src/corrector";
import { as, setup } from "./helpers";

describe("test check", () => {
  it("finds every demo edit in the demo text", async () => {
    const { correctedText, corrections, usage } = await createDemoCorrector().correct(DEMO_TEXT);
    expect(corrections).toHaveLength(DEMO_EDITS.length);
    expect(correctedText).toBe("Vakar es gāju uz veikalu, lai nopirktu maizi. Mēs ar draugu runājām par to, ka laiks ir ļoti silts. Viņš teica, ka rīt būs lietus.");
    expect(usage).toMatchObject({ model: "demo", inputTokens: 0, outputTokens: 0 });
  });

  it("does not call the model or use up free checks, even after they run out", async () => {
    const { app, corrector } = setup();
    for (let i = 0; i < FREE_CHECKS; i++) await request(app).post("/api/documents").set(as("u1")).send({ text: "Mēs gājam." }).expect(201);
    await request(app).post("/api/documents").set(as("u1")).send({ text: "Mēs gājam." }).expect(402);

    const res = await request(app).post("/api/documents/demo").set(as("u1")).expect(201);
    expect(res.body.originalText).toBe(DEMO_TEXT);
    expect(res.body.corrections).toHaveLength(DEMO_EDITS.length);
    expect(corrector.correct).toHaveBeenCalledTimes(FREE_CHECKS);
    const sub = await request(app).get("/api/subscription").set(as("u1")).expect(200);
    expect(sub.body.freeChecksLeft).toBe(0);
  });

  it("needs a session", async () => {
    const { app } = setup();
    await request(app).post("/api/documents/demo").expect(401);
  });

  it("reports a missing API key", async () => {
    await expect(unconfiguredCorrector.correct("x")).rejects.toMatchObject({ code: "MODEL_NOT_CONFIGURED", status: 503 });
  });
});
