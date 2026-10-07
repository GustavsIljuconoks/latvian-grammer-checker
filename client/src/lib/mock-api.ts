import {
  countWords,
  MAX_TEXT_CHARS,
  type Category,
  type Correction,
  type DocumentDetail,
  type DocumentSummary,
} from "../../../shared/types";
import type { Api } from "./api";
import { ApiRequestError } from "./errors";

// ponytail: Phase 1 stand-in for the server so the whole UI is clickable without a backend.
// A few fixed rules instead of Claude, documents in localStorage. Deleted in Task 14.

const LATENCY_MS = 900;
const FAIL_MARKER = "#kluda"; // put this in a text to see the "check failed" state
const storageKey = (userId: string) => `proof-mock-documents:${userId}`;

interface Rule {
  pattern: RegExp;
  replace: (match: string) => string;
  explanation: string;
  category: Category;
}

const RULES: Rule[] = [
  { pattern: /(?<=vajag )maizes\b/gu, replace: () => "maizi", explanation: "Pēc „vajag” lieto akuzatīvu: maizi.", category: "grammar" },
  { pattern: /\bgājam\b/gu, replace: () => "gājām", explanation: "Pagātnes 1. personas daudzskaitlī raksta garo „ā”: gājām.", category: "spelling" },
  { pattern: /\bmajās\b/gu, replace: () => "mājās", explanation: "Vārdu „mājās” raksta ar garo „ā”.", category: "spelling" },
  // The two comma rules must not overlap, or mockCorrect drops the second match: " ,jo" is one match → ", jo".
  { pattern: /\s+,(?=[\s\d]|$)/gu, replace: () => ",", explanation: "Pirms komata atstarpi neliek.", category: "punctuation" },
  { pattern: /\s*,(?=[^\s\d])/gu, replace: () => ", ", explanation: "Komatu raksta tieši aiz vārda, un pēc tā liek atstarpi.", category: "punctuation" },
  { pattern: / {2,}/gu, replace: () => " ", explanation: "Starp vārdiem liek vienu atstarpi.", category: "style" },
  {
    pattern: /(?<=^|[.!?]\s+)[a-zāčēģīķļņšūž]/gu,
    replace: (m) => m.toLocaleUpperCase("lv"),
    explanation: "Teikumu sāk ar lielo burtu.",
    category: "spelling",
  },
];

function mockCorrect(text: string): { correctedText: string; corrections: Correction[] } {
  const found = RULES.flatMap((rule) =>
    [...text.matchAll(rule.pattern)].map((m) => ({ index: m.index ?? 0, original: m[0], rule })),
  ).sort((a, b) => a.index - b.index);

  let correctedText = "";
  let cursor = 0;
  const corrections: Correction[] = [];
  for (const { index, original, rule } of found) {
    if (index < cursor) continue; // overlaps an earlier match
    correctedText += text.slice(cursor, index);
    const start = correctedText.length;
    const replacement = rule.replace(original);
    correctedText += replacement;
    corrections.push({ original, replacement, explanation: rule.explanation, category: rule.category, start, end: correctedText.length });
    cursor = index + original.length;
  }
  return { correctedText: correctedText + text.slice(cursor), corrections };
}

function titleOf(text: string): string {
  const firstLine = text.trim().split("\n")[0].trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine;
}

function load(userId: string): DocumentDetail[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) ?? "[]") as DocumentDetail[];
  } catch {
    return [];
  }
}

function save(userId: string, docs: DocumentDetail[]): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(docs));
  } catch {
    // storage full or blocked: the mock just forgets
  }
}

const delay = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

const toSummary = (d: DocumentDetail): DocumentSummary => ({
  id: d.id,
  title: d.title,
  createdAt: d.createdAt,
  wordCount: d.wordCount,
  correctionCount: d.correctionCount,
});

export function createMockApi(userId: string): Api {
  return {
    async createDocument(text) {
      await delay();
      if (!text.trim()) throw new ApiRequestError("TEXT_EMPTY");
      if (text.length > MAX_TEXT_CHARS) throw new ApiRequestError("TEXT_TOO_LONG");
      if (text.includes(FAIL_MARKER)) throw new ApiRequestError("CORRECTION_FAILED");
      const { correctedText, corrections } = mockCorrect(text);
      const doc: DocumentDetail = {
        id: crypto.randomUUID(),
        title: titleOf(correctedText),
        createdAt: new Date().toISOString(),
        wordCount: countWords(correctedText),
        correctionCount: corrections.length,
        originalText: text,
        correctedText,
        corrections,
      };
      save(userId, [doc, ...load(userId)]);
      return doc;
    },
    async listDocuments(range = {}) {
      const from = range.from ? Date.parse(range.from) : -Infinity;
      const to = range.to ? Date.parse(range.to) : Infinity;
      return load(userId)
        .filter((d) => Date.parse(d.createdAt) >= from && Date.parse(d.createdAt) <= to)
        .map(toSummary);
    },
    async getDocument(id) {
      const doc = load(userId).find((d) => d.id === id);
      if (!doc) throw new ApiRequestError("NOT_FOUND");
      return doc;
    },
    async deleteDocument(id) {
      const docs = load(userId);
      if (!docs.some((d) => d.id === id)) throw new ApiRequestError("NOT_FOUND");
      save(userId, docs.filter((d) => d.id !== id));
    },
    async deleteAllDocuments() {
      save(userId, []);
    },
    async deleteMe() {
      save(userId, []);
    },
  };
}
