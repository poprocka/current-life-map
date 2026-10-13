import { computeLifeMap } from "@/engine/compute";
import { generateNarrative } from "@/engine/narrative";
import { visibleTexts } from "@/engine/narrative/validate";
import { EXAMPLE_WORKING, persona } from "../tests/fixtures/personas";
const run = (a: any) => generateNarrative(computeLifeMap(a), a);
console.log(JSON.stringify(run(EXAMPLE_WORKING).cards.find((c) => c.key === "tension"), null, 1).slice(0, 1500));
const a = persona({ items: { "love.02": "na", "love.03": "na" } });
for (const t of visibleTexts(run(a))) if (/\b(single|partnered|unpartnered|relationship status|not in a relationship|dating)\b/i.test(t.text)) console.log("LOVE:", t.where, t.text);
console.log(JSON.stringify(run(persona({})).cards.find((c) => c.key === "tension")!.sections));
