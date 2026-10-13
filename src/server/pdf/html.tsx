/**
 * Entry for the PDF's HTML. Bundled by scripts/build-pdf-assets.mjs into document.generated.js so the server can
 * render the results page (client components included) to static HTML without the app's React Server Components layer.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { ResultsPdfDocument } from "@/components/ResultsPdfDocument";
import type { LifeMapResult } from "@/engine/compute";
import type { ResultInsights } from "@/engine/insights";
import { PRINT_CSS } from "./print-assets.generated";

export interface PdfHtmlInput {
  result: LifeMapResult;
  insights?: ResultInsights;
  reflections?: { prompt: string; text: string }[];
  generatedAt?: string;
  reference?: string;
}

export function renderResultsHtml({ result, insights, reflections, generatedAt, reference }: PdfHtmlInput): string {
  const body = renderToStaticMarkup(
    <ResultsPdfDocument result={result} insights={insights} reflections={reflections} generatedAt={generatedAt ? new Date(generatedAt) : undefined} reference={reference} />,
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Your Current Life Map</title><style>${PRINT_CSS}</style></head><body>${body}</body></html>`;
}
