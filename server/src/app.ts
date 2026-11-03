import path from "node:path";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { countWords, FREE_CHECKS, MAX_TEXT_CHARS, type SubscriptionInfo } from "../../shared/types";
import { DEMO_TEXT } from "../../shared/demo";
import type { AccountService } from "./account";
import { handleStripeEvent, isActive, syncCheckoutSession, type Billing } from "./billing";
import type { Corrector } from "./corrector";
import { HttpError } from "./errors";
import { createRateLimiter } from "./rate-limit";
import type { Store } from "./store";

export interface AppDeps {
  store: Store;
  corrector: Corrector;
  /** Checks DEMO_TEXT without a model, for testing. */
  demoCorrector: Corrector;
  account: AccountService;
  billing: Billing;
  /** Middleware that reads the session, e.g. Clerk's. Runs before every /api route. */
  authenticate: RequestHandler;
  /** The signed-in user's id, or null. */
  userIdOf: (req: Request) => string | null;
  /** Correction requests allowed per user per minute. */
  checksPerMinute?: number;
  /** The built client (client/dist). When set, the server also serves the web app, as in Docker. */
  clientDir?: string;
}

const CreateBody = z.object({ text: z.string() });
const SyncBody = z.object({ sessionId: z.string().startsWith("cs_") });
const ListQuery = z.object({ from: z.iso.datetime({ offset: true }).optional(), to: z.iso.datetime({ offset: true }).optional() });

function titleOf(text: string): string {
  const firstLine = text.trim().split("\n")[0].trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine;
}

