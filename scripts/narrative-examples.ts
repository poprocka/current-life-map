/** Prints the full results narrative for the three fictional examples. Run: npx tsx scripts/narrative-examples.ts [md-out] */
import { writeFileSync } from "node:fs";
import { computeLifeMap } from "@/engine/compute";
import { generateNarrative } from "@/engine/narrative";
import { EXAMPLE_AMBITION, EXAMPLE_STRAIN, EXAMPLE_WORKING } from "../tests/fixtures/personas";

export function renderMarkdown(title: string, a: Record<string, string | string[]>) {
  const n = generateNarrative(computeLifeMap(a), a);
  const L: string[] = [`## ${title}`, ""];
  const sec = (h: string, ps: { text: string }[]) => { L.push(`### ${h}`, ""); for (const p of ps) L.push(p.text, ""); };
  sec(`A · ${n.opening.title}`, n.opening.paragraphs);
  L.push(`### B · Your Current Life Map`, "", `*${n.mapIntro}*`, ""); for (const p of n.mapReading.paragraphs) L.push(p.text, "");
  sec(`C · ${n.standsOut.title}`, n.standsOut.paragraphs);
  sec(`D · ${n.self.title}`, n.self.paragraphs); if (n.self.question) L.push(`*${n.self.question}*`, "");
  sec(`E · ${n.connections.title}`, n.connections.paragraphs);
  L.push("### F · Five insight cards", "");
  for (const c of n.cards) {
    L.push(`**${c.title}** (${c.purpose})${c.fallback ? " — fallback" : ""}`, "", `*${c.lead}*`, "");
    for (const s of c.sections) L.push(`- **${s.heading}.** ${s.text}`);
    L.push("", `Why it may matter: ${c.why}`, "", `Question: *${c.question}*`, "");
  }
  L.push("### G · Your eight Orbits", "");
  for (const o of n.orbits) L.push(`**${o.name}.** ${o.paragraphs.join(" ")} *${o.question}*`, "");
  L.push("### H · A question worth taking with you", "", `*${n.closingQuestion.text}*`, "", `> ${n.deepDiveBridge}`, "");
  L.push(`<sub>Opening: ${n.opening.paragraphs.map((p) => p.text).join(" ").split(/\s+/).length} words · ${n.observations.length} candidate observations · ${n.observations.filter((o) => o.usedIn.length).length} used · validation issues: ${n.validationIssues.length} · repeats removed: ${n.removedRepeats.length}</sub>`, "");
  return L.join("\n");
}

const md = [
  renderMarkdown("Example 1 — an ambitious season, restoration giving way", EXAMPLE_AMBITION),
  renderMarkdown("Example 2 — a life largely working", EXAMPLE_WORKING),
  renderMarkdown("Example 3 — several areas under strain", EXAMPLE_STRAIN),
].join("\n---\n\n");
if (process.argv[2]) writeFileSync(process.argv[2], md); else console.log(md);
