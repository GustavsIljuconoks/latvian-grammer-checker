import { clerkMiddleware, createClerkClient, getAuth } from "@clerk/express";
import { MongoClient } from "mongodb";
import Stripe from "stripe";
import { createClerkAccountService } from "./account";
import { createApp } from "./app";
import { createStripeBilling } from "./billing";
import { loadConfig } from "./config";
import { createDemoCorrector } from "./corrector";
import { createCipher } from "./crypto";
import { createLlmCorrector } from "./llm";
import { createMongoStore } from "./store";

const config = loadConfig();

const mongo = new MongoClient(config.mongoUri);
await mongo.connect();
const store = await createMongoStore(mongo.db(), createCipher(config.encryptionKey));

const { llm } = config;
const corrector = createLlmCorrector(llm);
console.log(llm.apiKey
  ? `Checking texts with ${llm.provider} (${llm.model})`
  : `No ${llm.provider === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY"}: only test checks will work`);

const clerk = createClerkClient({ secretKey: config.clerkSecretKey, publishableKey: config.clerkPublishableKey });
const app = createApp({
  store,
  corrector,
  demoCorrector: createDemoCorrector(),
  account: createClerkAccountService(clerk),
  billing: createStripeBilling(new Stripe(config.stripeSecretKey), {
    webhookSecret: config.stripeWebhookSecret,
    priceId: config.stripePriceId,
    appUrl: config.appUrl,
  }),
  authenticate: clerkMiddleware({ clerkClient: clerk, secretKey: config.clerkSecretKey, publishableKey: config.clerkPublishableKey }),
  userIdOf: (req) => getAuth(req).userId,
  clientDir: config.clientDir,
});

const server = app.listen(config.port, () => console.log(`API on http://localhost:${config.port}`));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close();
    void mongo.close().then(() => process.exit(0));
  });
}
