import { ApiError, FinishReason, type GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { createFragmentedCorrector, EditsSchema, fragmentPrompt, SYSTEM_PROMPT, type Corrector } from "./corrector";
import { HttpError } from "./errors";

type GeminiClient = Pick<GoogleGenAI["models"], "generateContent">;

/** One queue per server corrector, shared by fragments from every user's document. */
export function createGeminiCorrector(client: GeminiClient, model: string, requestIntervalMs: number): Corrector {
  const responseJsonSchema = z.toJSONSchema(EditsSchema);
  let pending = Promise.resolve();
  let nextRequestAt = 0;

  return createFragmentedCorrector(model, (text) => {
    const result = pending.then(async () => {
      const wait = nextRequestAt - Date.now();
      if (wait > 0) await new Promise<void>((resolve) => setTimeout(resolve, wait));

      let response;
      try {
        response = await client.generateContent({
          model,
          contents: fragmentPrompt(text),
          config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseJsonSchema,
            candidateCount: 1,
            maxOutputTokens: 16_000,
            automaticContinuation: false,
          },
        });
      } catch (error) {
        // The API's error message may contain submitted text or request credentials.
        // Log only a status, never the raw SDK error (app.ts logs HttpError causes).
        const status = error instanceof ApiError ? error.status : undefined;
        throw new HttpError(status === 429 ? "RATE_LIMITED" : "CORRECTION_FAILED", {
          cause: new Error(`Gemini request failed${status === undefined ? "" : ` (HTTP ${status})`}.`),
        });
      } finally {
        // Pace after completion as well, including any retries made by the SDK.
        nextRequestAt = Date.now() + requestIntervalMs;
      }

      if (response.promptFeedback?.blockReason || response.candidates?.length !== 1 || response.candidates[0].finishReason !== FinishReason.STOP) {
        throw new HttpError("CORRECTION_FAILED", { cause: new Error("Gemini returned an incomplete or blocked response.") });
      }

      let edits: z.infer<typeof EditsSchema>["edits"];
      try {
        const parsed = EditsSchema.parse(JSON.parse(response.text ?? ""));
        if (parsed.edits.some((edit) => !edit.original)) throw new Error("Empty original.");
        edits = parsed.edits;
      } catch {
        throw new HttpError("CORRECTION_FAILED", { cause: new Error("Gemini returned invalid correction data.") });
      }

      return {
        edits,
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0),
      };
    });
    // A failed request must not poison the queue for later documents.
    pending = result.then(() => undefined, () => undefined);
    return result;
  }, 1); // Stop a failed document before queuing any more of its fragments.
}
