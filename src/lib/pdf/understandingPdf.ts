/** PDF of the Client Understanding & Coaching Direction (coach-only download). */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { UnderstandingDocument } from "@/engine/coach/understanding";
import { winAnsi } from "./clientReport";

const LINEN = rgb(0.961, 0.929, 0.886), MAHOGANY = rgb(0.122, 0.078, 0.067), BURGUNDY = rgb(0.329, 0.059, 0.149), TAUPE = rgb(0.55, 0.49, 0.45);
const W = 595.28, H = 841.89, M = 56;

export async function buildUnderstandingPdf(doc: UnderstandingDocument, opts: { title: string }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Client Understanding & Coaching Direction");
  const serif = await pdf.embedFont(StandardFonts.TimesRoman), sans = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page!: PDFPage, y = 0;
  const np = () => { page = pdf.addPage([W, H]); page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: LINEN }); y = H - M; };
  const wrap = (t: string, f: PDFFont, s: number, w: number) => {
    const out: string[] = []; let line = "";
    for (const word of winAnsi(t).split(/\s+/)) { const c = line ? `${line} ${word}` : word; if (f.widthOfTextAtSize(c, s) > w && line) { out.push(line); line = word; } else line = c; }
    if (line) out.push(line); return out;
  };
  const text = (t: string, o: { f?: PDFFont; s?: number; c?: ReturnType<typeof rgb>; x?: number; gap?: number } = {}) => {
    const f = o.f ?? sans, s = o.s ?? 10, x = o.x ?? M;
    for (const l of wrap(t, f, s, W - x - M)) { if (y - s * 1.5 < M) np(); page.drawText(l, { x, y: y - s, size: s, font: f, color: o.c ?? MAHOGANY }); y -= s * 1.5; }
    y -= o.gap ?? 0;
  };
  np();
  text("PRIVATE · COACH DOCUMENT", { f: bold, s: 7.5, c: BURGUNDY, gap: 4 });
  text("Client Understanding & Coaching Direction", { f: serif, s: 24, gap: 2 });
  text(opts.title, { s: 10, c: TAUPE, gap: 4 });
  text(doc.principle, { f: serif, s: 12, c: BURGUNDY, gap: 10 });
  for (const sec of doc.sections) {
    if (!sec.items.length) continue;
    y -= 6;
    text(sec.title.toUpperCase(), { f: bold, s: 8, c: BURGUNDY, gap: 3 });
    for (const it of sec.items) text(`- ${it.text}`, { s: 10, x: M + 4, gap: 3 });
  }
  pdf.getPages().forEach((p, i, a) => p.drawText(`Private - page ${i + 1} of ${a.length}`, { x: M, y: 28, size: 6.5, font: sans, color: TAUPE }));
  return pdf.save();
}
