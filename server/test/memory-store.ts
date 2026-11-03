import { randomUUID } from "node:crypto";
import type { DocumentDetail } from "../../shared/types";
import type { Usage } from "../src/corrector";
import type { Store, SubscriptionRecord } from "../src/store";

/** The Store contract without MongoDB, for route tests. */
export function createMemoryStore() {
  const docs: (DocumentDetail & { userId: string })[] = [];
  const usage: (Usage & { userId: string })[] = [];
  const checks = new Map<string, number>();
  const subscriptions = new Map<string, SubscriptionRecord>();
  const store: Store = {
    async createDocument(userId, doc, u, opts) {
      const created = { id: randomUUID(), createdAt: new Date().toISOString(), correctionCount: doc.corrections.length, ...doc };
      docs.unshift({ ...created, userId });
      usage.push({ ...u, userId });
      if (!opts?.free) checks.set(userId, (checks.get(userId) ?? 0) + 1);
      return created;
    },
    async listDocuments(userId, { from, to }) {
      return docs
        .filter((d) => d.userId === userId)
        .filter((d) => (!from || new Date(d.createdAt) >= from) && (!to || new Date(d.createdAt) <= to))
        .map(({ id, title, createdAt, wordCount, correctionCount }) => ({ id, title, createdAt, wordCount, correctionCount }));
    },
    async getDocument(userId, id) {
      const doc = docs.find((d) => d.userId === userId && d.id === id);
      if (!doc) return null;
      const { userId: _, ...detail } = doc;
      return detail;
    },
    async deleteDocument(userId, id) {
      const i = docs.findIndex((d) => d.userId === userId && d.id === id);
      if (i < 0) return false;
      docs.splice(i, 1);
      return true;
    },
    async deleteAllDocuments(userId) {
      for (let i = docs.length - 1; i >= 0; i--) if (docs[i].userId === userId) docs.splice(i, 1);
    },
    async countChecks(userId) {
      return checks.get(userId) ?? 0;
    },
    async getSubscription(userId) {
      return subscriptions.get(userId) ?? null;
    },
    async saveSubscription(record) {
      subscriptions.set(record.userId, record);
    },
    async deleteUser(userId) {
      await store.deleteAllDocuments(userId);
      checks.delete(userId);
      subscriptions.delete(userId);
      for (let i = usage.length - 1; i >= 0; i--) if (usage[i].userId === userId) usage.splice(i, 1);
    },
  };
  return { store, docs, usage, checks, subscriptions };
}
