/** Markdown for the 13 Oct review: three complete results + the rules and evidence behind each central interpretation. */
import { writeFileSync } from "node:fs";
import { computeLifeMap } from "@/engine/compute";
import { generateNarrative } from "@/engine/narrative";
import type { Observation } from "@/engine/narrative/types";
import { EXAMPLE_AMBITION, EXAMPLE_STRAIN, EXAMPLE_WORKING } from "../tests/fixtures/personas";

const WHERE: Record<string, string> = { opening: "Opening", map: "Map reading", standsOut: "What stands out", self: "Sun", connections: "Interconnections",
  "card.overview": "Card 1", "card.support": "Card 2", "card.tension": "Card 3", "card.energy": "Card 4", "card.begin": "Card 5", orbit: "Orbit paragraph", closing: "Closing question" };
const short = (s: string) => s.replace(/\|/g, "/");
function full(a: Record<string, string | string[]>) {
  const n = generateNarrative(computeLifeMap(a), a);
  const L: string[] = [];
  const p = (h: string, ps: { text: string }[]) => { L.push(`**${h}**`, ""); for (const x of ps) L.push(x.text, ""); };
  p("A · Your reality, as it is right now", n.opening.paragraphs);
  L.push("**B · Your Current Life Map**", "", `*${n.mapIntro}*`, ""); for (const x of n.mapReading.paragraphs) L.push(x.text, "");
  p("C · What stands out in your life right now", n.standsOut.paragraphs);
  p("D · Your relationship with yourself", n.self.paragraphs); if (n.self.question) L.push(`*${n.self.question}*`, "");
  p("E · Your life is interconnected", n.connections.paragraphs);
  L.push("**F · Five insight cards**", "");
  for (const c of n.cards) {
    L.push(`*${c.title}* — ${c.lead}`, "");
    for (const s of c.sections) L.push(`- **${s.heading}.** ${s.text}`);
    L.push(`- Why it may matter: ${c.why}`, `- Question: *${c.question}*`, "");
  }
  L.push("**G · Your eight Orbits**", "");
  for (const o of n.orbits) L.push(`**${o.name}.** ${o.paragraphs.join(" ")} *${o.question}*`, "");
  L.push("**H · A question worth taking with you**", "", `*${n.closingQuestion.text}*`, "");
  return { n, md: L.join("\n") };
}
function evidenceTable(os: Observation[]) {
  const rows = ["| Rule | Responses it rests on | Where it appears |", "| --- | --- | --- |"];
  for (const o of os) rows.push(`| ${o.rule} | ${short(o.evidence.map((e) => `${e.questionId} = ${e.answer}`).join("; "))} | ${(o as Observation & { usedIn: string[] }).usedIn.map((u) => WHERE[u] ?? u).join(", ") || "not shown (cap)"} |`);
  return rows.join("\n");
}
const out: string[] = [];
const GENERIC = new Set(["priority.top", "energy.balance", "support.similar", "support.contrast", "link.overall"]);
for (const [title, a] of [["Example 1 — an ambitious season, restoration giving way", EXAMPLE_AMBITION], ["Example 2 — a life largely working", EXAMPLE_WORKING], ["Example 3 — several areas under strain", EXAMPLE_STRAIN]] as const) {
  const { n, md } = full(a);
  const lead = n.observations.find((o) => n.opening.paragraphs[0].observationIds.includes(o.id))!;
  const related = n.observations.filter((o) => o !== lead && !GENERIC.has(o.rule) && o.areas.some((x) => lead.areas.includes(x)));
  out.push(`### ${title}`, "", md, `**Behind the central interpretation** (lead rule \`${lead.rule}\`, relevance ${lead.relevance})`, "", evidenceTable([lead, ...related]), "");
}
writeFileSync(process.argv[2] ?? "/dev/stdout", out.join("\n"));
