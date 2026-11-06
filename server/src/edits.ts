import type { Category, Correction } from "../../shared/types";

/** One fix as the model reports it. Positions are found by the server, never taken from the model. */
export interface ProposedEdit {
  /** A short exact quote from the text that contains `original`, so repeated words can be told apart. */
  context: string;
  original: string;
  replacement: string;
  explanation: string;
  category: Category;
}

/** An edit pinned to a span of the original text. */
export interface LocatedEdit extends ProposedEdit {
  start: number;
  end: number;
}

function find(text: string, edit: ProposedEdit, from: number): number {
  const contextAt = edit.context ? text.indexOf(edit.context, from) : -1;
  if (contextAt >= 0) {
    const inner = edit.context.indexOf(edit.original);
    if (inner >= 0) return contextAt + inner;
  }
  return text.indexOf(edit.original, from);
}

/**
 * Finds each edit in `text`, in order. Edits that can't be found, change nothing, or overlap an
 * earlier one are dropped: a missing highlight is better than a wrong one.
 */
export function locateEdits(text: string, edits: ProposedEdit[], offset = 0): LocatedEdit[] {
  const located: LocatedEdit[] = [];
  let cursor = 0;
  for (const edit of edits) {
    if (!edit.original || edit.original === edit.replacement) continue;
    let at = find(text, edit, cursor);
    if (at < 0) at = find(text, edit, 0); // reported out of order
    if (at < 0) continue;
    located.push({ ...edit, start: offset + at, end: offset + at + edit.original.length });
    if (at >= cursor) cursor = at + edit.original.length;
  }
  return located;
}

/** Applies located edits to the original text; correction offsets point into the corrected text. */
export function applyEdits(text: string, edits: LocatedEdit[]): { correctedText: string; corrections: Correction[] } {
  let correctedText = "";
  let cursor = 0;
  const corrections: Correction[] = [];
  for (const edit of [...edits].sort((a, b) => a.start - b.start)) {
    if (edit.start < cursor) continue; // overlaps an earlier edit
    correctedText += text.slice(cursor, edit.start);
    const start = correctedText.length;
    correctedText += edit.replacement;
    corrections.push({
      original: edit.original,
      replacement: edit.replacement,
      explanation: edit.explanation,
      category: edit.category,
      start,
      end: correctedText.length,
    });
    cursor = edit.end;
  }
  return { correctedText: correctedText + text.slice(cursor), corrections };
}
