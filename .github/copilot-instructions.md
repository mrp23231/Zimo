<!-- Copilot / AI agent guidance for the Zimo (minimalist-social-network) repo -->

This file gives concise, actionable guidance so AI coding agents can be productive immediately in this repository.

High-level contract
- Inputs: developer intent (issue/PR/request), edited TypeScript/React files under `src/`, and project config files (`vite.config.ts`, `package.json`, `firestore.rules`, `storage.rules`).
- Outputs: small, targeted patches (no large refactors) that preserve app behaviour, keep build green, and follow repository conventions.
- Error modes: avoid exposing secrets, do not modify production config values (API keys) or change Firebase project IDs; if needed, surface a clear TODO and request a secret from the human.

Big-picture architecture (what to know quickly)
- Frontend single-page app built with React + Vite (see `src/` and `vite.config.ts`). UI is one large file `src/App.tsx` that contains the bulk of the app logic and many smaller components under `src/components/`.
- State and services:
  - Firebase is the primary backend (see `src/lib/firebase.ts`, `firebase.json`, `firestore.rules`, and `storage.rules`). Firestore rules and Storage rules encode the expected data model.
  - There is optional Appwrite and Supabase support (see `scripts/init-aw.js`, `supabase-config.json`) used for demos or migration scripts.
  - Offline support and an action queue exist (`src/lib/offline.tsx`) — edits must be resilient to offline/queue semantics.
- PWA + Web Push: `public/manifest.json`, `public/firebase-messaging-sw.js`, and FCM keys in env are used for push.
- Internationalisation strings and UI copy live embedded inside `src/App.tsx` using a `t()`/`useSettings()` pattern.

Critical developer workflows (how to build, run, test, debug)
- Install dependencies: `npm install` (this repo uses npm + Vite). See `package.json`.
- Run local dev server: `npm run dev` — Vite serves on port 3000 by default. `vite.config.ts` disables HMR when `DISABLE_HMR=true` (AI Studio environment note).
- Build for production: `npm run build` then `npm run preview` to locally preview the built app.
- Quick type-check/lint: `npm run lint` runs `tsc --noEmit`.
- Firebase rules and emulator: rules live in `firestore.rules` and `storage.rules`. The project expects these to be deployed with `firebase deploy --only firestore,storage` (not included in scripts) — agents should not attempt to run or modify deployment credentials.

Repository-specific conventions and patterns
- Large single-file UI: `src/App.tsx` implements many screens (Profile, AdminPanel, OnboardingWizard). Prefer small, conservative edits; adding new screens should create new components under `src/components/`.
- Data model is defined implicitly in `firestore.rules` — when adding new fields or collections, update the rules and ensure client reads/writes match the allowed shapes.
- Read-only / maintenance mode: the app reads config from Firestore and shows `readOnly` / `maintenance` UI. Avoid making changes that assume immediate write access in environments where Firestore config is unavailable.
- Storage toggles controlled by env: `.env.example` has `VITE_STORAGE_ENABLED`. Code paths branch based on this flag for image uploads; respect both branches when changing upload logic.
- Avoid hardcoding secrets: the repo contains example keys (e.g., `supabase-config.json`), but agents must never replace or commit real secrets. If a change requires a secret, add a clear TODO describing what human-supplied secret is needed and where to store it (e.g., `.env.local`).

Integration points and external dependencies
- Firebase (auth, firestore, storage, messaging): see `src/lib/firebase.ts`, `firebase.json`, `firestore.rules`, `storage.rules`.
- Optional Appwrite: `scripts/init-aw.js` helps create Appwrite collections for local demos.
- Supabase config file exists for reference/migration only (`supabase-config.json`).
- Gemini/GCP AI keys: `.env.example` expects `GEMINI_API_KEY` for AI features. Do not attempt to fetch or validate the key.

Patterns and code examples agents should follow
- UI updates that change Firestore documents always call `updateDoc`/`serverTimestamp()` helpers — replicate those patterns rather than inventing new time/merge semantics. Example: bookmarking posts in `src/App.tsx` uses `updateDoc(userRef, { bookmarks: arrayUnion(post.id) })`.
- Chunking / paging utilities: `chunkItems` and constants like `SEARCH_POST_LIMIT` and `BOOKMARK_QUERY_CHUNK` are used across the codebase. Use them for pagination and batch writes.
- Offline and queue handling: when adding write operations, prefer composition with the existing offline queue (`src/lib/offline.tsx`) — ensure queued actions serialize the same data shape the server expects.
- i18n: strings are embedded in `src/App.tsx`; if adding UI copy, add entries to the same translation object to keep parity.

Files to inspect for context (quick map)
- `src/App.tsx` — primary UI and business logic (read first)
- `src/lib/firebase.ts` — firebase initialization and helpers
- `vite.config.ts` — dev server flags (HMR disabled via env). Important for debugging HMR issues.
- `package.json` — npm scripts; `dev`, `build`, `preview`, `lint` are the main commands.
- `firestore.rules`, `storage.rules` — canonical data shapes and security rules; update these when changing server-side data requirements.
- `public/manifest.json`, `public/firebase-messaging-sw.js` — PWA and push behavior
- `scripts/init-aw.js` — Appwrite demo setup (node script)

When to ask for human help (must escalate)
- Any change that requires writing or exposing API keys, service account credentials, or modifying production Firebase project IDs.
- Large refactors (moving core logic out of `src/App.tsx`)—ask before proceeding.
- Changes to Firestore security rules that widen access or change ownership semantics.

House rules for AI edits
- Keep patches minimal and focused (one logical change per PR).
- Run `tsc --noEmit` locally (or via `npm run lint`) after edits and fix type errors introduced by your changes.
- Do not commit secrets. If a credential is needed, add a comment/TODO and instructions for a human to add it to `.env.local`.
- Prefer adding tests or a small smoke-check where practical (e.g., small unit for a new util). If adding tests, ensure they run with the project's tooling and keep them focused.

If anything is unclear or you need more examples (for instance: data shapes for `posts`, `users`, `messages`), ask — the important source of truth is `firestore.rules` and `src/App.tsx`.

---
If this file needs clarification or you want me to widen/scope other agent guidelines (PR templates, commit message format, or automated checks), tell me which area to expand next.
