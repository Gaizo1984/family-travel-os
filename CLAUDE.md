# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

"LUMI Travel" — a family travel-planning PWA (trip planning, packing lists, bookings/documents, flight & hotel search, an AI concierge, a "Content Studio" that generates video reels from trip photos via Remotion, and offline trip snapshots). Primarily German-language UI, code comments, and commit messages. Single-family production use (Marcel & Sarah), not multi-tenant SaaS.

It is one of several sibling apps ("Lumi Launcher", "Lumi Assistance", this one) that share one Supabase backend called **Lumi Core** and are composed at runtime via Next.js Multi-Zones under the Lumi Launcher's domain.

## Commands

```bash
npm run dev         # dev server on :3001
npm run build        # prebuild bundles Remotion, then next build
npm run start         # :3001
npx tsc --noEmit      # typecheck (the closest thing to a test suite here — run after non-trivial changes)
```

There is no lint script, no unit/integration test framework, and no `npm test`. Verification is `tsc --noEmit` plus manual smoke-testing of the affected page/action. `scripts/*.mjs` are standalone manual test scripts for the Remotion/Lambda render pipeline, run directly with `node`, not part of a CI suite.

## Architecture

### This is not the Next.js you know
Next.js 16 in this repo has renamed/changed conventions from what you likely remember (e.g. `middleware.ts` → `proxy.ts`). **Before touching routing, auth-gating, headers, or config, read the relevant page under `node_modules/next/dist/docs/`** rather than relying on prior knowledge — this is an explicit repo convention (see `AGENTS.md`).

### Auth & data: everything lives in Lumi Core now
A full cutover (auth, business data, and file storage) from Travel's own original Supabase project to the shared **Lumi Core** Supabase project is already complete in production code:

