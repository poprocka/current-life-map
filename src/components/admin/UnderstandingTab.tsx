"use client";
import { useState } from "react";
import type { WorkspaceData } from "@/server/admin/types";
import type { UnderstandingDocument } from "@/engine/coach/understanding";
import { saveFile } from "@/lib/saveFile";
import { Card, btn, btnPrimary, fmtDate, input } from "./ui";

export interface UnderstandingActions {
  generateUnderstanding(): Promise<{ version: number; content: UnderstandingDocument }>;
  saveUnderstanding(content: UnderstandingDocument): Promise<number>;
}
type Doc = { version: number; kind: string; content: UnderstandingDocument; created_at: string };

const SOURCE: Record<string, string> = { confirmed: "confirmed", clarified: "clarified", challenged: "challenged", agreed: "agreed in session", map: "from the Map", coach: "" };

/** H · Client Understanding & Coaching Direction — built from what the person confirmed, clarified or challenged. */
export function UnderstandingTab({ data, actions, title }: { data: WorkspaceData; actions: UnderstandingActions; title: string }) {
  const [docs, setDocs] = useState<Doc[]>(data.understandingDocs ?? []);
  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UnderstandingDocument | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const doc = docs[sel];

  const generate = async () => {
    setStatus("Building from your marks…");
    try {
      const r = await actions.generateUnderstanding();
      setDocs((d) => [{ version: r.version, kind: "generated", content: r.content, created_at: new Date().toISOString() }, ...d]); setSel(0); setEditing(false); setStatus(null);
    } catch { setStatus("Couldn’t generate. Make sure the Coach Report exists."); }
  };
  const save = async () => {
    if (!draft) return;
    try {
      const v = await actions.saveUnderstanding(draft);
      setDocs((d) => [{ version: v, kind: "coach_edited", content: draft, created_at: new Date().toISOString() }, ...d]); setSel(0); setEditing(false); setStatus("Saved as a new version.");
    } catch { setStatus("Couldn’t save. Your edits are still here."); }
  };
  const download = async () => {
    const { buildUnderstandingPdf } = await import("@/lib/pdf/understandingPdf");
    const bytes = await buildUnderstandingPdf(doc.content, { title });
    await saveFile("client-understanding.pdf", new Blob([bytes as BlobPart], { type: "application/pdf" })).catch(() => undefined);
  };

  const shown = editing ? draft! : doc?.content;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        {!shown ? (
          <Card title="Client Understanding & Coaching Direction">
            <p className="text-[13.5px] leading-relaxed">After the Deep Dive, mark in the Coach Report which interpretations they <b className="font-normal">confirmed</b>, <b className="font-normal">clarified</b> or <b className="font-normal">challenged</b>, and record agreed next steps in Session Notes. Then build this document: it becomes the foundation of their potential 1:1 program.</p>
            <p className="mt-3 font-serif text-[16px] italic text-burgundy">The assessment gives you a starting picture; the conversation reveals the person.</p>
            <button className={`${btnPrimary} mt-4`} onClick={generate}>Build from the session</button>
          </Card>
        ) : (
          <article className="rounded-[18px] border hairline bg-white/50 p-6 sm:p-8">
            <p className="text-[10.5px] uppercase tracking-[0.16em] text-burgundy">Private · coach document</p>
            <h2 className="mt-2 font-serif text-[30px] font-light">Client Understanding & Coaching Direction</h2>
            <p className="mt-1 text-[12px] text-taupe">{title} · v{doc.version} · {doc.kind === "generated" ? "generated" : "edited by you"} · {fmtDate(doc.created_at)}</p>
            <p className="mt-4 font-serif text-[17px] italic text-burgundy">{shown.principle}</p>
            <p className="mt-2 text-[11.5px] text-taupe">Based on {shown.basedOn.confirmed} confirmed · {shown.basedOn.clarified} clarified · {shown.basedOn.challenged} challenged · {shown.basedOn.unmarked} not yet marked</p>
            <div className="mt-6 space-y-6">
              {shown.sections.map((s, si) => (
                <section key={s.key}>
                  <h3 className="text-[10.5px] uppercase tracking-[0.16em] text-burgundy">{s.title}</h3>
                  {editing ? (
                    <textarea className={`${input} mt-2 min-h-[90px] w-full leading-relaxed`} value={s.items.map((i) => i.text).join("\n")}
                      onChange={(e) => setDraft((d) => d && { ...d, sections: d.sections.map((x, k) => (k === si ? { ...x, items: e.target.value.split("\n").map((t, n) => ({ ...(x.items[n] ?? { source: "coach" as const }), text: t })) } : x)) })} />
                  ) : s.items.length ? (
                    <ul className="mt-2 space-y-2">
                      {s.items.map((it, k) => (
                        <li key={k} className="text-[13.5px] leading-relaxed">{it.text}{SOURCE[it.source] && <span className="ml-2 rounded-full bg-linen-deep px-2 py-0.5 text-[10px] text-taupe">{SOURCE[it.source]}</span>}</li>
                      ))}
                    </ul>
                  ) : <p className="mt-2 text-[12.5px] text-taupe">Nothing here yet.</p>}
                </section>
              ))}
            </div>
          </article>
        )}
      </div>
      <aside className="space-y-5">
        <Card title="Build">
          <button className={`${btnPrimary} w-full`} onClick={generate}>{docs.length ? "Rebuild from latest marks" : "Build from the session"}</button>
          <p className="mt-2 text-[11px] text-taupe">Challenged interpretations stay visible but never shape the coaching direction. Unmarked hypotheses stay open questions.</p>
        </Card>
        {doc && (
          <Card title="Edit & export">
            {editing ? (
              <div className="flex flex-col gap-2"><button className={btnPrimary} onClick={save}>Save as new version</button><button className={btn} onClick={() => setEditing(false)}>Discard</button></div>
            ) : (
              <div className="flex flex-col gap-2"><button className={btn} onClick={() => { setDraft(structuredClone(doc.content)); setEditing(true); }}>Edit document</button>
                <button className={btn} onClick={download}>Download PDF</button></div>
            )}
            <p className="mt-2 text-[11px] text-taupe">Private to you. Share with the client only if and when you choose.</p>
          </Card>
        )}
        {docs.length > 0 && (
          <Card title="Versions">
            <ul className="space-y-1 text-[12px]">{docs.map((d, k) => (
              <li key={d.version}><button onClick={() => { setSel(k); setEditing(false); }} className={`w-full rounded-lg px-2 py-1.5 text-left ${k === sel ? "bg-linen-deep text-burgundy" : "hover:bg-linen-deep/50"}`}>
                v{d.version} · {d.kind === "generated" ? "generated" : "edited by you"}<span className="block text-[10.5px] text-taupe">{fmtDate(d.created_at)}</span></button></li>
            ))}</ul>
          </Card>
        )}
        {status && <p role="status" className="text-[12px]">{status}</p>}
      </aside>
    </div>
  );
}
