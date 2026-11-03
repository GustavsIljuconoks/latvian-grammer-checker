import type { ErrorCode } from "../../shared/types";

const STATUS: Record<ErrorCode, number> = {
  TEXT_EMPTY: 400,
  TEXT_TOO_LONG: 400,
  BAD_REQUEST: 400,
  CORRECTION_FAILED: 502,
  RATE_LIMITED: 429,
  SUBSCRIPTION_REQUIRED: 402,
  MODEL_NOT_CONFIGURED: 503,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL: 500,
};

/** An error the client is meant to see: rendered as `{ code }` with the matching HTTP status. */
export class HttpError extends Error {
  constructor(
    public readonly code: ErrorCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
  }

  get status(): number {
    return STATUS[this.code];
  }
}
