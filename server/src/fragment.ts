// Splits text into fragments along paragraph and sentence boundaries (design doc 5.1.2), so each
// Claude request stays small. Fragments are contiguous and cover the text exactly: joining their
// `text` gives back the input, and `offset` is where each one starts.

export interface Fragment {
  offset: number;
  text: string;
}

export const MAX_FRAGMENT_CHARS = 3_000;

// A paragraph: everything up to and including its run of newlines.
const PARAGRAPH = /[^\n]*(?:\n+|$)/g;
// A sentence: up to and including terminal punctuation (with closing quotes/brackets) and trailing spaces.
const SENTENCE = /[^.!?…]*(?:[.!?…]+["'”»)\]]*\s*|$)/g;

function pieces(text: string, pattern: RegExp): string[] {
  return (text.match(pattern) ?? []).filter((p) => p.length > 0);
}

/** Cuts an over-long sentence at the last whitespace before the limit, or hard at the limit. */
function hardSplit(text: string, max: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const space = rest.lastIndexOf(" ", max);
    const cut = space > 0 ? space + 1 : max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) out.push(rest);
  return out;
}

function units(text: string, max: number): string[] {
  return pieces(text, PARAGRAPH).flatMap((paragraph) =>
    paragraph.length <= max
      ? [paragraph]
      : pieces(paragraph, SENTENCE).flatMap((sentence) => (sentence.length <= max ? [sentence] : hardSplit(sentence, max))),
  );
}

export function fragment(text: string, max = MAX_FRAGMENT_CHARS): Fragment[] {
  const fragments: Fragment[] = [];
  let current = "";
  let offset = 0;
  for (const unit of units(text, max)) {
    if (current && current.length + unit.length > max) {
      fragments.push({ offset, text: current });
      offset += current.length;
      current = "";
    }
    current += unit;
  }
  if (current) fragments.push({ offset, text: current });
  return fragments;
}
