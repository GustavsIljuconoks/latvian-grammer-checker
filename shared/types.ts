// Shared between client and server. Keep it free of runtime dependencies.
export const MAX_TEXT_CHARS = 20_000;

export type Category = "grammar" | "spelling" | "punctuation" | "style";

export type ErrorCode =
  | "TEXT_EMPTY"
  | "TEXT_TOO_LONG"
  | "BAD_REQUEST"
  | "CORRECTION_FAILED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INTERNAL";

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

export interface ApiError {
  code: ErrorCode;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