export function createApp(deps: AppDeps) {
  const { store, corrector, account, billing } = deps;
  const limiter = createRateLimiter(deps.checksPerMinute ?? 10, 60_000);
  const app = express();
  app.disable("x-powered-by");

  // Stripe signs the exact bytes it sends, so this route reads the raw body and has no session.
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    let event;
    try {
      event = billing.parseWebhook(req.body as Buffer, req.header("stripe-signature") ?? "");
    } catch {
      throw new HttpError("BAD_REQUEST");
    }
    await handleStripeEvent(event, billing, store);
    res.json({ received: true });
  });

  // 20,000 characters of Latvian is at most ~80 KB of UTF-8, plus JSON escaping.
  app.use(express.json({ limit: "200kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  const api = express.Router();
  api.use(deps.authenticate);
  api.use((req, res, next) => {
    const userId = deps.userIdOf(req);
    if (!userId) throw new HttpError("UNAUTHORIZED");
    res.locals.userId = userId;
    next();
  });
  const userId = (res: Response): string => res.locals.userId;

  async function check(user: string, text: string, using: Corrector, opts?: { free?: boolean }) {
    const { correctedText, corrections, usage } = await using.correct(text);
    return store.createDocument(
      user,
      { title: titleOf(correctedText), wordCount: countWords(correctedText), originalText: text, correctedText, corrections },
      usage,
      opts,
    );
  }

  api.post("/documents", async (req, res) => {
    const body = CreateBody.safeParse(req.body);
    if (!body.success) throw new HttpError("BAD_REQUEST");
    const { text } = body.data;
    if (!text.trim()) throw new HttpError("TEXT_EMPTY");
    if (text.length > MAX_TEXT_CHARS) throw new HttpError("TEXT_TOO_LONG");
    if (!limiter.hit(userId(res))) throw new HttpError("RATE_LIMITED");
    const [subscription, checksUsed] = await Promise.all([store.getSubscription(userId(res)), store.countChecks(userId(res))]);
    if (!isActive(subscription?.status) && checksUsed >= FREE_CHECKS) throw new HttpError("SUBSCRIPTION_REQUIRED");

    res.status(201).json(await check(userId(res), text, corrector));
  });

  // A test check: always the same text, no model call, not counted against the free checks.
  api.post("/documents/demo", async (_req, res) => {
    if (!limiter.hit(userId(res))) throw new HttpError("RATE_LIMITED");
    res.status(201).json(await check(userId(res), DEMO_TEXT, deps.demoCorrector, { free: true }));
  });

  api.get("/documents", async (req, res) => {
    const query = ListQuery.safeParse(req.query);
    if (!query.success) throw new HttpError("BAD_REQUEST");
    const { from, to } = query.data;
    res.json(await store.listDocuments(userId(res), { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined }));
  });

  api.get("/documents/:id", async (req, res) => {
    const doc = await store.getDocument(userId(res), req.params.id);
    if (!doc) throw new HttpError("NOT_FOUND");
    res.json(doc);
  });

  api.delete("/documents/:id", async (req, res) => {
    if (!(await store.deleteDocument(userId(res), req.params.id))) throw new HttpError("NOT_FOUND");
    res.status(204).end();
  });

  api.delete("/documents", async (_req, res) => {
    await store.deleteAllDocuments(userId(res));
    res.status(204).end();
  });

  async function subscriptionInfo(userId: string): Promise<SubscriptionInfo> {
    const [subscription, checksUsed] = await Promise.all([store.getSubscription(userId), store.countChecks(userId)]);
    return {
      active: isActive(subscription?.status),
      status: subscription?.status ?? null,
      freeChecksLeft: Math.max(0, FREE_CHECKS - checksUsed),
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    };
  }

  api.get("/subscription", async (_req, res) => {
    res.json(await subscriptionInfo(userId(res)));
  });

  // Called by the page Stripe redirects to after payment, so activation doesn't wait for the webhook.
  api.post("/subscription/sync", async (req, res) => {
    const body = SyncBody.safeParse(req.body);
    if (!body.success) throw new HttpError("BAD_REQUEST");
    let synced;
    try {
      synced = await syncCheckoutSession(body.data.sessionId, userId(res), billing, store);
    } catch (err) {
      if (!(err instanceof Stripe.errors.StripeInvalidRequestError)) throw err;
      synced = false; // no such session
    }
    if (!synced) throw new HttpError("NOT_FOUND");
    res.json(await subscriptionInfo(userId(res)));
  });

  api.post("/subscription/checkout", async (_req, res) => {
    const subscription = await store.getSubscription(userId(res));
    if (isActive(subscription?.status)) throw new HttpError("BAD_REQUEST"); // already subscribed: use the portal
    res.json({ url: await billing.createCheckout(userId(res), subscription?.stripeCustomerId ?? null) });
  });

  api.post("/subscription/portal", async (_req, res) => {
    const subscription = await store.getSubscription(userId(res));
    if (!subscription) throw new HttpError("NOT_FOUND");
    res.json({ url: await billing.createPortal(subscription.stripeCustomerId) });
  });

  api.post("/me/sign-out-everywhere", async (_req, res) => {
    await account.revokeAllSessions(userId(res));
    res.status(204).end();
  });

  api.delete("/me", async (_req, res) => {
    // Stop billing first, then data, then Clerk: if a step fails, the user can retry,
    // and they are never charged for an account that no longer exists.
    const subscription = await store.getSubscription(userId(res));
    if (subscription?.stripeSubscriptionId && subscription.status !== "canceled" && subscription.status !== "incomplete_expired") {
      await billing.cancelSubscription(subscription.stripeSubscriptionId);
    }
    await store.deleteUser(userId(res));
    await account.deleteUser(userId(res));
    res.status(204).end();
  });

  app.use("/api", api);
  app.use("/api", () => {
    throw new HttpError("NOT_FOUND");
  });

  if (deps.clientDir) {
    const clientDir = deps.clientDir;
    app.use(express.static(clientDir, { index: false }));
    // The client routes in the browser (/vesture, /dokuments/…), so every other path gets the app.
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(clientDir, "index.html"));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      if (err.status >= 500) console.error(err.code, err.cause ?? "");
      res.status(err.status).json({ code: err.code });
      return;
    }
    // express.json() rejects malformed or oversized bodies with a status of its own.
    const status = (err as { status?: number }).status;
    if (status === 413) {
      res.status(413).json({ code: "TEXT_TOO_LONG" });
      return;
    }
    if (status === 400) {
      res.status(400).json({ code: "BAD_REQUEST" });
      return;
    }
    console.error(err);
    res.status(500).json({ code: "INTERNAL" });
  });

  return app;
}
