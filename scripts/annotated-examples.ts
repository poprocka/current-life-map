/** Three complete results with the central interpretation's rules and evidence. Run: npx tsx scripts/annotated-examples.ts */
import { computeLifeMap } from "@/engine/compute";
import { generateNarrative } from "@/engine/narrative";
import { questionById } from "@/content/v10/question-bank";
import { EXAMPLE_AMBITION, EXAMPLE_STRAIN, EXAMPLE_WORKING } from "../tests/fixtures/personas";

const GENERIC = new Set(["priority.top", "energy.balance", "support.similar", "support.contrast", "link.overall"]);
for (const [title, a] of [["ambition", EXAMPLE_AMBITION], ["working", EXAMPLE_WORKING], ["strain", EXAMPLE_STRAIN]] as const) {
  const n = generateNarrative(computeLifeMap(a), a);
  const lead = n.observations.find((o) => o.usedIn.includes("opening") && n.opening.paragraphs[0].observationIds.includes(o.id));
  console.log(`\n==== ${title} | lead: ${lead?.rule} (${lead?.relevance})`);
  const related = n.observations.filter((o) => o !== lead && !GENERIC.has(o.rule) && lead && o.areas.some((x) => lead.areas.includes(x)));
  for (const o of [lead!, ...related]) {
    console.log(`- ${o.rule} [${o.areas.join("+")}] rel=${o.relevance} used=${o.usedIn.join(",")}`);
    for (const e of o.evidence) console.log(`    ${e.questionId}: ${e.answer} — ${questionById(e.questionId)?.prompt.slice(0, 90)}`);
  }
  console.log("closing:", n.closingQuestion.text);
  console.log("all rules:", n.observations.map((o) => `${o.rule}:${o.usedIn.length ? "U" : "-"}`).join(" "));
}
