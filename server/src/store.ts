import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import type { Correction, DocumentDetail, DocumentSummary, SubscriptionStatus } from "../../shared/types";
import type { Usage } from "./corrector";
import type { Cipher } from "./crypto";

export interface NewDocument {
  title: string;
  wordCount: number;
  originalText: string;
  correctedText: string;
  corrections: Correction[];
}

/** A user's Stripe subscription, as last reported by Stripe. */
export interface SubscriptionRecord {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}

/** The text storage module (design doc 2.1.1). Every call is scoped to one user. */
export interface Store {
  /** `free` documents (test checks) are not counted against the free checks. */
  createDocument(userId: string, doc: NewDocument, usage: Usage, opts?: { free?: boolean }): Promise<DocumentDetail>;
  listDocuments(userId: string, range: DateRange): Promise<DocumentSummary[]>;
  getDocument(userId: string, id: string): Promise<DocumentDetail | null>;
  deleteDocument(userId: string, id: string): Promise<boolean>;
  deleteAllDocuments(userId: string): Promise<void>;
  /** How many checks the user has ever made. Deleting history doesn't lower it. */
  countChecks(userId: string): Promise<number>;
  getSubscription(userId: string): Promise<SubscriptionRecord | null>;
  saveSubscription(record: SubscriptionRecord): Promise<void>;
  /** Removes everything stored for the user, usage logs and subscription included. */
  deleteUser(userId: string): Promise<void>;
}

interface UserRow {
  _id: string; // Clerk user id
  createdAt: Date;
  lastSeenAt: Date;
  checksUsed: number;
}

interface SubscriptionRow extends Omit<SubscriptionRecord, "userId"> {
  _id: string; // Clerk user id
  updatedAt: Date;
}

// Texts are encrypted (spec NFR 2.3); counts and dates stay plain so lists can be filtered and sorted.
interface DocumentRow {
  _id: string;
  userId: string;
  title: string;
  originalText: string;
  correctedText: string;
  wordCount: number;
  correctionCount: number;
  createdAt: Date;
}

interface CorrectionRow {
  _id: string;
  documentId: string;
  userId: string;
  index: number;
  original: string;
  replacement: string;
  explanation: string;
  category: Correction["category"];
  start: number;
  end: number;
}

interface UsageLogRow {
  userId: string;
  documentId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  fragments: number;
  createdAt: Date;
}

export async function createMongoStore(db: Db, cipher: Cipher): Promise<Store> {
  const users = db.collection<UserRow>("users");
  const documents = db.collection<DocumentRow>("documents");
  const corrections = db.collection<CorrectionRow>("corrections");
  const usageLogs = db.collection<UsageLogRow>("usage_logs");
  const subscriptions = db.collection<SubscriptionRow>("subscriptions");

  await Promise.all([
    documents.createIndex({ userId: 1, createdAt: -1 }),
    corrections.createIndex({ documentId: 1, index: 1 }),
    corrections.createIndex({ userId: 1 }),
    usageLogs.createIndex({ userId: 1, createdAt: -1 }),
  ]);

  const summary = (row: DocumentRow): DocumentSummary => ({
    id: row._id,
    title: cipher.decrypt(row.title),
    createdAt: row.createdAt.toISOString(),
    wordCount: row.wordCount,
    correctionCount: row.correctionCount,
  });

  return {
    async createDocument(userId, doc, usage, opts) {
      const now = new Date();
      const id = randomUUID();
      await users.updateOne(
        { _id: userId },
        { $set: { lastSeenAt: now }, $setOnInsert: { createdAt: now }, $inc: { checksUsed: opts?.free ? 0 : 1 } },
        { upsert: true },
      );
      if (doc.corrections.length) {
        await corrections.insertMany(
          doc.corrections.map((c, index) => ({
            _id: randomUUID(),
            documentId: id,
            userId,
            index,
            original: cipher.encrypt(c.original),
            replacement: cipher.encrypt(c.replacement),
            explanation: cipher.encrypt(c.explanation),
            category: c.category,
            start: c.start,
            end: c.end,
          })),
        );
      }
      // The document goes in last, so a half-written one never shows up in history.
      await documents.insertOne({
        _id: id,
        userId,
        title: cipher.encrypt(doc.title),
        originalText: cipher.encrypt(doc.originalText),
        correctedText: cipher.encrypt(doc.correctedText),
        wordCount: doc.wordCount,
        correctionCount: doc.corrections.length,
        createdAt: now,
      });
      await usageLogs.insertOne({ userId, documentId: id, ...usage, createdAt: now });
      return { id, createdAt: now.toISOString(), correctionCount: doc.corrections.length, ...doc };
    },

    async listDocuments(userId, range) {
      const createdAt = { ...(range.from && { $gte: range.from }), ...(range.to && { $lte: range.to }) };
      const rows = await documents
        .find({ userId, ...(Object.keys(createdAt).length && { createdAt }) }, { projection: { originalText: 0, correctedText: 0 } })
        .sort({ createdAt: -1 })
        .toArray();
      return rows.map(summary);
    },

    async getDocument(userId, id) {
      const row = await documents.findOne({ _id: id, userId });
      if (!row) return null;
      const rows = await corrections.find({ documentId: id, userId }).sort({ index: 1 }).toArray();
      return {
        ...summary(row),
        originalText: cipher.decrypt(row.originalText),
        correctedText: cipher.decrypt(row.correctedText),
        corrections: rows.map((c) => ({
          original: cipher.decrypt(c.original),
          replacement: cipher.decrypt(c.replacement),
          explanation: cipher.decrypt(c.explanation),
          category: c.category,
          start: c.start,
          end: c.end,
        })),
      };
    },

    async deleteDocument(userId, id) {
      const { deletedCount } = await documents.deleteOne({ _id: id, userId });
      await corrections.deleteMany({ documentId: id, userId });
      return deletedCount > 0;
    },

    async deleteAllDocuments(userId) {
      await documents.deleteMany({ userId });
      await corrections.deleteMany({ userId });
    },

    async countChecks(userId) {
      return (await users.findOne({ _id: userId }))?.checksUsed ?? 0;
    },

    async getSubscription(userId) {
      const row = await subscriptions.findOne({ _id: userId });
      if (!row) return null;
      const { _id, updatedAt: _, ...rest } = row;
      return { userId: _id, ...rest };
    },

    async saveSubscription({ userId, ...rest }) {
      await subscriptions.updateOne({ _id: userId }, { $set: { ...rest, updatedAt: new Date() } }, { upsert: true });
    },

    async deleteUser(userId) {
      await Promise.all([
        subscriptions.deleteOne({ _id: userId }),
        documents.deleteMany({ userId }),
        corrections.deleteMany({ userId }),
        usageLogs.deleteMany({ userId }),
        users.deleteOne({ _id: userId }),
      ]);
    },
  };
}
