# The Current Life Map

A guided Self-Interview built on the Life System methodology. Question bank `v10-oct12` (V10 + approved 12 Oct overrides), scoring `provisional-1`.

Start with **`docs/03-scoring-and-open-flags.md`** (what scoring runs and what waits for approval), then `docs/02-question-registry-diff.md` and `docs/01-content-audit.md`.

Coach workspace, PDF and booking: **`docs/04-environment-setup.md`** (what to configure), **`docs/05-privacy-security-checklist.md`**, **`docs/06-staging-test-plan.md`**.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional for now — see below
npm run dev                  # http://localhost:3000
npm test                     # 77 tests: registry, scoring, schema + RLS, §9 acceptance (fake email/webhooks), auth, coach generators
npm run check:bundle         # after build: no server secrets in browser bundles
```

Without a database the public app runs fully, autosaves on the device, and the interview header says "Saved on this device" (never "Saved"). Download PDF works without any server.

## Structure

```
src/content/v10/      Versioned, verbatim V10 content: chapters, question bank, scales, opening copy
src/engine/           Pure, deterministic metric engine + navigation rules
  config/             All weights and the question→construct mapping (provisional, versioned)
src/components/       LifeSystem (neutral illustration), PersonalMap (results), ResponseControl
src/engine/coach/     Coach Report + personalised 60-minute Deep Dive script (evidence-linked, versioned)
src/lib/pdf/          Client PDF (pdf-lib) — same code in the browser (Download) and on the server (email)
src/server/           Server-only: db, crypto, assessments, email, booking adapters (Calendly, Stripe), admin queries, auth
src/components/admin/ Admin table + workspace tabs A–G
src/app/              /  · /interview · /results · /privacy · /admin (coach workspace) · /api/*
supabase/migrations/  Schema, RLS (coach + MFA), list view, deletion and retention functions
docs/                 Audit and decisions
tests/                Vitest
```

One `assessment_id` runs through everything. Raw answers → `assessment_answers` (exact stored value + ordinal; free text encrypted); the frozen, hash-fingerprinted snapshot the respondent saw → `assessment_results`; coach material → `coach_reports`, `session_scripts` (generated and edited versions), `session_notes` (encrypted). People exist in `clients` only from details they typed, linked through `assessment_client_links`; contacts are never merged by email.

## Status by phase

| Phase | Status |
|---|---|
| 1 Source audit | Done — `docs/01-content-audit.md` |
| 2 Architecture | Done — schema, question bank, engine interfaces |
| 3 Introduction + Self-Interview | Done — 94 screens, autosave/resume, back, validation, NA on Love, keyboard + screen-reader semantics, mobile |
| 4 Results | Scoring `provisional-1` per the 12 Oct backend spec (see docs/03). Unapproved metrics stay inactive; open flags F1–F9 |
| 5 PDF, email, booking | Built — Download PDF (no email needed), emailed PDF with delivery tracking, Calendly + Stripe webhooks with signed one-time link tokens, reconciliation, retry |
| 6 Coach workspace | Built — `/admin`: Supabase Auth + TOTP MFA, table with filters/sort/export, tabs A–G, Coach Report, editable versioned Deep Dive script, encrypted session notes, export/delete |
| 7 Testing | Schema/RLS, §9 acceptance, auth and generators automated; staging plan in docs/06. Still to add: browser journey + accessibility (axe) runs |

## What you'll need to connect

See `docs/04-environment-setup.md` for step-by-step setup. In short: Supabase (database + coach sign-in), Resend (PDF email), Calendly with Stripe (booking + payment), Vercel (hosting + cron), and three random secrets. Every variable is listed in `.env.example`.

**Do not launch publicly** until the staging plan (webhook linkage, authorisation, payment state, deletion, PDF access) has passed end to end and the privacy notice has had a legal review (flag F9). Nothing here constitutes legal review.


## Client profiles (Oct 13)

Coach workspace → **Clients**. Each profile has a stage (**Prospect**: did the self-interview · **Lead**: booked a Deep Dive, set automatically when the booking is confirmed · **Client**: on 1:1 coaching, set by the coach), all of the person's Maps with a side-by-side comparison, sessions (date, plan, notes, exercises and homework, files), notes about the person, and files.

- **More Maps under one profile:** a Client gets a private self-interview link; any Map completed through it attaches to their profile automatically (e.g. the 3-month follow-up). Maps are never joined by email automatically: a matching email is shown as a suggestion and Jana confirms it, or attaches a Map by searching name, email or ID.
- **Privacy:** sessions, notes and files are encrypted at the application layer; profile tables are behind RLS + MFA; every view, change and download is audited. Deleting one assessment never removes a profile Jana is working with; deleting a whole profile is admin-only.
- Code: `src/server/clients.ts` (private link, Lead promotion), `src/server/admin/clients.ts`, `src/components/admin/ClientProfile.tsx`, `ClientsTable.tsx`; tests in `tests/clients.test.ts`.
