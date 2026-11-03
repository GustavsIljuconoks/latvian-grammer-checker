import { existsSync } from "node:fs";
import path from "node:path";

// One .env at the repo root serves both client and server.
const envFile = path.resolve(import.meta.dirname, "../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing. See .env.example.`);
  return value;
}

export interface Config {
  port: number;
  mongoUri: string;
  /** 32 bytes, base64. Encrypts stored texts (spec NFR 2.3). */
  encryptionKey: Buffer;
  /** Which model checks texts. Without an API key only test checks work. */
  llm: { provider: "claude" | "gemini"; apiKey?: string; model: string };
  clerkSecretKey: string;
  clerkPublishableKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  /** The monthly subscription's Price in Stripe (price_...). */
  stripePriceId: string;
  /** Where the client runs; Stripe redirects back here. */
  appUrl: string;
  /** Set in Docker: the built client, served by this server. */
  clientDir?: string;
}

function loadLlm(): Config["llm"] {
  const provider = process.env.LLM_PROVIDER ?? "claude";
  if (provider === "gemini") {
    return { provider, apiKey: process.env.GEMINI_API_KEY || undefined, model: process.env.GEMINI_MODEL ?? "gemini-flash-latest" };
  }
  if (provider === "claude") {
    return { provider, apiKey: process.env.ANTHROPIC_API_KEY || undefined, model: process.env.CLAUDE_MODEL ?? "claude-opus-5-5" };
  }
  throw new Error(`LLM_PROVIDER must be "claude" or "gemini", not "${provider}".`);
}

export function loadConfig(): Config {
  const encryptionKey = Buffer.from(required("ENCRYPTION_KEY"), "base64");
  if (encryptionKey.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  return {
    port: Number(process.env.PORT ?? 3001),
    mongoUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/grammar-checker",
    encryptionKey,
    llm: loadLlm(),
    clerkSecretKey: required("CLERK_SECRET_KEY"),
    clerkPublishableKey: required("VITE_CLERK_PUBLISHABLE_KEY"),
    stripeSecretKey: required("STRIPE_SECRET_KEY"),
    stripeWebhookSecret: required("STRIPE_WEBHOOK_SECRET"),
    stripePriceId: required("STRIPE_PRICE_ID"),
    appUrl: (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, ""),
    clientDir: process.env.CLIENT_DIR || undefined,
  };
}
