# Proof: latviešu valodas gramatikas labotājs

An RTU course prototype. Paste Latvian text; it gets corrected, and every change is highlighted and explained.

> **Status: Phase 1, frontend only.** There is no server yet. `client/src/lib/mock-api.ts` stands in for the API: it applies a handful of fixed rules instead of calling Claude and keeps documents in the browser's localStorage. Phase 2 adds the Express + MongoDB + Claude server.

> **Known limitation:** "Iziet visās ierīcēs" (Settings → Konts) fails with Clerk's `session_reverification_required`, because revoking sessions from the browser needs reverification. Phase 2 moves it to the server. "Dzēst kontu" may hit the same check.

## Requirements

- Node.js 22.22+
- A [Clerk](https://dashboard.clerk.com) application:
  - Sign-in options: **Email** + **Password** enabled, email verification by **code**.
  - User model: **First and last name** enabled (used by Settings) but **not required**. Sign-up asks only for email and password, so a required name leaves sign-up stuck before the email-code step.
  - Account deletion: **Allow users to delete their accounts** enabled.

## Setup

```bash
cp .env.example .env    # fill in VITE_CLERK_PUBLISHABLE_KEY
npm install
npm run dev             # http://localhost:5173
```

## Trying the mock

Paste `es vakar gājam uz veikalu ,jo man vajag maizes.` to see the corrections. Add `#kluda` anywhere in a text to see the "check failed" state.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | client dev server |
| `npm run typecheck` | TypeScript |
| `npm run build` | production build of the client |

## Structure

- `client/`: React + Vite + shadcn/ui. User-facing text is in `src/i18n/lv.ts`, browser paths in `src/routes.ts`, and the API contract in `src/lib/api.ts`.
- `shared/types.ts`: API types shared with the future server.
