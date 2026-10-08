# The Current Life Map

A guided Self-Interview built on the Life System methodology. Content version **V10**, engine config `v10-provisional-2026-10-08` (status: proposed).

Start with **`docs/01-content-audit.md`** — it lists every open content and methodology decision.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional for now — see below
npm run dev                  # http://localhost:3000
npm test                     # 22 tests: question bank, scoring, ranking, navigation
```

Without Supabase credentials the app runs fully, autosaves on the device, and the interview header says "Saved on this device" (never "Saved").

## Structure

```
src/content/v10/      Versioned, verbatim V10 content: chapters, question bank, scales, opening copy
src/engine/           Pure, deterministic metric engine + navigation rules
  config/             All weights and the question→construct mapping (provisional, versioned)
src/components/       LifeSystem (neutral illustration), PersonalMap (results), ResponseControl
src/app/              /  introduction · /interview · /results · /privacy (draft) · /api/maps
supabase/migrations/  Schema with RLS on every table
docs/                 Audit and decisions
tests/                Vitest
```

Raw answers → `responses`; calculated values → `derived_metrics` (keyed by engine config id, so any Map can be recomputed under a new config); free text → `reflections` (encrypted). Anonymous `maps` link to `clients` only via a verified booking.

## Status by phase

| Phase | Status |
|---|---|
| 1 Source audit | Done — `docs/01-content-audit.md` |
| 2 Architecture | Done — schema, question bank, engine interfaces |
| 3 Introduction + Self-Interview | Done — 85 screens, autosave/resume, back, validation, NA on Love, keyboard + screen-reader semantics, mobile |
| 4 Results | First pass — personalised Map + legend + text table, Reality Snapshot, Energy Architecture (reported vs suggested), full attention order with reasons |
| 5 PDF, email, booking | Next — optional reflections, server-rendered PDF, Resend delivery, Calendly webhook linkage, Deep Dive section |
| 6 Coach Dashboard | Next — Supabase Auth, Map records, Coach Report, recognition/support marking, client history |
| 7 Testing | Ongoing — add Playwright journey, axe accessibility and RLS tests |

## What you'll need to connect

| Service | Used for | Env vars |
|---|---|---|
| Supabase | Storage, coach auth | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Resend | Emailing the PDF (verified sending domain) | `RESEND_API_KEY` |
| Calendly | Deep Dive booking + webhook | `CALENDLY_WEBHOOK_SIGNING_KEY` (paid plan required for webhooks) |
| Encryption | Reflections and session notes | `REFLECTION_ENCRYPTION_KEY` (32 random bytes) |
| Vercel | Hosting | the above as project env vars |

Apply the schema with `supabase db push` (or paste `supabase/migrations/0001_initial.sql` into the SQL editor), then insert your own auth user id into `coach_users`.

Nothing here constitutes legal review; the privacy notice and data flows need one before public launch.
