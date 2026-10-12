# Phase 1 — Source Audit & Content-Completeness Report

Source: `Claude_Current_Life_Map_V10_Content_and_Metrics.pdf` (V10 + Implementation Appendix).
Content version in code: `v10`. Question bank: `src/content/v10/question-bank.ts`.

## 1. Attachments received

| Source | Status |
|---|---|
| V10 Content & Measurement Specification (PDF) | Received, fully extracted |
| Build brief | Received |
| **Existing HTML prototype** | **Not attached.** Not found in earlier conversations either. UI is built from the written design direction (§3 of the brief); all visual decisions live in `tailwind.config.ts` + `src/components/` so they can be reconciled with the prototype without touching content or engine. |
| Illustrations / brand assets | None attached. The Life System illustration is drawn in SVG (`LifeSystem.tsx`). |

## 2. Content inventory (verified by `tests/question-bank.test.ts`)

| Chapter | Statements | Reverse-keyed | Importance | Energy | Emotional state |
|---|---|---|---|---|---|
| The Sun — Relationship With Self | 11 | 0 | — | — | — |
| Mind | 7 | 1 (Q5) | 1 | 1 | blocked |
| Body | 7 | 0 | 1 | 1 | blocked |
| Restoration | 6 | 1 (Q2) | 1 | 1 | blocked |
| Growth | 6 | 2 (Q3, Q6) | 1 | 1 | blocked |
| Love | 6 | 0 | 1 | 1 | blocked |
| Social World | 7 | 0 | 1 | 1 | blocked |
| Resources | 6 | 1 (Q5) | 1 | 1 | blocked |
| Joy | 6 | 0 | 1 | 1 | blocked |
| Life Interconnections | 7 (selections) | — | — | — | — |
| **Total shown** | **69** | **5** | **8** | **8** | **0** |

**85 screens** in the Self-Interview as currently approved. Every statement carries its exact V10 wording, its interpretation cue (construct → signal), its response direction, and its Explore category.

Also extracted verbatim: Opening copy, each chapter's description, reflection cue and Explore list, the three response scales, the Q7 options, editorial notes (V8), the interpretation framework, and the Implementation Appendix.

## 3. Open content dependencies — blocking or needing your approval

These are content/methodology decisions, not engineering ones. Nothing below has been silently invented: each is either left out of the respondent UI, or implemented as a clearly marked provisional default in config.

| # | Item | What V10 says | What's built now | Needs from you |
|---|---|---|---|---|
| C1 | **Emotional-state options** — RESOLVED 2026-10-12: wording and 12 options per Orbit supplied; 1–3 required | "Keep the individual noun-based options from our earlier drafts" | Data model + UI control exist; questions are **disabled** (`enabled: false`) | The exact earlier noun lists, per Orbit |
| C2 | **Privacy wording on the welcome screen** | Required, but no wording supplied | A one-line draft, marked `DRAFT` in `opening.ts` | Approved line |
| C3 | **Privacy & Data Use Notice** | Required, linked from welcome | `/privacy` page with a visible "draft — not yet reviewed" banner | Approved notice after legal/vendor review |
| C4 | **Love "Not applicable" scope** | "where appropriate" | Offered on Love Q2 and Q3. **Decided 2026-10-12:** removed from Q1 | Confirm Q2–Q3 |
| C5 | **Life Interconnections Q1–Q6 options** | Only Q7 has options | Q1–Q4, Q6: choose one of the eight Orbits. Q5: choose one Orbit | Confirm Orbit list is the option set; is the Sun selectable? Should Q5 be free text instead? |
| C6 | **Interconnections cue text** | Every cue repeats "Stronger agreement indicates…" | Kept verbatim in data; engine treats them as selections per the framework | Confirm the boilerplate can be dropped from these cues |
| C7 | **Optional reflections** | Results order says "Optional reflections after results" but no reflection questions are listed separately | The nine chapter **Reflection cues** are used as the optional reflection prompts (free text, after results) | Confirm, or supply the reflection set |
| C8 | **Where chapter descriptions appear** | Not specified; brief says don't repeat on both panels | Shown once, on the left panel under the area name | Confirm |
| C9 | **Optionality / skipping** | Not specified per question | All approved questions required; emotional state optional | Which questions may be skipped |
| C10 | **Per-question Explore category** | Explore lists are per chapter; per-question category is implied by the cue's construct | Derived from the cue construct. Four constructs don't appear in their chapter's Explore list: Sun → Self-acceptance, Self-care, Meaning; Love → Authenticity. Those pills simply show no highlight | Confirm, or add them to the Explore lists |

