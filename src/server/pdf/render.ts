import "server-only";
import type { LifeMapResult } from "@/engine/compute";
import type { ResultInsights } from "@/engine/insights";
import { snapshotFingerprint } from "@/lib/stable";
import { CONTACT_EMAIL, CONTACT_INVITE } from "@/content/contact";
import { renderResultsHtml } from "./document.generated.cjs";

/**
 * The emailed PDF = the results page printed by headless Chromium (Jana, 2026-10-13: same look as the page, all text visible,
 * laid out for the PDF format, no calls to action). It has its own A4 layout (components/ResultsPdfDocument), with no calls to action.
 *
 * Privacy: the HTML is built on the server from the frozen snapshot; Chromium gets it via setContent with every network
 * request blocked, so nothing about the person leaves the server and no URL ever carries their data.
 *
 * Chromium: PDF_CHROMIUM_PATH (an executable) if set, else @sparticuz/chromium when installed (serverless hosts), else the
 * Playwright browser on this machine. If none is available the call throws — the caller records a failed send; nothing
 * is ever reported as sent without a real PDF.
 */
export interface PdfOptions {
  generatedAt?: Date;
  reflections?: { prompt: string; text: string }[];
  insights?: ResultInsights;
}

const LAYOUT_WIDTH = 900; // CSS px: the PDF has its own A4 layout (ResultsPdfDocument); ≈9 pt body text
const A4_WIDTH = 794; // CSS px at 96 dpi
const SCALE = Math.round((A4_WIDTH / LAYOUT_WIDTH) * 100) / 100;

async function launch() {
  const { chromium } = await import("playwright-core");
  if (process.env.PDF_CHROMIUM_PATH) return chromium.launch({ executablePath: process.env.PDF_CHROMIUM_PATH, args: ["--no-sandbox"] });
  try {
    const spec = "@sparticuz/chromium";
    const mod = (await import(/* webpackIgnore: true */ spec)) as { default: { executablePath: () => Promise<string>; args: string[] } };
    return chromium.launch({ executablePath: await mod.default.executablePath(), args: mod.default.args });
  } catch {
    return chromium.launch({ args: ["--no-sandbox"] });
  }
}

export async function buildResultsPdf(result: LifeMapResult, opts: PdfOptions = {}): Promise<Uint8Array> {
  const ref = (await snapshotFingerprint(result)).slice(0, 12);
  const html = renderResultsHtml({ result, insights: opts.insights, reflections: opts.reflections, generatedAt: opts.generatedAt?.toISOString(), reference: ref });
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: LAYOUT_WIDTH, height: 1400 } });
    await page.route("**/*", (r) => (r.request().url().startsWith("data:") ? r.continue() : r.abort()));
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "A4", printBackground: true, scale: SCALE, preferCSSPageSize: false,
      margin: { top: "12mm", bottom: "16mm", left: "0", right: "0" },
      displayHeaderFooter: true,
      // Header and footer bands painted linen so the page margins match the page (Chromium leaves them white otherwise)
      headerTemplate: `<style>html,body{margin:0;padding:0;-webkit-print-color-adjust:exact}</style><div style="position:absolute;top:-1mm;left:0;right:0;height:13.2mm;background:#F5EDE2"></div>`,
      footerTemplate: `<style>html,body{margin:0;padding:0;-webkit-print-color-adjust:exact}</style><div style="position:absolute;bottom:-1mm;left:0;right:0;height:17.2mm;background:#F5EDE2"></div><div style="position:relative;width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7.5px;color:#9C8A7A;display:flex;justify-content:space-between;padding:0 14mm 4mm">
        <span>${CONTACT_INVITE} ${CONTACT_EMAIL}</span>
        <span>The Current Life Map · page <span class="pageNumber"></span> of <span class="totalPages"></span> · reference ${ref}</span></div>`,
    });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}
