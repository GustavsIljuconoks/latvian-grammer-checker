// Shared between client and server. Keep it free of runtime dependencies.
export const MAX_TEXT_CHARS = 20_000;

export const ERROR_CODES = [
  "TEXT_EMPTY",
  "TEXT_TOO_LONG",
  "BAD_REQUEST",
  "CORRECTION_FAILED",
  "RATE_LIMITED",
  "SUBSCRIPTION_REQUIRED",
  "MODEL_NOT_CONFIGURED",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const CATEGORIES = ["grammar", "spelling", "punctuation", "style"] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Correction {
  original: string;
  replacement: string;
  explanation: string;
  category: Category;
  start: number;
  end: number;
}

export interface DocumentSummary {
  id: string;
  title: string;
  createdAt: string;
  wordCount: number;
  correctionCount: number;
}

export interface DocumentDetail extends DocumentSummary {
  originalText: string;
  correctedText: string;
  corrections: Correction[];
}

/** Checks a user gets before a subscription is needed. */
export const FREE_CHECKS = 3;

/** Stripe's subscription statuses. */
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "canceled"
  | "paused";

export interface SubscriptionInfo {
  /** True while the subscription gives unlimited checks. */
  active: boolean;
  /** null if the user never subscribed. */
  status: SubscriptionStatus | null;
  freeChecksLeft: number;
  /** When the current period ends: the next payment, or the end of access if cancelled. */
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface ApiError {
  code: ErrorCode;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
