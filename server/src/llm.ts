import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { createClaudeCorrector, unconfiguredCorrector, type Corrector } from "./corrector";
import { createGeminiCorrector } from "./gemini-corrector";

export type LlmConfig =
  | { provider: "claude"; apiKey?: string; model: string }
  | { provider: "gemini"; apiKey?: string; model: string; requestIntervalMs: number };

/** Kept independent of .env loading so provider selection is testable without local secrets. */
export function loadLlmConfig(env: NodeJS.ProcessEnv): LlmConfig {
  const provider = env.LLM_PROVIDER ?? "gemini";
  if (provider === "gemini") {
    const requestIntervalMs = Number(env.GEMINI_REQUEST_INTERVAL_MS || 6_000);
    if (!Number.isSafeInteger(requestIntervalMs) || requestIntervalMs < 0 || requestIntervalMs > 60_000) {
      throw new Error("GEMINI_REQUEST_INTERVAL_MS must be an integer between 0 and 60000.");
    }
    return {
      provider,
      apiKey: env.GEMINI_API_KEY || undefined,
      model: env.GEMINI_MODEL || "gemini-3.8-flash",
      requestIntervalMs,
    };
  }
  if (provider === "claude") {
    return { provider, apiKey: env.ANTHROPIC_API_KEY || undefined, model: env.CLAUDE_MODEL || "claude-opus-5-5" };
  }
  throw new Error('LLM_PROVIDER must be "claude" or "gemini".');
}

export function createLlmCorrector(config: LlmConfig): Corrector {
  if (!config.apiKey) return unconfiguredCorrector;
  if (config.provider === "gemini") {
    const client = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: {
        timeout: 120_000,
        retryOptions: { attempts: 2, initialDelay: Math.max(1, config.requestIntervalMs / 1_000), maxDelay: 60, httpStatusCodes: [429, 500, 502, 503, 504] },
      },
    });
    return createGeminiCorrector(client.models, config.model, config.requestIntervalMs);
  }
  return createClaudeCorrector(new Anthropic({ apiKey: config.apiKey, timeout: 120_000 }), config.model);
}