## 4. Methodology gaps — the engine runs, but outputs are provisional

The Appendix gives weights but not which questions feed which construct. To run the formulas at all, a mapping is needed. It is implemented in `src/engine/config/v10-provisional.ts`, with `status: "proposed"` and every number configurable.

| # | Gap | Provisional handling |
|---|---|---|
| M1 | **Question → construct mapping** (Reality / Inner State / Relationship / Agency) | Proposed per-question assignment. Needs your review — it drives Vitality and Congruence. **Finding:** Body and Love-without-Q2 have no clear Agency item in V10, so their Congruence is always marked `partial`. Either accept that, reassign an item, or add an Agency question in a future version |
| M2 | **"Revealed-priority consistency"** (20% of size) | Not defined in V10 → **component disabled**; size = stated importance. Engine reports this |
| M3 | **"Self-congruence signal"** (15% of congruence) | Proposed: authenticity-cued items + whether the Orbit was chosen in Interconnections Q6 |
| M4 | **Sun synthesis weights** | Equal weights across the nine named facets. Not shown as a number to respondents |
| M5 | **Attention modifiers** (friction, leverage, priority mismatch) | Small proposed additive values, flagged |
| M6 | **Scale numeric mapping** | 5-point scales mapped to 0, .25, .5, .75, 1; reverse-keyed inverted; Energy −2…+2 |
| M7 | **Missing components** | Weights renormalise over available evidence; the Orbit is marked `partial` or `insufficient` rather than given a fabricated value |

Every derived value carries an `evidence` record (which answers, which weights, which components were missing), so the results page and the Coach Report can show what was reported versus inferred.

## 5. Technical decisions (mine, not content)

Next.js 15 + TypeScript, Tailwind 3, SVG visualisation, Supabase Postgres + RLS (server-only service key), Vitest. Autosave to device on every answer plus server sync when Supabase is configured; when it isn't, the UI says "saved on this device" instead of pretending.

## 6. Content changes approved by Jana after V10 (preview review, 2026-10-12)

| Item | V10 | Now |
|---|---|---|
| Sun chapter heading | The Sun | You (label above: "The Sun") |
| Social World subtitle | Community, Career & Contribution | Community & Career |
| Love Q1 | Not applicable offered | Not applicable removed |
| Resources Q5 | "…because change feels uncertain, even when I know those circumstances no longer support the life I want." | "…because change feels uncertain." |
| "Self-Interview" | Title case | lowercase "self-interview" in running copy |
| Orbit labels | Orbit numbers hidden | "Orbit I" – "Orbit VIII" shown |
| Joy Q6 | "I make room for enjoyment that feels genuinely my own." (Happiness → Self-directed enjoyment) | Replaced with "I give myself opportunities to express my creativity and talents." Proposed cue: Creativity → Creative self-expression (needs approval) |
| Feelings question | Options pending (disabled) | Added to every Orbit after Energy: "When you think about your [Orbit] Orbit as it is today, which feelings or inner states are most present? Choose up to 3." 12 options each; 1–3 required. Self-interview now 93 screens |
| Life Interconnections Q6 | "Which Orbit feels most shaped by habits or other people's expectations rather than your own choices?" (Agency → Autopilot versus authorship) | "Which Orbit is most influenced by other people’s expectations or social standards?" Proposed signal: Other-directed versus self-directed |
| Closing reflection (new) | — | Optional free text at the end of Life Interconnections, before the Map: "What truth about your current life became harder to ignore while answering these questions?" Not scored; stored with encrypted reflections (Phase 5). Self-interview now 94 screens |
