import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { createClaudeCorrector } from "../src/corrector";
import { HttpError } from "../src/errors";

type Edit = { context: string; original: string; replacement: string; explanation: string; category: "spelling" };

function fakeClient(answer: (text: string) => { stop_reason?: string; edits: Edit[] | null } | Error) {
  const parse = vi.fn(async (params: { messages: { content: string }[] }) => {
    const text = params.messages[0].content.replace(/^<text>\n/, "").replace(/\n<\/text>$/, "");
    const result = answer(text);
    if (result instanceof Error) throw result;
    return {
      stop_reason: result.stop_reason ?? "end_turn",
      parsed_output: result.edits && { edits: result.edits },
      usage: { input_tokens: 100, output_tokens: 20 },
    };
  });
  return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse };
}

const fix = (original: string, replacement: string): Edit => ({
  context: original,
  original,
  replacement,
  explanation: "Paskaidrojums.",
  category: "spelling",
});

describe("Claude corrector", () => {
  it("sends the text with the grammar system prompt and structured output", async () => {
    const { client, parse } = fakeClient(() => ({ edits: [fix("gājam", "gājām")] }));
    const result = await createClaudeCorrector(client, "claude-opus-5-5").correct("Mēs gājam.");

    expect(result.correctedText).toBe("Mēs gājām.");
    expect(result.corrections).toEqual([
      { original: "gājam", replacement: "gājām", explanation: "Paskaidrojums.", category: "spelling", start: 4, end: 9 },
    ]);
    expect(result.usage).toEqual({ model: "claude-opus-5-5", inputTokens: 100, outputTokens: 20, fragments: 1 });

    const params = parse.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.system).toContain("Latvian");
    expect(params.output_config).toMatchObject({ format: { type: "json_schema" } });
    expect(params.fallbacks).toBe("default");
  });

  it("checks long texts in fragments and merges the results in order", async () => {
    const paragraph = "Mēs gājam uz skolu un tur mācāmies daudz jaunu lietu. ".repeat(40);
    const text = `${paragraph}\n\n${paragraph}\n\n${paragraph}`;
    const { client, parse } = fakeClient(() => ({ edits: [fix("gājam", "gājām")] }));
    const result = await createClaudeCorrector(client, "m").correct(text);

    expect(parse.mock.calls.length).toBeGreaterThan(1);
    expect(result.usage.fragments).toBe(parse.mock.calls.length);
    expect(result.usage.inputTokens).toBe(100 * parse.mock.calls.length);
    expect(result.corrections).toHaveLength(parse.mock.calls.length);
    for (const c of result.corrections) expect(result.correctedText.slice(c.start, c.end)).toBe("gājām");
    const starts = result.corrections.map((c) => c.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it("returns no corrections for a correct text", async () => {
    const { client } = fakeClient(() => ({ edits: [] }));
    const result = await createClaudeCorrector(client, "m").correct("Viss ir pareizi.");
    expect(result).toMatchObject({ correctedText: "Viss ir pareizi.", corrections: [] });
  });

  it.each([
    ["the API call fails", () => new Anthropic.APIConnectionError({ message: "down" })],
    ["the answer is cut off", () => ({ stop_reason: "max_tokens", edits: [] })],
    ["the model refuses", () => ({ stop_reason: "refusal", edits: null })],
    ["the answer doesn't match the schema", () => ({ edits: null })],
  ])("fails with CORRECTION_FAILED when %s", async (_name, answer) => {
    const { client } = fakeClient(answer as () => Error);
    const error = await createClaudeCorrector(client, "m").correct("Teksts.").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).code).toBe("CORRECTION_FAILED");
  });
});
