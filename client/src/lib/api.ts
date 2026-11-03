import { useAuth } from "@clerk/react";
import { useMemo, useRef } from "react";
import { ERROR_CODES, type DocumentDetail, type DocumentSummary, type ErrorCode, type SubscriptionInfo } from "../../../shared/types";
import { ApiRequestError } from "./errors";

export { ApiRequestError, errorMessage } from "./errors";

/** The contract of the server's HTTP API (spec §4). Pages only talk to this interface. */
export interface Api {
  createDocument(text: string): Promise<DocumentDetail>;
  /** A free test check of DEMO_TEXT that calls no language model. */
  createDemoDocument(): Promise<DocumentDetail>;
  listDocuments(range?: { from?: string; to?: string }): Promise<DocumentSummary[]>;
  getDocument(id: string): Promise<DocumentDetail>;
  deleteDocument(id: string): Promise<void>;
  deleteAllDocuments(): Promise<void>;
  getSubscription(): Promise<SubscriptionInfo>;
  /** Activates the subscription from a finished Checkout session, without waiting for Stripe's webhook. */
  syncCheckout(sessionId: string): Promise<SubscriptionInfo>;
  /** Returns the Stripe Checkout URL to send the user to. */
  startCheckout(): Promise<string>;
  /** Returns the URL of Stripe's billing portal, where the user manages their subscription. */
  openBillingPortal(): Promise<string>;
  /** Revokes every session of the signed-in user, this one included. */
  signOutEverywhere(): Promise<void>;
  /** Deletes the user's data and their Clerk account. */
  deleteMe(): Promise<void>;
}

const isErrorCode = (value: unknown): value is ErrorCode => ERROR_CODES.includes(value as ErrorCode);

export function createHttpApi(getToken: () => Promise<string | null>): Api {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      const token = await getToken();
      res = await fetch(`/api${path}`, {
        method,
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(body !== undefined && { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiRequestError("INTERNAL"); // offline or server down
    }
    if (!res.ok) {
      const code = await res.json().then((b: { code?: unknown }) => b.code, () => undefined);
      throw new ApiRequestError(isErrorCode(code) ? code : res.status === 401 ? "UNAUTHORIZED" : "INTERNAL");
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  return {
    createDocument: (text) => call("POST", "/documents", { text }),
    createDemoDocument: () => call("POST", "/documents/demo"),
    listDocuments: (range = {}) => {
      const query = new URLSearchParams(Object.entries(range).filter((e): e is [string, string] => Boolean(e[1])));
      return call("GET", `/documents${query.size ? `?${query}` : ""}`);
    },
    getDocument: (id) => call("GET", `/documents/${encodeURIComponent(id)}`),
    deleteDocument: (id) => call("DELETE", `/documents/${encodeURIComponent(id)}`),
    deleteAllDocuments: () => call("DELETE", "/documents"),
    getSubscription: () => call("GET", "/subscription"),
    syncCheckout: (sessionId) => call("POST", "/subscription/sync", { sessionId }),
    startCheckout: () => call<{ url: string }>("POST", "/subscription/checkout").then((r) => r.url),
    openBillingPortal: () => call<{ url: string }>("POST", "/subscription/portal").then((r) => r.url),
    signOutEverywhere: () => call("POST", "/me/sign-out-everywhere"),
    deleteMe: () => call("DELETE", "/me"),
  };
}

export function useApi(): Api {
  const { getToken, userId } = useAuth();
  // Pages re-fetch when `api` changes, so keep it stable per user even if getToken isn't.
  const latestGetToken = useRef(getToken);
  latestGetToken.current = getToken;
  return useMemo(() => createHttpApi(() => latestGetToken.current()), [userId]);
}
