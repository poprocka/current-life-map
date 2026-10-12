# Gender-inclusive Self-Interview & results

Requirement from Jana, 12 Oct 2026. Applies to the question bank, engine, results, PDF, Coach Report and Deep Dive script.

## What the audit found

- **Question bank (all 94 screens):** no statement, option, scale label, chapter description or opening line assumes the respondent is a woman. No question wording needed to change.
- **Love Orbit:** worded around "romantic relationships", "intimate life" and "my own desire and sexuality". It doesn't assume a partner's gender, the respondent's orientation, or that they're in a relationship. The two approved items (love.02, love.03) offer "Not applicable to my current life", and N/A is excluded from calculations, with no penalty for being single (tested).
- **Engine and templates:** every insight, snapshot card, PDF line, Coach Report item and script prompt uses "you" (respondent-facing) or singular "they" (coach-facing), and names Orbits, never people.
- **Identity:** the engine and generators take only answers. Name and email live in `clients` and are never passed to scoring or interpretation. Booking intake answers appear in the script only as the person's own quoted words.
- **Database:** no gender, sex or pronoun fields. The assessment never asks for them.

## Automated checks (`tests/inclusion.test.ts`)

1. No gendered terms in any question, option, scale, chapter copy, opening, reflection, results or PDF string, or privacy notice.
2. 200 varied respondents (including Love N/A) produce snapshot, insights, PDF content, Coach Report and script with no gendered terms.
3. The engine and generators have no identity input; identical answers produce identical calculations and identical interpretations.
4. Love N/A changes Love's coverage only. Every other Orbit and the Sun stay identical, and nothing describes the person as single or alone.
5. The schema has no gender, sex or pronoun columns.

## Flags for Jana (no change made, since these don't assume gender)

| Item | Note | Option |
|---|---|---|
| love.01 "I can be my authentic self in romantic relationships…" | Someone who has never had or doesn't want romantic relationships may find this hard to answer. N/A was removed from this item by your instruction. | Restore N/A, or add "(past or present)" |
| social.04 "The time and energy I give to my career or work…" | Respondents who aren't in paid work (caregivers, students, retired, between roles) | Allow N/A, or "career, work or main daily role" |
| Love subtitle "Intimacy & Partnership" | Neutral, but "Partnership" can read as relationship-assumed | Keep, or "Intimacy & Connection" |

## Future demographics

If demographic questions are ever added, they must be:
- optional, with their purpose explained on screen
- stored in a separate table (`respondent_demographics`, linked by `assessment_id`, with its own consent row)
- never read by the scoring engine, templates, PDF, Coach Report or script generator

A test should then confirm that results are identical with and without demographic answers.

## Positioning

The methodology and Self-Interview are universal: anyone can take it, with no gender gate on access or results. Jana's marketing and coaching may focus on women. That lives in marketing copy, not in the instrument.

## Human QA still to do

Before launch, have respondents of different genders, relationship statuses and life circumstances complete it and review their results and PDF. Note anything that reads as assumed. Add this to the staging plan run (docs/06).