- `lib/supabase/lumi-core-server.ts` (`createLumiCoreClient()`) is the client used almost everywhere — in `lib/actions/*.ts`, `lib/family.ts`, `lib/current-person.ts`, etc.
- `lib/supabase/server.ts` (Travel's original, separate Supabase project) is **dev/test-only** now — only `lib/dev-test-runs.ts` and `lib/actions/dev-tests/reel-spike-test.ts` (under `app/(app)/mehr/developer`) still use it. Do not wire new production features to it.
- `lib/supabase/lumi-core-service.ts` uses the Lumi Core **service-role** key — server-only, exclusively for session-less cron/cleanup jobs. Never expose it client-side or use it for normal request-scoped app access.
- The "family" concept is now Lumi Core's `households` table (`lib/family.ts::getFamily()`, `lib/household-identity.ts`, `lib/household-members.ts`); resolved from the logged-in person via `lib/current-person.ts`, not from a static row lookup.
- `lib/lumi-core-data/` and `lib/lumi-core-storage/` contain their own `README.md` files describing themselves as "prepared, not yet wired in" data/storage primitives for a *future* cutover — that framing is now **stale**; the cutover they were preparing for has already happened via direct `createLumiCoreClient()` usage in `lib/actions/*`. Don't trust those READMEs' "not active" claims at face value; check actual call sites (e.g. `grep` for `createLumiCoreClient`) before assuming something is unwired.
- `proxy.ts` (this version's `middleware.ts`) does the one job of checking for a Lumi Core session and redirecting unauthenticated requests to `/login`; it explicitly special-cases `/api/cron/*` (self-secured via `CRON_SECRET` bearer check, must never hit the login redirect) and public paths (`/login`, `/auth/confirm`).

### Shared Lumi Core Supabase — cross-app safety rules (binding)
Lumi Travel uses the **same production Lumi Core Supabase project as Lumi Assistance** (and Lumi Launcher). This is not Travel's private database.

- Changes to schema, migrations, RLS, auth/identity, `households`, `household_members`, permissions/grants, or any other shared structure are **cross-app changes** — check for impact on Lumi Core itself and on Lumi Assistance, not just on this app, before proposing or making them.
- "Travel-domain tables" (trip/stage/booking/packing/document/etc. tables primarily read and written by this app) still live in the shared Lumi Core Supabase and are **not technically isolated or exclusively owned by Travel** — another app or a future schema change elsewhere can still affect them. When analyzing the database, explicitly distinguish **Travel-domain structures** from **shared-core structures** (auth/identity, `households`, `household_members`, cross-app permissions) rather than treating the whole schema as Travel's own.
- Prefer additive, backward-compatible migrations (new nullable columns/tables, no renames/drops/type changes/tightened constraints on existing shared structures) unless explicitly told otherwise.
- **Safety rule**: never autonomously run `supabase db push`, apply production migrations, make destructive schema changes, or modify existing RLS policies on the shared Lumi Core Supabase. Creating/preparing a migration file in the repo is fine; applying it to the shared database always requires the user's explicit, per-change approval — a prior approval does not carry over to a different change.

### Multi-Zones: this app is mounted at `/travel`
`next.config.ts` sets `basePath: "/travel"` because in production this app is transparently mounted under the Lumi Launcher's origin via Next.js Multi-Zones rewrites — Next.js applies the basePath automatically to `next/link`, `redirect()`, all App Router routes, and generated asset URLs, so app code should stay root-relative and not hardcode `/travel`. Server Actions' CSRF origin check (`experimental.serverActions.allowedOrigins`) is set to the Lumi Launcher origin(s) for the same reason — this app's own Origin header, seen from behind the proxy, is the launcher's domain, not its own.

### Route groups
- `app/(app)/` — the authenticated app shell (sidebar/bottom-nav in `app/(app)/layout.tsx`, `RoutePrefetcher`), covers trips, family, today (LUMI dashboard), content-studio, memories, hotels, discover, concierge, plan, mehr (settings/more, incl. `/mehr/developer` dev-test tooling).
- `app/(app)/mehr` — the developer-only test tooling: dev-tests use `lib/supabase/server.ts` and are the manual smoke-test surface for provider integrations described below.
- `app/(auth)/` — nav-free login/password-reset.
- `app/layout.tsx` is the *only* root layout (html/body, metadata, fonts, splash screen); route-group layouts nest inside it.
- `app/api/cron/*` — Vercel Cron jobs (`vercel.json`), secured by comparing the `Authorization: Bearer` header to `CRON_SECRET`, not by session; exempted from `proxy.ts`'s auth redirect.

### External providers
`lib/providers/*` wraps external APIs behind a small typed surface (`ProviderConfigError` / `ProviderRequestError` in `lib/providers/provider-errors.ts`) so call sites get one consistent error shape and logs never leak API keys, full response bodies, or trip data — only provider name, request type, HTTP status, and (if present) the short upstream error code.

- Google Places API (New) / Geocoding / Routes — destinations, excursions, restaurants, hotel search, route computation (`GOOGLE_PLACES_API_KEY`).
- Duffel — live flight search (`DUFFEL_API_KEY`; sandbox vs. live is inferred purely from the `duffel_test_…`/`duffel_live_…` token prefix, plus a separate `DUFFEL_LIVE_MODE_ENABLED` gate that must also be `'true'` for live searches). `FLIGHT_SEARCH_MONTHLY_LIMIT` caps real provider calls per month (cache hits don't count).
- OpenAI — LUMI Concierge recommendations and other AI generation (`lib/*-ai.ts` files, `OPENAI_API_KEY`).
- Remotion (`@remotion/cli`/`lambda`/`player`) — Content Studio's reel video rendering. The Remotion bundle is built at **build time** via the `prebuild` npm script into `remotion/.output/`, not at request time (`bundle()` must not run inside a serverless function per Remotion's docs) — see the extensive comments in `next.config.ts` around `outputFileTracingIncludes` if touching build/deploy config for this feature. `sharp` and `@remotion/lambda` are both in `serverExternalPackages` because they load platform-specific native binaries via `require()` that Next.js's bundler/file-tracer must not try to statically resolve or silently drop from the deployed bundle.

### Server Actions carry the app
Almost all mutations and most data reads go through `'use server'` functions in `lib/actions/*.ts` rather than API routes — `app/api/` is essentially just cron jobs and one places-photo proxy route. When adding a feature, a new `lib/actions/*.ts` file (or a function in an existing one) is the default, not a new route handler.

### Photo/file uploads bypass the Server Action body directly
Server Action request bodies are capped (`bodySizeLimit: "50mb"` is already a raised-from-default override for multi-photo uploads). Larger or numerous uploads go through a signed-upload-slot pattern instead of raw form data — see `lib/actions/photo-staging.ts` and callers like `createTripCoverUploadSlots` in `lib/actions/trips.ts`.

### Offline support
A service worker (`components/ServiceWorkerRegistration.tsx`, `public/sw.js`) enables offline access to a saved trip's data (`lib/actions/offline-trip-snapshot.ts`, `lib/offline-document-cache.ts`, `components/OfflineTrip*`, `components/OfflineDocumentViewer.tsx`). The SW registration URL is made unique per deploy (`NEXT_PUBLIC_SW_BUILD_ID`, derived from `VERCEL_GIT_COMMIT_SHA`) to force-bust stale service workers on some Android/Chrome combinations that don't reliably byte-compare `/sw.js` — see the comment in `next.config.ts`. `proxy.ts`'s matcher explicitly excludes `sw.js`/manifest/icons so the service worker is always reachable without a session.

## Conventions worth knowing before editing

- Comments prefixed `§` mark decisions tied to a named feature/sprint/bugfix (e.g. `§Content Studio 3.0, Sprint 5`, `§Bugfix "..."`) — these explain *why*, often non-obviously (a prior incident, a platform quirk, an explicit user decision). Read them before changing the surrounding code, and follow the same style (name the decision/bugfix) for comments that need one.
- Path aliases: `@/*` maps to the repo root (`tsconfig.json`).
- `.claude/worktrees/` holds past/parallel git worktrees from prior Claude Code sessions — not part of the app; ignore unless specifically asked to work in one.
