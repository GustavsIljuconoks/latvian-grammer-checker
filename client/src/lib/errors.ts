import type { ErrorCode } from "../../../shared/types";
import { t } from "@/i18n";

export class ApiRequestError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(code);
  }
}

export function errorMessage(err: unknown): string {
  return t.errors[err instanceof ApiRequestError ? err.code : "INTERNAL"];
}
