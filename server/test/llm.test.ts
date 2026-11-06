import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClaudeCorrector, unconfiguredCorrector } from "../src/corrector";
import { createGeminiCorrector } from "../src/gemini-corrector";
import { createLlmCorrector, loadLlmConfig } from "../src/llm";

vi.mock("@anthropic-ai/sdk", () => ({ default: vi.fn(class { beta = {}; }) }));
vi.mock("@google/genai", () => ({ GoogleGenAI: vi.fn(class { models = { generateContent: vi.fn() }; }) }));
vi.mock("../src/gemini-corrector", () => ({ createGeminiCorrector: vi.fn(() => ({ correct: vi.fn() })) }));
vi.mock("../src/corrector", () => ({
  createClaudeCorrector: vi.fn(() => ({ correct: vi.fn() })),
  unconfiguredCorrector: { correct: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe("LLM configuration", () => {
  it("defaults to Gemini with a stable model and conservative request pacing", () => {
    expect(loadLlmConfig({})).toEqual({ provider: "gemini", model: "gemini-3.8-flash", apiKey: undefined, requestIntervalMs: 6_000 });
  });

  it("uses only Gemini credentials when selected, with model and interval overrides", () => {
    expect(loadLlmConfig({ GEMINI_API_KEY: "gemini-test-key", ANTHROPIC_API_KEY: "claude-test-key", GEMINI_MODEL: "gemini-custom", GEMINI_REQUEST_INTERVAL_MS: "12000" }))
      .toEqual({ provider: "gemini", apiKey: "gemini-test-key", model: "gemini-custom", requestIntervalMs: 12_000 });
    expect(loadLlmConfig({ ANTHROPIC_API_KEY: "claude-test-key" }).apiKey).toBeUndefined();
  });

  it("preserves explicit Claude configuration and ignores unrelated Gemini settings", () => {
    expect(loadLlmConfig({ LLM_PROVIDER: "claude", ANTHROPIC_API_KEY: "claude-test-key", GEMINI_API_KEY: "gemini-test-key", GEMINI_REQUEST_INTERVAL_MS: "invalid" }))
      .toEqual({ provider: "claude", apiKey: "claude-test-key", model: "claude-opus-5-5" });
    expect(loadLlmConfig({ LLM_PROVIDER: "claude", CLAUDE_MODEL: "claude-custom" }).model).toBe("claude-custom");
  });

  it("rejects unsupported providers without echoing untrusted configuration", () => {
    expect(() => loadLlmConfig({ LLM_PROVIDER: "secret-accidentally-pasted-here" })).toThrow('LLM_PROVIDER must be "claude" or "gemini".');
  });

  it.each(["-1", "1.5", "NaN", "Infinity", "60001"])("rejects invalid Gemini request interval %s", (interval) => {
    expect(() => loadLlmConfig({ GEMINI_REQUEST_INTERVAL_MS: interval })).toThrow("GEMINI_REQUEST_INTERVAL_MS must be an integer between 0 and 60000.");
  });
});

describe("LLM provider selection", () => {
  it("constructs Gemini, never Anthropic, with explicit timeout and bounded retries", () => {
    const result = createLlmCorrector(loadLlmConfig({ GEMINI_API_KEY: "gemini-test-key" }));
    expect(GoogleGenAI).toHaveBeenCalledWith({
      apiKey: "gemini-test-key",
      httpOptions: {
        timeout: 120_000,
        retryOptions: { attempts: 2, initialDelay: 6, maxDelay: 60, httpStatusCodes: [429, 500, 502, 503, 504] },
      },
    });
    expect(createGeminiCorrector).toHaveBeenCalledWith(expect.objectContaining({ generateContent: expect.any(Function) }), "gemini-3.8-flash", 6_000);
    expect(result).toBe(vi.mocked(createGeminiCorrector).mock.results[0].value);
    expect(Anthropic).not.toHaveBeenCalled();
    expect(createClaudeCorrector).not.toHaveBeenCalled();
  });

  it("constructs Anthropic only when Claude is explicitly selected", () => {
    createLlmCorrector(loadLlmConfig({ LLM_PROVIDER: "claude", ANTHROPIC_API_KEY: "claude-test-key" }));
    expect(Anthropic).toHaveBeenCalledWith({ apiKey: "claude-test-key", timeout: 120_000 });
    expect(createClaudeCorrector).toHaveBeenCalledWith(expect.anything(), "claude-opus-5-5");
    expect(GoogleGenAI).not.toHaveBeenCalled();
  });

  it.each(["gemini", "claude"])("keeps demo-only mode without a %s key", (provider) => {
    expect(createLlmCorrector(loadLlmConfig({ LLM_PROVIDER: provider }))).toBe(unconfiguredCorrector);
    expect(GoogleGenAI).not.toHaveBeenCalled();
    expect(Anthropic).not.toHaveBeenCalled();
  });
});
