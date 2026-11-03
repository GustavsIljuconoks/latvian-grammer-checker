import { vi } from "vitest";
import type { AccountService } from "../src/account";
import { createApp } from "../src/app";
import type { Billing } from "../src/billing";
import { createDemoCorrector, type Corrector } from "../src/corrector";
import { HttpError } from "../src/errors";
import { createMemoryStore } from "./memory-store";

// The test "session" is just the user id in a header.
export const as = (userId: string) => ({ "x-test-user": userId });

export function fakeBilling(): Billing {
  return {
    createCheckout: vi.fn(async () => "https://checkout.stripe.test/session"),
    createPortal: vi.fn(async () => "https://billing.stripe.test/portal"),
    parseWebhook: vi.fn(() => {
      throw new Error("bad signature");
    }),
    getSubscription: vi.fn(async () => {
      throw new Error("not stubbed");
    }),
    getCheckoutSession: vi.fn(async () => {
      throw new Error("not stubbed");
    }),
    cancelSubscription: vi.fn(async () => {}),
  };
}

export function setup(opts: { checksPerMinute?: number; billing?: Billing; clientDir?: string } = {}) {
  const memory = createMemoryStore();
  const corrector: Corrector = {
    correct: vi.fn(async (text: string) => {
      if (text.includes("#kluda")) throw new HttpError("CORRECTION_FAILED");
      const correctedText = text.replace("gājam", "gājām");
      const start = correctedText.indexOf("gājām");
      return {
        correctedText,
        corrections:
          start >= 0 ? [{ original: "gājam", replacement: "gājām", explanation: "x", category: "spelling" as const, start, end: start + 5 }] : [],
        usage: { model: "m", inputTokens: 10, outputTokens: 2, fragments: 1 },
      };
    }),
  };
  const account: AccountService = { revokeAllSessions: vi.fn(async () => {}), deleteUser: vi.fn(async () => {}) };
  const billing = opts.billing ?? fakeBilling();
  const app = createApp({
    ...memory,
    corrector,
    demoCorrector: createDemoCorrector(),
    account,
    billing,
    authenticate: (_req, _res, next) => next(),
    userIdOf: (req) => req.header("x-test-user") ?? null,
    checksPerMinute: opts.checksPerMinute,
    clientDir: opts.clientDir,
  });
  return { app, corrector, account, billing, ...memory };
}

