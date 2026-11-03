import { describe, expect, it } from "vitest";
import { applyEdits, locateEdits, type ProposedEdit } from "../src/edits";

const edit = (original: string, replacement: string, context = original): ProposedEdit => ({
  context,
  original,
  replacement,
  explanation: "x",
  category: "spelling",
});

function correct(text: string, edits: ProposedEdit[]) {
  return applyEdits(text, locateEdits(text, edits));
}

describe("locateEdits + applyEdits", () => {
  it("applies edits and points offsets into the corrected text", () => {
    const text = "es vakar gājam uz veikalu ,jo man vajag maizes.";
    const { correctedText, corrections } = correct(text, [
      edit("es", "Es", "es vakar"),
      edit("gājam", "gājām"),
      edit(" ,jo", ", jo"),
      edit("maizes", "maizi"),
    ]);
    expect(correctedText).toBe("Es vakar gājām uz veikalu, jo man vajag maizi.");
    for (const c of corrections) expect(correctedText.slice(c.start, c.end)).toBe(c.replacement);
  });

  it("uses the context to pick the right occurrence of a repeated word", () => {
    const text = "Viņš gāja mājās. Mēs gāja mājās.";
    const { correctedText } = correct(text, [edit("gāja", "gājām", "Mēs gāja mājās")]);
    expect(correctedText).toBe("Viņš gāja mājās. Mēs gājām mājās.");
  });

  it("moves through repeated words in order when there is no usable context", () => {
    const text = "majās un majās";
    const { correctedText, corrections } = correct(text, [edit("majās", "mājās", "?"), edit("majās", "mājās", "?")]);
    expect(correctedText).toBe("mājās un mājās");
    expect(corrections.map((c) => c.start)).toEqual([0, 9]);
  });

  it("drops edits it cannot find, no-op edits and empty originals", () => {
    const text = "Labs teksts.";
    const { correctedText, corrections } = correct(text, [edit("nav", "ir"), edit("Labs", "Labs"), edit("", "x")]);
    expect(correctedText).toBe(text);
    expect(corrections).toEqual([]);
  });

  it("drops an edit that overlaps an earlier one", () => {
    const text = "abc def";
    const { correctedText, corrections } = applyEdits(text, [
      { ...edit("abc", "ABC"), start: 0, end: 3 },
      { ...edit("c d", "C D"), start: 2, end: 5 },
    ]);
    expect(correctedText).toBe("ABC def");
    expect(corrections).toHaveLength(1);
  });

  it("supports deletions as an empty range", () => {
    const { correctedText, corrections } = correct("Es  eju.", [edit("  ", " ")]);
    expect(correctedText).toBe("Es eju.");
    const del = correct("vārds vārds", [edit(" vārds", "", "vārds vārds")]);
    expect(del.correctedText).toBe("vārds");
    expect(del.corrections[0]).toMatchObject({ start: 5, end: 5 });
    expect(corrections).toHaveLength(1);
  });

  it("adds the fragment offset to positions", () => {
    const [located] = locateEdits("gājam", [edit("gājam", "gājām")], 100);
    expect(located).toMatchObject({ start: 100, end: 105 });
  });

  it("sorts edits reported out of order", () => {
    const text = "majās gājam";
    const { correctedText, corrections } = correct(text, [edit("gājam", "gājām"), edit("majās", "mājās")]);
    expect(correctedText).toBe("mājās gājām");
    expect(corrections.map((c) => c.replacement)).toEqual(["mājās", "gājām"]);
  });
});
