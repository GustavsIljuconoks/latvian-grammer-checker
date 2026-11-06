import { ApiError, BlockedReason, FinishReason, GenerateContentResponse, GoogleGenAI, type GenerateContentParameters } from "@google/genai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGeminiCorrector } from "../src/gemini-corrector";
import { HttpError } from "../src/errors";

const edit = {
  context: "Mēs gājam.",
  original: "gājam",
  replacement: "gājām",
  explanation: "Pagātnē lieto garo patskani.",
  category: "spelling",
};

function response(text = JSON.stringify({ edits: [edit] }), overrides: Partial<GenerateContentResponse> = {}): GenerateContentResponse {
  return Object.assign(new GenerateContentResponse(), {
    candidates: [{ finishReason: FinishReason.STOP, content: { role: "model", parts: [{ text }] } }],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 30 },
  }, overrides);
}

function setup() {
  const generateContent = vi.fn<(params: GenerateContentParameters) => Promise<GenerateContentResponse>>().mockResolvedValue(response());
  return { generateContent, corrector: createGeminiCorrector({ generateContent }, "gemini-test", 0) };
}

afterEach(() => vi.useRealTimers());

describe("Gemini corrector", () => {
  it("requests structured Latvian edits and calculates corrected-text offsets and full token usage", async () => {
    const { generateContent, corrector } = setup();
    const result = await corrector.correct("Mēs gājam.");
    expect(result).toEqual({
      correctedText: "Mēs gājām.",
      corrections: [{ original: edit.original, replacement: edit.replacement, explanation: edit.explanation, category: edit.category, start: 4, end: 9 }],
      usage: { model: "gemini-test", inputTokens: 100, outputTokens: 50, fragments: 1 },
    });
    expect(generateContent).toHaveBeenCalledWith({
      model: "gemini-test",
      contents: "<text>\nMēs gājam.\n</text>",
      config: expect.objectContaining({
        systemInstruction: expect.stringContaining("Latvian"),
        responseMimeType: "application/json",
        responseJsonSchema: expect.objectContaining({ type: "object", required: ["edits"] }),
        candidateCount: 1,
        maxOutputTokens: 16_000,
        automaticContinuation: false,
      }),
    });
  });

  it("accepts an empty edit list and tolerates missing usage metadata", async () => {
    const { generateContent, corrector } = setup();
    generateContent.mockResolvedValue(response('{"edits":[]}', { usageMetadata: undefined }));
    expect(await corrector.correct("Viss ir pareizi.")).toEqual({
      correctedText: "Viss ir pareizi.", corrections: [],
      usage: { model: "gemini-test", inputTokens: 0, outputTokens: 0, fragments: 1 },
    });
  });

  it("serializes the edit schema through the real Google SDK without a network request", async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ text: JSON.stringify({ edits: [edit] }) }] } }],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 30 },
    }), { headers: { "content-type": "application/json" } }));
    const client = new GoogleGenAI({ apiKey: "test-key", httpOptions: { fetch: fetchMock } });
    const result = await createGeminiCorrector(client.models, "gemini-test", 0).correct("Mēs gājam.");
    expect(result.correctedText).toBe("Mēs gājām.");
    expect(result.usage.outputTokens).toBe(50);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/models/gemini-test:generateContent");
    const body = JSON.parse(String(init?.body));
    expect(body.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      responseJsonSchema: { type: "object", required: ["edits"] },
    });
    expect(body.systemInstruction.parts[0].text).toContain("Latvian");
    expect(body.contents[0].parts[0].text).toBe("<text>\nMēs gājam.\n</text>");
  });

  it.each([
    ["malformed JSON", () => response("not JSON")],
    ["empty output", () => response("")],
    ["missing edits", () => response("{}")],
    ["invalid category", () => response(JSON.stringify({ edits: [{ ...edit, category: "unknown" }] }))],
    ["empty original", () => response(JSON.stringify({ edits: [{ ...edit, original: "" }] }))],
    ["missing candidates", () => response("", { candidates: undefined })],
    ["missing finish reason", () => response("", { candidates: [{}] })],
    ["truncated output", () => response("", { candidates: [{ finishReason: FinishReason.MAX_TOKENS }] })],
    ["safety refusal", () => response("", { candidates: [{ finishReason: FinishReason.SAFETY }] })],
    ["blocked prompt", () => response(undefined, { promptFeedback: { blockReason: BlockedReason.SAFETY } })],
  ])("rejects %s", async (_name, answer) => {
    const { generateContent, corrector } = setup();
    generateContent.mockResolvedValue(answer());
    await expect(corrector.correct("Mēs gājam.")).rejects.toMatchObject({ code: "CORRECTION_FAILED", status: 502 });
  });

  it.each([429, 403, 503])("maps HTTP %i without retaining sensitive SDK error details", async (status) => {
    const { generateContent, corrector } = setup();
    generateContent.mockRejectedValue(new ApiError({ status, message: "credential-and-submitted-text" }));
    const error = await corrector.correct("Mēs gājam.").catch((error: unknown) => error);
    if (!(error instanceof HttpError)) throw new Error("Expected an HttpError.");
    expect(error).toMatchObject({ code: status === 429 ? "RATE_LIMITED" : "CORRECTION_FAILED", cause: expect.any(Error) });
    expect(String(error.cause)).not.toContain("credential-and-submitted-text");
    expect(String(error.cause)).toContain(`HTTP ${status}`);
  });

  it("merges multiple fragments in order and sums their usage", async () => {
    const { generateContent, corrector } = setup();
    const paragraph = "Mēs gājam. ".repeat(250);
    const result = await corrector.correct(`${paragraph}\n\n${paragraph}\n\n${paragraph}`);
    expect(generateContent.mock.calls.length).toBeGreaterThan(1);
    expect(result.corrections).toHaveLength(generateContent.mock.calls.length);
    expect(result.usage.inputTokens).toBe(100 * generateContent.mock.calls.length);
    expect(result.usage.outputTokens).toBe(50 * generateContent.mock.calls.length);
    for (const correction of result.corrections) {
      expect(result.correctedText.slice(correction.start, correction.end)).toBe("gājām");
    }
    expect(result.corrections.map((correction) => correction.start)).toEqual(result.corrections.map((correction) => correction.start).sort((a, b) => a - b));
  });

  it("stops a failed document before sending further fragments, and recovers for the next document", async () => {
    const { generateContent, corrector } = setup();
    generateContent.mockRejectedValueOnce(new Error("offline"));
    await expect(corrector.correct("Mēs gājam. ".repeat(700))).rejects.toMatchObject({ code: "CORRECTION_FAILED" });
    expect(generateContent).toHaveBeenCalledTimes(1);
    await expect(corrector.correct("Mēs gājam.")).resolves.toMatchObject({ correctedText: "Mēs gājām." });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("paces requests across simultaneous documents and never overlaps active requests", async () => {
    vi.useFakeTimers();
    const starts: number[] = [];
    let release!: (value: GenerateContentResponse) => void;
    const generateContent = vi.fn<(params: GenerateContentParameters) => Promise<GenerateContentResponse>>()
      .mockImplementationOnce(() => {
        starts.push(Date.now());
        return new Promise((resolve) => { release = resolve; });
      })
      .mockImplementation(async () => { starts.push(Date.now()); return response(); });
    const corrector = createGeminiCorrector({ generateContent }, "gemini-test", 6_000);
    const first = corrector.correct("Mēs gājam.");
    const second = corrector.correct("Mēs gājam.");
    await vi.advanceTimersByTimeAsync(6_000);
    expect(generateContent).toHaveBeenCalledTimes(1);
    release(response());
    await vi.advanceTimersByTimeAsync(5_999);
    expect(generateContent).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await Promise.all([first, second]);
    expect(starts[1] - starts[0]).toBe(12_000);

    const third = corrector.correct("Mēs gājam.");
    await vi.advanceTimersByTimeAsync(5_999);
    expect(generateContent).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await third;
    expect(starts[2] - starts[1]).toBe(6_000);
  });
});
