import { randomBytes } from "node:crypto";
import { MongoClient, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCipher } from "../src/crypto";
import { createMongoStore, type Store } from "../src/store";

// Needs a real MongoDB: TEST_MONGODB_URI=mongodb://localhost:27017 npm test -w server
// Uses a throwaway database and drops it afterwards.
const uri = process.env.TEST_MONGODB_URI;
const usage = { model: "m", inputTokens: 10, outputTokens: 2, fragments: 1 };
const newDoc = (text: string) => ({
  title: text,
  wordCount: 1,
  originalText: text,
  correctedText: text.replace("gājam", "gājām"),
  corrections: [{ original: "gājam", replacement: "gājām", explanation: "Garais ā.", category: "spelling" as const, start: 0, end: 5 }],
});

describe.skipIf(!uri)("Mongo store", () => {
  let client: MongoClient;
  let db: Db;
  let store: Store;

  beforeAll(async () => {
    client = await MongoClient.connect(uri!);
    db = client.db(`grammar-checker-test-${Date.now()}`);
    store = await createMongoStore(db, createCipher(randomBytes(32)));
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  it("round-trips a document and keeps texts encrypted at rest", async () => {
    const created = await store.createDocument("u1", newDoc("gājam mājās"), usage);
    expect(await store.getDocument("u1", created.id)).toEqual(created);

    const raw = JSON.stringify([
      await db.collection("documents").findOne({ _id: created.id as never }),
      await db.collection("corrections").find({ documentId: created.id }).toArray(),
    ]);
    expect(raw).not.toContain("mājās");
    expect(raw).not.toContain("Garais");
    expect(await db.collection("usage_logs").countDocuments({ userId: "u1" })).toBe(1);
  });

  it("scopes reads and deletes to the user", async () => {
    const mine = await store.createDocument("u2", newDoc("mans"), usage);
    expect(await store.getDocument("u3", mine.id)).toBeNull();
    expect(await store.deleteDocument("u3", mine.id)).toBe(false);
    expect((await store.listDocuments("u2", {})).map((d) => d.id)).toEqual([mine.id]);
  });

  it("filters the list by date, newest first", async () => {
    const a = await store.createDocument("u4", newDoc("a"), usage);
    const b = await store.createDocument("u4", newDoc("b"), usage);
    expect((await store.listDocuments("u4", {})).map((d) => d.id)).toEqual([b.id, a.id]);
    expect(await store.listDocuments("u4", { from: new Date(Date.now() + 60_000) })).toEqual([]);
  });

  it("counts checks and keeps the count when history is deleted", async () => {
    await store.createDocument("u6", newDoc("a"), usage);
    await store.createDocument("u6", newDoc("b"), usage);
    await store.deleteAllDocuments("u6");
    expect(await store.countChecks("u6")).toBe(2);
    expect(await store.countChecks("nobody")).toBe(0);
  });

  it("saves and updates a subscription", async () => {
    expect(await store.getSubscription("u7")).toBeNull();
    const record = {
      userId: "u7",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "active" as const,
      currentPeriodEnd: new Date("2026-12-01T00:00:00Z"),
      cancelAtPeriodEnd: false,
    };
    await store.saveSubscription(record);
    await store.saveSubscription({ ...record, status: "past_due" });
    expect(await store.getSubscription("u7")).toEqual({ ...record, status: "past_due" });
  });

  it("deletes history, then everything for the user", async () => {
    await store.createDocument("u5", newDoc("x"), usage);
    await store.deleteAllDocuments("u5");
    expect(await store.listDocuments("u5", {})).toEqual([]);
    expect(await db.collection("corrections").countDocuments({ userId: "u5" })).toBe(0);
    expect(await db.collection("usage_logs").countDocuments({ userId: "u5" })).toBe(1);

    await store.saveSubscription({
      userId: "u5",
      stripeCustomerId: "cus_5",
      stripeSubscriptionId: null,
      status: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    await store.deleteUser("u5");
    expect(await store.getSubscription("u5")).toBeNull();
    expect(await db.collection("usage_logs").countDocuments({ userId: "u5" })).toBe(0);
    expect(await db.collection("users").countDocuments({ _id: "u5" as never })).toBe(0);
  });
});
