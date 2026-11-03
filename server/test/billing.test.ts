import request from "supertest";
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStripeBilling } from "../src/billing";
import type { SubscriptionRecord } from "../src/store";
import { as, setup } from "./helpers";

const activeSub = (userId: string): SubscriptionRecord => ({
  userId,
  stripeCustomerId: "cus_1",
  stripeSubscriptionId: "sub_1",
  status: "active",
  currentPeriodEnd: new Date("2026-12-01T00:00:00Z"),
  cancelAtPeriodEnd: false,
});

function check(app: ReturnType<typeof setup>["app"], userId = "u1") {
  return request(app).post("/api/documents").set(as(userId)).send({ text: "Teksts." });
}

describe("free checks and subscriptions", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
  });

  it("allows 3 free checks, then requires a subscription", async () => {
    for (let i = 0; i < 3; i++) await check(t.app).expect(201);
    await check(t.app).expect(402, { code: "SUBSCRIPTION_REQUIRED" });
    expect(t.corrector.correct).toHaveBeenCalledTimes(3);
  });

  it("doesn't give checks back when history is deleted", async () => {
    for (let i = 0; i < 3; i++) await check(t.app);
    await request(t.app).delete("/api/documents").set(as("u1")).expect(204);
    await check(t.app).expect(402);
  });

  it("doesn't count failed checks", async () => {
    await request(t.app).post("/api/documents").set(as("u1")).send({ text: "#kluda" }).expect(502);
    expect(t.checks.get("u1") ?? 0).toBe(0);
  });

  it("allows unlimited checks with an active subscription, but not a lapsed one", async () => {
    t.subscriptions.set("u1", activeSub("u1"));
    for (let i = 0; i < 5; i++) await check(t.app).expect(201);
    t.subscriptions.set("u1", { ...activeSub("u1"), status: "past_due" });
    await check(t.app).expect(402);
  });

  it("reports the subscription state", async () => {
    await check(t.app);
    await request(t.app)
      .get("/api/subscription")
      .set(as("u1"))
      .expect(200, { active: false, status: null, freeChecksLeft: 2, currentPeriodEnd: null, cancelAtPeriodEnd: false });

    t.subscriptions.set("u1", activeSub("u1"));
    const res = await request(t.app).get("/api/subscription").set(as("u1")).expect(200);
    expect(res.body).toMatchObject({ active: true, status: "active", currentPeriodEnd: "2026-12-01T00:00:00.000Z" });
  });

  it("starts Checkout, reusing the Stripe customer if there is one", async () => {
    await request(t.app).post("/api/subscription/checkout").set(as("u1")).expect(200, { url: "https://checkout.stripe.test/session" });
    expect(t.billing.createCheckout).toHaveBeenLastCalledWith("u1", null);

    t.subscriptions.set("u1", { ...activeSub("u1"), status: "canceled" });
    await request(t.app).post("/api/subscription/checkout").set(as("u1")).expect(200);
    expect(t.billing.createCheckout).toHaveBeenLastCalledWith("u1", "cus_1");
  });

  it("refuses Checkout when already subscribed", async () => {
    t.subscriptions.set("u1", activeSub("u1"));
    await request(t.app).post("/api/subscription/checkout").set(as("u1")).expect(400, { code: "BAD_REQUEST" });
  });

  it("opens the billing portal only for Stripe customers", async () => {
    await request(t.app).post("/api/subscription/portal").set(as("u1")).expect(404);
    t.subscriptions.set("u1", activeSub("u1"));
    await request(t.app).post("/api/subscription/portal").set(as("u1")).expect(200, { url: "https://billing.stripe.test/portal" });
    expect(t.billing.createPortal).toHaveBeenCalledWith("cus_1");
  });

  it("cancels the subscription when the account is deleted", async () => {
    t.subscriptions.set("u1", activeSub("u1"));
    await request(t.app).delete("/api/me").set(as("u1")).expect(204);
    expect(t.billing.cancelSubscription).toHaveBeenCalledWith("sub_1");
    expect(t.subscriptions.has("u1")).toBe(false);
  });

  it("doesn't cancel an already cancelled subscription", async () => {
    t.subscriptions.set("u1", { ...activeSub("u1"), status: "canceled" });
    await request(t.app).delete("/api/me").set(as("u1")).expect(204);
    expect(t.billing.cancelSubscription).not.toHaveBeenCalled();
  });
});

