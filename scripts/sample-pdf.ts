/** Writes a sample client PDF (invented answers) exactly as emailed. Run: npx tsx scripts/sample-pdf.ts <out.pdf> */
import fs from "fs";
import { ACTIVE_QUESTIONS } from "../src/content/v10/question-bank";
import { computeLifeMap } from "../src/engine/compute";
import { generateResultInsights } from "../src/engine/insights";
import { buildClientPdf } from "../src/lib/pdf/clientReport";
import { POST_MAP_REFLECTIONS } from "../src/content/v10/reflections";

const a: Record<string, string | string[]> = {};
let i = 0;
const truth = ["3", "2", "4", "1", "3", "2", "3"];
const imp: Record<string, string> = { mind: "3", body: "4", restoration: "4", growth: "3", love: "1", social: "4", resources: "2", joy: "2" };
const en: Record<string, string> = { mind: "-1", body: "0", restoration: "-2", growth: "1", love: "0", social: "-1", resources: "0", joy: "2" };
const feelings: Record<string, number[]> = { mind: [0, 8], body: [1, 2], restoration: [10, 11, 7], growth: [1, 5], love: [5], social: [9, 10], resources: [0, 6], joy: [0, 4] };
for (const q of ACTIVE_QUESTIONS) {
  if (q.responseType === "importance") a[q.id] = imp[q.chapterId];
  else if (q.responseType === "energy") a[q.id] = en[q.chapterId];
  else if (q.responseType === "truth") a[q.id] = q.chapterId === "restoration" ? "1" : truth[i++ % 7];
  else if (q.responseType === "emotional_state") a[q.id] = feelings[q.chapterId].map((k) => q.options[k].value);
}
Object.assign(a, { "interconnections.01": "social", "interconnections.02": "joy", "interconnections.03": "restoration", "interconnections.04": "restoration",
  "interconnections.05": "growth", "interconnections.06": "resources", "interconnections.07": "somewhat_compete" });
const reflections = [
  { prompt: POST_MAP_REFLECTIONS.questions[0].prompt, text: "How little room I leave for rest, even though I rate it as one of the most important things." },
  { prompt: POST_MAP_REFLECTIONS.questions[3].prompt, text: "Sleep. I know I need it, and I keep trading it for one more hour of work." },
];
const r = computeLifeMap(a);
buildClientPdf(r, { generatedAt: new Date("2026-10-12T16:00:00Z"), insights: generateResultInsights(r, a), reflections }).then((b) => {
  fs.writeFileSync(process.argv[2] ?? "sample.pdf", b);
  console.log("written", b.length);
});
