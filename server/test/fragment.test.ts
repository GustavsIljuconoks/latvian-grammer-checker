import { describe, expect, it } from "vitest";
import { fragment } from "../src/fragment";

const join = (text: string, max?: number) => fragment(text, max).map((f) => f.text).join("");

describe("fragment", () => {
  it("keeps a short text as one fragment", () => {
    expect(fragment("Es eju mājās.")).toEqual([{ offset: 0, text: "Es eju mājās." }]);
  });

  it("returns nothing for an empty text", () => {
    expect(fragment("")).toEqual([]);
  });

  it("splits on paragraph boundaries and covers the text exactly", () => {
    const text = "Pirmā rindkopa.\n\nOtrā rindkopa.\nTrešā.";
    const parts = fragment(text, 20);
    expect(parts.map((p) => p.text)).toEqual(["Pirmā rindkopa.\n\n", "Otrā rindkopa.\n", "Trešā."]);
    expect(join(text, 20)).toBe(text);
  });

  it("packs several small paragraphs into one fragment", () => {
    const parts = fragment("A.\nB.\nC.", 100);
    expect(parts).toHaveLength(1);
  });

  it("splits a long paragraph into sentences", () => {
    const text = "Viens teikums. Otrs teikums! Trešais teikums?";
    const parts = fragment(text, 20);
    expect(parts.map((p) => p.text)).toEqual(["Viens teikums. ", "Otrs teikums! ", "Trešais teikums?"]);
  });

  it("hard-splits a sentence longer than the limit at a space", () => {
    const text = "vārds ".repeat(10).trim();
    const parts = fragment(text, 14);
    expect(parts.every((p) => p.text.length <= 14)).toBe(true);
    expect(join(text, 14)).toBe(text);
  });

  it("gives offsets that point at each fragment in the original", () => {
    const text = Array.from({ length: 50 }, (_, i) => `Teikums numur ${i}. `).join("") + "\n\nBeigas.";
    for (const part of fragment(text, 120)) {
      expect(text.slice(part.offset, part.offset + part.text.length)).toBe(part.text);
      expect(part.text.length).toBeLessThanOrEqual(120);
    }
    expect(join(text, 120)).toBe(text);
  });

  it("covers a 20,000-character text with fragments under the default limit", () => {
    const text = "Šis ir garš teksts ar daudziem vārdiem, kas atkārtojas. ".repeat(360).slice(0, 20_000);
    const parts = fragment(text);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.text.length <= 3_000)).toBe(true);
    expect(parts.map((p) => p.text).join("")).toBe(text);
  });
});
