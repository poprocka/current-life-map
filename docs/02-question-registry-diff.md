# Question registry diff — V10 → `v10-oct12`

Registry: `src/content/v10/question-bank.ts` · assessment version `v10-with-approved-oct12-overrides`.
Only the changes below differ from V10. Every other prompt, scale and cue is V10 verbatim (checked by `tests/question-bank.test.ts`).

## Content changes (approved by Jana, 12 Oct 2026)

| ID | V10 | Now | Source |
|---|---|---|---|
| `resources.05` | "I tend to stay in familiar financial or living circumstances because change feels uncertain, even when I know those circumstances no longer support the life I want." | "I tend to stay in familiar financial or living circumstances because change feels uncertain." Reverse-keyed. Cue: uncertainty-related friction; does not prove avoidance or that change is needed. | Preview comment + backend spec §1 |
| `joy.06` | "I make room for enjoyment that feels genuinely my own." (Happiness → Self-directed enjoyment) | "I give myself opportunities to express my creativity and talents." Positive-keyed. Explore: **Creativity & Self-Expression**. Cue: whether creativity and talents have a place in lived experience. | Preview comment + spec §1 |
| `interconnections.06` | "Which Orbit feels most shaped by habits or other people's expectations rather than your own choices?" | "Which Orbit is most influenced by other people’s expectations or social standards?" One of eight Orbits; selection, not agreement. | Preview comment + spec §1 |
| `love.01` | Not applicable offered (my earlier default) | N/A removed | Preview comment + spec §1 |
| N/A scope | — | Only `love.02` (needs, desires, boundaries) and `love.03` (fulfilling for this stage of life) | Spec §1 |
| Social World subtitle | Community, Career & Contribution | Community & Career | Preview comment + spec §1 |
| `[orbit].emotion` × 8 | Options pending | "When you think about your [Orbit] Orbit as it is today, which feelings or inner states are most present?" + hint "Choose up to 3." 12 options each, exactly as spec §3. No Sun feelings item. | Jana, chat + spec §3 |
| `interconnections.reflection` | — | Optional free text: "What truth about your current life became harder to ignore while answering these questions?" | Jana, chat |
| Life Interconnections Explore | none | alignment, balance, tradeoffs, priorities, energy flow, agency | Preview comment |

## Presentation changes (no effect on scoring)

Sun heading "You" (label "The Sun"); "Orbit I–VIII" labels; "Section X of 10"; lowercase "self-interview" in running copy; results headline "See your life as it is."; estimated time line on the welcome page.

## New registry metadata

- `signalTags` — **approved** lenses only. Importance → IMPORTANCE, energy → ENERGY, feelings → INNER_STATE. Truth statements: **none approved** (open item F1).
- `proposedSignalTags` — my earlier proposal, for review only. The engine never reads it.
- `subtheme` (Social World) — proposed: `social.04` career; `social.03` both; others community.

## Not changed

No "None / unsure" option on any Life Interconnections question (not approved, F7).