describe("syncing right after Checkout", () => {
  const sub = {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    metadata: { userId: "u1" },
    items: { data: [{ current_period_end: 1_800_000_000 }] },
  } as unknown as Stripe.Subscription;

  function syncSetup(session: Partial<Stripe.Checkout.Session> | Error) {
    const t = setup();
    vi.mocked(t.billing.getSubscription).mockResolvedValue(sub);
    if (session instanceof Error) vi.mocked(t.billing.getCheckoutSession).mockRejectedValue(session);
    else vi.mocked(t.billing.getCheckoutSession).mockResolvedValue(session as Stripe.Checkout.Session);
    return t;
  }

  it("activates the subscription without waiting for the webhook", async () => {
    const t = syncSetup({ client_reference_id: "u1", mode: "subscription", subscription: "sub_1" });
    const res = await request(t.app).post("/api/subscription/sync").set(as("u1")).send({ sessionId: "cs_test_1" }).expect(200);
    expect(res.body).toMatchObject({ active: true, status: "active" });
    expect(t.subscriptions.get("u1")?.status).toBe("active");
    expect(t.billing.getCheckoutSession).toHaveBeenCalledWith("cs_test_1");
  });

  it("won't sync another user's session", async () => {
    const t = syncSetup({ client_reference_id: "u2", mode: "subscription", subscription: "sub_1" });
    await request(t.app).post("/api/subscription/sync").set(as("u1")).send({ sessionId: "cs_test_1" }).expect(404);
    expect(t.subscriptions.size).toBe(0);
  });

  it("answers NOT_FOUND for an unknown session and BAD_REQUEST for a malformed id", async () => {
    const t = syncSetup(new Stripe.errors.StripeInvalidRequestError({ message: "No such checkout.session" }));
    await request(t.app).post("/api/subscription/sync").set(as("u1")).send({ sessionId: "cs_nope" }).expect(404, { code: "NOT_FOUND" });
    await request(t.app).post("/api/subscription/sync").set(as("u1")).send({ sessionId: "sub_1" }).expect(400);
  });
});

describe("Stripe webhook", () => {
  const secret = "whsec_test";
  const stripe = new Stripe("sk_test_dummy");

  function stripeSub(status: Stripe.Subscription.Status, metadata: Record<string, string> = { userId: "u1" }) {
    return {
      id: "sub_1",
      customer: "cus_1",
      status,
      cancel_at_period_end: false,
      metadata,
      items: { data: [{ current_period_end: 1_800_000_000 }] },
    } as unknown as Stripe.Subscription;
  }

  function webhookSetup(sub: Stripe.Subscription) {
    const billing = createStripeBilling(stripe, { webhookSecret: secret, priceId: "price_1", appUrl: "http://localhost:5173" });
    billing.getSubscription = vi.fn(async () => sub);
    return setup({ billing });
  }

  function send(app: ReturnType<typeof setup>["app"], event: object, signWith = secret) {
    const payload = JSON.stringify(event);
    return request(app)
      .post("/api/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", stripe.webhooks.generateTestHeaderString({ payload, secret: signWith }))
      .send(payload);
  }

  it("activates the subscription after a completed Checkout (spec 4.2)", async () => {
    const t = webhookSetup(stripeSub("active", {}));
    await send(t.app, {
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", subscription: "sub_1", client_reference_id: "u1" } },
    }).expect(200);
    expect(t.subscriptions.get("u1")).toEqual({
      userId: "u1",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "active",
      currentPeriodEnd: new Date(1_800_000_000 * 1000),
      cancelAtPeriodEnd: false,
    });
    await check(t.app).expect(201);
  });

  it("records a failed renewal from the subscription's latest state", async () => {
    const t = webhookSetup(stripeSub("past_due"));
    t.subscriptions.set("u1", activeSub("u1"));
    await send(t.app, { id: "evt_2", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } }).expect(200);
    expect(t.subscriptions.get("u1")?.status).toBe("past_due");
  });

  it("ignores events it doesn't need", async () => {
    const t = webhookSetup(stripeSub("active"));
    await send(t.app, { id: "evt_3", type: "invoice.paid", data: { object: {} } }).expect(200);
    expect(t.subscriptions.size).toBe(0);
  });

  it("rejects a bad signature", async () => {
    const t = webhookSetup(stripeSub("active"));
    await send(t.app, { id: "evt_4", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } }, "whsec_wrong").expect(400, {
      code: "BAD_REQUEST",
    });
    await request(t.app).post("/api/stripe/webhook").set("content-type", "application/json").send("{}").expect(400);
    expect(t.subscriptions.size).toBe(0);
  });
});
