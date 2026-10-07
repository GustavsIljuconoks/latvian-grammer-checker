import { useAuth } from "@clerk/react";
import { useMemo } from "react";
import type { DocumentDetail, DocumentSummary } from "../../../shared/types";
import { createMockApi } from "./mock-api";

export { ApiRequestError, errorMessage } from "./errors";

/** The contract of the server's HTTP API (spec §4). Pages only talk to this interface. */
export interface Api {
  createDocument(text: string): Promise<DocumentDetail>;
  listDocuments(range?: { from?: string; to?: string }): Promise<DocumentSummary[]>;
  getDocument(id: string): Promise<DocumentDetail>;
  deleteDocument(id: string): Promise<void>;
  deleteAllDocuments(): Promise<void>;
  deleteMe(): Promise<void>;
}

/** Phase 1: no server yet, so this returns the in-browser mock. Task 14 swaps in the real HTTP client. */
export function useApi(): Api {
  const { userId } = useAuth();
  return useMemo(() => createMockApi(userId ?? "signed-out"), [userId]);
}
