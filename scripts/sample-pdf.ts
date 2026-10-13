// Writes a sample emailed PDF. Usage: node --conditions=react-server --import <tsx loader> scripts/sample-pdf.ts out.pdf
import fs from "fs";
import { computeLifeMap } from "@/engine/compute";
import { generateResultInsights } from "@/engine/insights";
import { buildResultsPdf } from "@/server/pdf/render";
import { EXAMPLE_STRAIN } from "../tests/fixtures/personas";
const a: any = EXAMPLE_STRAIN;
const r = computeLifeMap(a);
const t = Date.now();
buildResultsPdf(r, { insights: generateResultInsights(r, a), generatedAt: new Date("2026-10-13"), reflections: [{ prompt: "What can you see about your life now that you were not seeing as clearly before this self-interview?", text: "That I keep postponing rest until everything else is done." }] })
  .then((b) => { fs.writeFileSync(process.argv[2], b); console.log("ok", b.length, Date.now() - t, "ms"); });
