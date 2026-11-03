import type { ClerkClient } from "@clerk/express";

/** Account actions that need Clerk's secret key, so they run here instead of in the browser. */
export interface AccountService {
  revokeAllSessions(userId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

export function createClerkAccountService(clerk: ClerkClient): AccountService {
  return {
    async revokeAllSessions(userId) {
      const { data } = await clerk.sessions.getSessionList({ userId, status: "active", limit: 100 });
      await Promise.all(data.map((s) => clerk.sessions.revokeSession(s.id)));
    },
    async deleteUser(userId) {
      await clerk.users.deleteUser(userId);
    },
  };
}
