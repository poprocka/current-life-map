/**
 * Client PDF (addendum §5). Isomorphic: the results page builds it in the browser for "Download PDF",
 * the server builds the identical file from the stored snapshot for "Email me my PDF".
 * Content is taken only from the frozen LifeMapResult — the same object the results page renders.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { LifeMapResult } from "@/engine/compute";
import { ORBIT_TINT, orbitGeometry } from "@/components/map-geometry";
import { OPENING } from "@/content/v10/opening";
import { snapshotFingerprint } from "@/lib/stable";
import { reportModel } from "./model";

const LINEN = rgb(0.961, 0.929, 0.886);
const MAHOGANY = rgb(0.122, 0.078, 0.067);
const BURGUNDY = rgb(0.329, 0.059, 0.149);
const TAUPE = rgb(0.55, 0.49, 0.45);
const W = 595.28, H = 841.89, M = 56;

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

/** Standard PDF fonts only cover WinAnsi; map the few typographic characters we use, drop anything else. */
export function winAnsi(s: string): string {
  return s
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/–/g, "-").replace(/—/g, "-")
    .replace(/…/g, "...").replace(/·/g, "-").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/−/g, "-")
    .replace(/[^\x20-\x7E -ÿ]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of winAnsi(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

export interface PdfOptions { generatedAt?: Date }

export async function buildClientPdf(result: LifeMapResult, opts: PdfOptions = {}): Promise<Uint8Array> {
  const model = reportModel(result);
  const fingerprint = await snapshotFingerprint(result);
  const doc = await PDFDocument.create();
  doc.setTitle("Your Current Life Map");
  doc.setProducer("The Current Life Map");
  doc.setCreator(`scoring ${result.versions.scoring}`);
  if (opts.generatedAt) { doc.setCreationDate(opts.generatedAt); doc.setModificationDate(opts.generatedAt); }
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page!: PDFPage;
  let y = 0;
  const newPage = () => {
    page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: LINEN });
    y = H - M;
  };
  const need = (h: number) => { if (y - h < M + 30) newPage(); };
  const text = (s: string, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number; width?: number; gap?: number } = {}) => {
    const font = o.font ?? sans, size = o.size ?? 10, lh = size * 1.45;
    for (const line of wrap(s, font, size, o.width ?? W - 2 * M)) {
      need(lh);
      page.drawText(line, { x: o.x ?? M, y: y - size, size, font, color: o.color ?? MAHOGANY });
      y -= lh;
    }
    y -= o.gap ?? 0;
  };
  const eyebrow = (s: string) => { need(40); y -= 10; text(s.toUpperCase(), { font: sansBold, size: 7.5, color: BURGUNDY, gap: 4 }); };

  newPage();
  eyebrow("Your Current Life Map");
  text(OPENING.title, { font: serif, size: 28, gap: 8 });
  text(model.intro, { size: 9.5, color: TAUPE, gap: 10 });

  // Map — same geometry as the on-screen Map (size = importance, brightness = support proxy, neutral distance)
  const box = 290;
  need(box + 20);
  y -= 10;
  const cx = W / 2, cy = y - box / 2, k = box / 540; // 540 map units = widest orbit extent incl. planets and labels
  page.drawCircle({ x: cx, y: cy, size: 50 * k, color: hex("#E8C77A"), opacity: 0.9 });
  page.drawText("You", { x: cx - serif.widthOfTextAtSize("You", 11) / 2, y: cy - 4, size: 11, font: serif, color: MAHOGANY });
  for (const o of result.orbits) {
    const gmt = orbitGeometry(o);
    const x = cx + (gmt.x - 280) * k, yy = cy - (gmt.y - 280) * k, r = gmt.size * k;
    page.drawCircle({ x, y: yy, size: r, color: hex(ORBIT_TINT[o.orbit]), opacity: Math.min(1, gmt.bright) });
    const label = winAnsi(o.name);
    page.drawText(label, { x: x - sans.widthOfTextAtSize(label, 7.5) / 2, y: yy - r - 10, size: 7.5, font: sans, color: TAUPE });
  }
  y -= box + 18;
  for (const l of model.legend) text(l, { size: 7.5, color: TAUPE });
  y -= 8;

  eyebrow("Map interpretation");
  for (const r of model.table) {
    need(16);
    page.drawCircle({ x: M + 3, y: y - 6, size: 3, color: hex(ORBIT_TINT[r.orbit]) });
    page.drawText(winAnsi(r.name), { x: M + 12, y: y - 9, size: 10, font: serif, color: MAHOGANY });
    page.drawText(winAnsi(r.importance), { x: M + 110, y: y - 9, size: 8.5, font: sans, color: MAHOGANY });
    page.drawText(winAnsi(r.energy), { x: M + 230, y: y - 9, size: 8.5, font: sans, color: MAHOGANY });
    const feel = wrap(r.feelings, sans, 8.5, W - M - (M + 360));
    feel.forEach((f, i) => page.drawText(f, { x: M + 360, y: y - 9 - i * 11, size: 8.5, font: sans, color: TAUPE }));
    y -= Math.max(18, feel.length * 11 + 6);
  }

  eyebrow("Reality Snapshot");
  for (const s of model.snapshot) {
    text(`${s.label}: ${s.orbits}`, { font: serif, size: 13 });
    text(s.body, { size: 9.5, color: TAUPE, gap: 6 });
  }

  eyebrow("Energy Architecture");
  for (const l of model.reported) text(l, { size: 9.5 });
  y -= 6;
  text("What the Map suggests - to explore, not conclude", { font: sansBold, size: 8.5, color: BURGUNDY, gap: 2 });
  for (const l of model.suggests) text(`- ${l}`, { size: 9.5, gap: 2 });

  eyebrow("Where attention may matter most");
  text("Not ranked. Attention does not mean something is wrong.", { size: 8.5, color: TAUPE, gap: 4 });
  for (const a of model.attention) {
    text(a.name, { font: serif, size: 13 });
    for (const r of a.reasons) text(`- ${r}`, { size: 9.5, gap: 2 });
    y -= 4;
  }

  eyebrow("About this report");
  for (const c of model.caveats) text(c, { size: 8.5, color: TAUPE, gap: 3 });

  // Footer on every page: versions + snapshot fingerprint (matches the record in the coach workspace)
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const f = winAnsi(`Assessment ${result.versions.assessment} - scoring ${result.versions.scoring} - snapshot ${fingerprint.slice(0, 12)} - page ${i + 1} of ${pages.length}`);
    p.drawText(f, { x: M, y: 28, size: 6.5, font: sans, color: TAUPE });
  });
  return doc.save({ useObjectStreams: false });
}
