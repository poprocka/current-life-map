# Scoring `provisional-1` — what runs, what waits, and QA

Engine: `src/engine/compute.ts` · config: `src/engine/config/scoring.ts` · example payload: `docs/example-result.json`.
The pre-spec engine is quarantined in `src/engine/compute.legacy-prototype.ts` (not imported).

## What is active

| Metric | Rule | Shown as |
|---|---|---|
| Normalisation | truth `(ordinal−1)/4`, reverse-keyed inverted; importance `(ordinal−1)/4`; energy raw 1–5, signed `(3−o)/2`, support `(5−o)/4` | — |
| N/A, missing | excluded; denominator adjusts; never 0 or 0.5 | coverage per Orbit |
| Orbit size | **direct stated importance only** | planet size |
| Brightness | `responseSupportIndex` = mean of eligible keyed statements (a proxy, not "vitality") | brightness; legend says "based on your answers to its statements" |
| Distance | **neutral, fixed** for all Orbits | legend says it isn't shown yet |
| Sun | interim unweighted mean of 11 statements (internal only, never shown as a score) | — |
| Energy | per-Orbit energy answers; Life Interconnections selections kept separate | flows on the Map; "Most energy out / in" |
| Snapshot | energy out/in = own selections; largest place = highest importance (ties shown); most supported / needs more attention = highest/lowest support among sufficient Orbits, hidden on a tie; "Most shaped by expectations" replaces "Least connected" | cards shown only with evidence |
| Attention | **qualitative candidates**, no score, no rank: leverage choice, crowded out, priority gap, important + draining, high importance + low support, supportive area | unranked list |
| Insights | evidence → rule → template; each has evidence, type, caveat when hypothetical | Energy Architecture |

## Open approval items — blocking

| Flag | Needed from Jana | Unlocks |
|---|---|---|
| F1 | Question → REALITY / RELATIONSHIP / AGENCY / SELF_CONGRUENCE mapping (proposal in `config/proposed-mappings.ts`) | vitality 55/45 |
| F2 | Sun weighting | weighted Sun |
| F3 | Revealed-priority consistency definition | size 80/20 |
| F4 | Orbit-specific congruence measure | personalised distance, "Least connected" |
| F5 | Leverage numeric mapping and modifier caps | ranked attention |
| F6 | Coverage gate `max(3, 60%)`, thresholds 0.75 / 0.40 / 0.75 | firm support statuses and candidate rules |
| F7 | Interconnections IDs/options vs newest frontend; "None / unsure" | — |
| F8 | Feelings options vs frontend — **verified identical** | — |
| F9 | Legal / data-flow review of the privacy notice and vendors | launch |

## Where your latest instructions differ from the spec (current behaviour follows you)

| Spec | Your instruction in this session | Built |
|---|---|---|
| §1/§7.1 results title "Your reality, as it is right now." | Keep the homepage headline | "See your life as it is." |
| §1/§7.6 reflections appear after results | Reflection before the Map | Before the Map; does not affect scoring |
| §7.2 "Needs more support" | Rename to "Needs more attention" | "Needs more attention" |
| §7.2 "Least connected with you" | — | Replaced by "Most shaped by expectations" (spec fallback) |

## QA report (`npm test`: 45 passing)

Registry: ten sections · exactly two N/A questions with exact prompts · Resources short wording, reverse-keyed · Joy creativity present, enjoyment absent · external expectations wording · Social subtitle · feelings options per Orbit, max 3, no Sun item · five reverse-keyed items · no approved signal tags on statements.

Math/data: ordinal and energy mappings · N/A excluded, Love denominator 4 · no singlehood penalty · missing stays null · partial vs complete · coverage gate · vitality/congruence null and pending · size direct-only · no ranking · same Orbit as source and demand · selections never numeric · emotions and reflection never change scores · determinism · version IDs.

Insights: every claim carries evidence · low-importance nourishing Orbit not a candidate · no diagnostic/absolute words · hypotheses carry caveats · empty input yields no filler.

Not yet testable (later phases): PDF parity with the app, coach-report access control, booking/email confirmations.
