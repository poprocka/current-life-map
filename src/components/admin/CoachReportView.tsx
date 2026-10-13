"use client";
/**
 * Coach Report tab — human interpretation first (Coach Intelligence guidelines §9).
 * Numbers, question IDs and methodology live in expandable evidence panels. Jana can edit any text
 * (saved as a new version; the generated original is kept) and, after the session, mark each
 * interpretation as confirmed, clarified or challenged.
 */
import { useMemo, useState } from "react";
import type { WorkspaceData } from "@/server/admin/types";
import type { CoachIntelligence, Insight } from "@/engine/coach/intelligence";
import type { CoachReport } from "@/engine/coach/report";
import type { ValidationStatus } from "@/engine/coach/understanding";
import { questionById } from "@/content/v10/question-bank";
import { POST_MAP_REFLECTIONS } from "@/content/v10/reflections";
import { Badge, Card, btn, btnPrimary, fmtDate, input } from "./ui";

export interface ReportActions {
  setReview(reportId: string, state: "unreviewed" | "in_review" | "reviewed"): Promise<void>;
  saveReportVersion(content: CoachReport): Promise<void>;
  saveValidation(v: { insightId: string; title: string; status: ValidationStatus; note: string | null }): Promise<void>;
  goToUnderstanding(): void;
}
type Vmap = Record<string, { status: ValidationStatus; note: string | null }>;
type Answers = Record<string, string | string[] | undefined>;

const STATUS: { v: ValidationStatus; label: string; tone: string }[] = [
  { v: "confirmed", label: "Confirmed", tone: "bg-[#E6EFE3] text-[#3E5A36] border-[#BFD3B7]" },
  { v: "clarified", label: "Clarified", tone: "bg-[#ECE7F0] text-[#5E4C6E] border-[#D3C8DD]" },
  { v: "challenged", label: "Challenged", tone: "bg-[#F3E2E2] text-[#7A2E2E] border-[#E2C1C1]" },
  { v: "not_discussed", label: "Not discussed", tone: "bg-linen-deep text-taupe border-linen-line" },
];

export function CoachReportView({ data, answers, actions }: { data: WorkspaceData; answers: Answers; actions: ReportActions }) {
  const versions = data.coachReports?.length ? data.coachReports : data.coachReport ? [{ id: data.coachReport.id, content: data.coachReport.content, kind: data.coachReport.kind ?? "generated", created_at: data.coachReport.created_at }] : [];
  const [list, setList] = useState(versions);
  const [sel, setSel] = useState(0);
  const current = list[sel];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CoachIntelligence | null>(current?.content.intelligence ?? null);
  const [status, setStatus] = useState<string | null>(null);
  const [review, setReview] = useState(data.coachReport?.review_state ?? "unreviewed");
  const [vals, setVals] = useState<Vmap>(() => Object.fromEntries((data.validations ?? []).map((v) => [v.insight_id, { status: v.status, note: v.note }])));

  if (!current) return <p className="text-[13px] text-taupe">The Coach Report is generated when the respondent completes the self-interview.</p>;
  const intel = editing ? draft : current.content.intelligence;
  const report = current.content;
  const marked = intel ? intel.validatable.filter((x) => vals[x.id]).length : 0;

  const mark = async (i: Insight, status: ValidationStatus, note: string | null) => {
    setVals((m) => ({ ...m, [i.id]: { status, note } }));
    try { await actions.saveValidation({ insightId: i.id, title: i.title, status, note }); } catch { setStatus("Couldn’t save that mark. Try again."); }
  };
  const editInsight = (id: string, text: string) => setDraft((d) => d && patchInsight(d, id, text));
  const save = async () => {
    if (!draft) return;
    setStatus("Saving…");
    try {
      const content = { ...report, intelligence: draft };
      await actions.saveReportVersion(content);
      const nv = { id: `local-${Date.now()}`, content, kind: "coach_edited", created_at: new Date().toISOString() };
      setList((l) => [nv, ...l]); setSel(0); setEditing(false); setStatus("Saved as a new version. The generated original is kept.");
    } catch { setStatus("Couldn’t save. Your edits are still here."); }
  };

  const block = (i: Insight) => <InsightBlock key={i.id} i={i} answers={answers} editing={editing} onEdit={editInsight} v={vals[i.id]} onMark={mark} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <div className="rounded-[14px] bg-[#F3E9EC] px-4 py-3 text-[12px] text-burgundy">
          <p className="font-serif text-[15px] italic">Private Coach Report: “Here’s what Jana may want to explore with this person, what the evidence supports, and what still needs to be understood.”</p>
          <p className="mt-1">Private to coaches. Never shown in the client’s results, PDF or any API they can reach. What they read is in tab B.</p>
        </div>
        {!intel ? <LegacyReport report={report} answers={answers} /> : (
          <>
            <Section n={1} title="Coach Overview">
              {editing
                ? <textarea className={`${input} min-h-[160px] w-full leading-relaxed`} value={draft!.overview.portrait} onChange={(e) => setDraft((d) => d && { ...d, overview: { ...d.overview, portrait: e.target.value } })} />
                : <p className="font-serif text-[18px] leading-[1.7] text-mahogany">{intel.overview.portrait}</p>}
              <div className="mt-5 rounded-[14px] bg-linen-deep/60 p-4">
                <p className="text-[10.5px] uppercase tracking-[0.14em] text-burgundy">The central theme of this Life Map</p>
                {editing
                  ? <textarea className={`${input} mt-2 w-full`} rows={3} value={draft!.overview.centralTheme} onChange={(e) => setDraft((d) => d && { ...d, overview: { ...d.overview, centralTheme: e.target.value } })} />
                  : <p className="mt-2 text-[14px] leading-relaxed">{intel.overview.centralTheme}</p>}
              </div>
              <PostMap answers={answers} />
            </Section>

            <Section n={2} title="Relationship With Self">
              <div className="space-y-3">{intel.self.dimensions.map(block)}</div>
              <div className="mt-4 grid gap-3 text-[12.5px] sm:grid-cols-3">
                <p><span className="block text-[10.5px] uppercase tracking-[0.12em] text-taupe">Appears established</span>{intel.self.established.join(", ") || "—"}</p>
                <p><span className="block text-[10.5px] uppercase tracking-[0.12em] text-taupe">May need attention</span>{intel.self.needsAttention.join(", ") || "—"}</p>
                <p><span className="block text-[10.5px] uppercase tracking-[0.12em] text-taupe">Most useful question</span><em className="font-serif text-[15px] text-burgundy">{intel.self.keyQuestion}</em></p>
              </div>
            </Section>

            <Section n={3} title="Values & Alignment">
              <p className="text-[13.5px] leading-relaxed"><b className="font-normal text-taupe">Values · </b>{intel.values.values}</p>
              <p className="mt-2 text-[13.5px] leading-relaxed"><b className="font-normal text-taupe">Needs · </b>{intel.values.needs}</p>
              <div className="mt-4 space-y-3">{intel.values.alignment.length ? intel.values.alignment.map(block) : <p className="text-[12.5px] text-taupe">No values–behaviour gap is supported by the answers.</p>}</div>
            </Section>

            <Section n={4} title="Eight Orbit Analysis">
              <div className="space-y-3">
                {intel.orbits.map((o) => (
                  <InsightBlock key={o.id} i={o} answers={answers} editing={editing} onEdit={editInsight} v={vals[o.id]} onMark={mark}
                    extra={<dl className="mt-3 grid gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-[150px_1fr]">
                      <dt className="text-taupe">What seems to work</dt><dd>{o.working}</dd>
                      <dt className="text-taupe">What may be difficult</dt><dd>{o.difficult}</dd>
                      <dt className="text-taupe">Their relationship with it</dt><dd>{o.relationship}</dd>
                      <dt className="text-taupe">Connection to the whole</dt><dd>{o.connection}</dd>
                    </dl>} hideText />
                ))}
              </div>
            </Section>

            <Section n={5} title="Cross-Orbit Patterns">
              <div className="space-y-3">{intel.patterns.length ? intel.patterns.map(block) : <p className="text-[12.5px] text-taupe">No cross-Orbit pattern is sufficiently supported.</p>}</div>
            </Section>

            <Section n={6} title="Strengths & Resources">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="mb-2 text-[10.5px] uppercase tracking-[0.12em] text-taupe">Internal</p><ul className="space-y-1.5 text-[13px]">{intel.strengths.internal.map((s) => <li key={s.id} title={s.text}>{s.title}</li>)}</ul></div>
                <div><p className="mb-2 text-[10.5px] uppercase tracking-[0.12em] text-taupe">External circumstances</p><ul className="space-y-1.5 text-[13px]">{intel.strengths.external.map((s) => <li key={s.id} title={s.text}>{s.title}</li>)}</ul></div>
              </div>
            </Section>

            <Section n={7} title="Friction & Opportunities">
              <div className="space-y-3">{intel.friction.length ? intel.friction.map(block) : <p className="text-[12.5px] text-taupe">No source of friction is clearly supported.</p>}</div>
            </Section>

            <Section n={8} title="Direction & Becoming">
              <p className="text-[13.5px] leading-relaxed">{intel.direction.summary}</p>
              <div className="mt-3 rounded-[14px] bg-linen-deep/60 p-4"><p className="text-[10.5px] uppercase tracking-[0.14em] text-burgundy">A possible next chapter</p><p className="mt-2 text-[13.5px]">{intel.direction.nextChapter}</p></div>
            </Section>

            <Section n={9} title="Coaching Readiness & Fit">
              <table className="w-full text-[12.5px]"><tbody>
                {intel.readiness.dimensions.map((d) => (
                  <tr key={d.key} className="border-t hairline align-top first:border-0"><td className="w-[170px] py-2">{d.label}</td>
                    <td className="py-2"><Badge v={d.level === "established" ? "confirmed" : d.level === "partly established" ? "pending" : "unreviewed"} label={d.level} /></td>
                    <td className="py-2 text-taupe">{d.note}</td></tr>
                ))}
              </tbody></table>
              <p className="mt-3 text-[13px]"><b className="font-normal text-burgundy">{intel.readiness.conclusion}.</b> {intel.readiness.conclusionReason}</p>
              <p className="mt-1 text-[11px] text-taupe">No numerical score. The fit decision belongs to you and the prospective client, after a conversation.</p>
            </Section>

            <Section n={10} title="Personalized Deep Dive Script"><p className="text-[13px] text-taupe">Editable in tab D. Every pattern and hypothesis above has a question there to confirm, refine or challenge it.</p></Section>

            <Section n={11} title="Potential Coaching Opportunity">
              <Lst title="Goals they may want help with" xs={intel.opportunity.goals} />
              <Lst title="Themes that could benefit from coaching" xs={intel.opportunity.themes} />
              <Lst title="Relevant parts of Life Architecture" xs={intel.opportunity.methodology} />
              <Lst title="Outcomes that could reasonably be explored" xs={intel.opportunity.outcomes} />
              <Lst title="Clarify before making an offer" xs={intel.opportunity.clarify} />
              <Lst title="Reasons coaching may not be the right fit" xs={intel.opportunity.cautions} />
              <div className="mt-3 rounded-[14px] border hairline p-4"><p className="text-[10.5px] uppercase tracking-[0.14em] text-burgundy">Suggested invitation</p><p className="mt-2 font-serif text-[16px] italic leading-relaxed">{intel.opportunity.invitation}</p></div>
            </Section>

            {(editing || intel.coachObservations?.length) && (
              <Section n={0} title="Your observations">
                {editing
                  ? <textarea className={`${input} min-h-[100px] w-full`} placeholder="One observation per line" value={(draft!.coachObservations ?? []).join("\n")} onChange={(e) => setDraft((d) => d && { ...d, coachObservations: e.target.value.split("\n") })} />
                  : <ul className="list-disc space-y-1 pl-5 text-[13px]">{intel.coachObservations!.filter(Boolean).map((o, k) => <li key={k}>{o}</li>)}</ul>}
              </Section>
            )}

            <details className="rounded-[18px] border hairline bg-white/40 p-5">
              <summary className="cursor-pointer text-[10.5px] uppercase tracking-[0.16em] text-burgundy">12 · Evidence & raw answers</summary>
              <div className="mt-4"><LegacyReport report={report} answers={answers} /></div>
            </details>
          </>
        )}
      </div>

      <aside className="space-y-5">
        <Card title="Review">
          <select className={`${input} w-full`} value={review} onChange={async (e) => { const v = e.target.value as typeof review; setReview(v); if (data.coachReport) await actions.setReview(data.coachReport.id, v as never); }}>
            <option value="unreviewed">Unreviewed</option><option value="in_review">In review</option><option value="reviewed">Reviewed</option>
          </select>
        </Card>
        <Card title="After the session">
          <p className="text-[12.5px]">{marked} of {intel?.validatable.length ?? 0} interpretations marked.</p>
          <p className="mt-1 text-[11px] text-taupe">Mark what they confirmed, clarified or challenged under each interpretation. That becomes the Client Understanding & Coaching Direction.</p>
          <button className={`${btnPrimary} mt-3 w-full`} onClick={actions.goToUnderstanding}>Client Understanding →</button>
        </Card>
        <Card title="Versions">
          <ul className="space-y-1 text-[12px]">
            {list.map((v, k) => (
              <li key={v.id}><button onClick={() => { setSel(k); setEditing(false); setDraft(v.content.intelligence ?? null); }}
                className={`w-full rounded-lg px-2 py-1.5 text-left ${k === sel ? "bg-linen-deep text-burgundy" : "hover:bg-linen-deep/50"}`}>
                {v.kind === "generated" ? "Generated" : "Edited by you"}<span className="block text-[10.5px] text-taupe">{fmtDate(v.created_at)}</span></button></li>
            ))}
          </ul>
          {intel && (editing
            ? <div className="mt-3 flex flex-col gap-2"><button className={btnPrimary} onClick={save}>Save as new version</button><button className={btn} onClick={() => { setDraft(current.content.intelligence ?? null); setEditing(false); }}>Discard</button></div>
            : <button className={`${btn} mt-3 w-full`} onClick={() => { setDraft(current.content.intelligence ?? null); setEditing(true); }}>Edit report</button>)}
          {status && <p role="status" className="mt-2 text-[11.5px]">{status}</p>}
        </Card>
      </aside>
    </div>
  );
}

function patchInsight(d: CoachIntelligence, id: string, text: string): CoachIntelligence {
  const f = <T extends Insight>(xs: T[]) => xs.map((x) => (x.id === id ? { ...x, text } : x));
  return { ...d, self: { ...d.self, dimensions: f(d.self.dimensions) }, values: { ...d.values, alignment: f(d.values.alignment) }, orbits: f(d.orbits), patterns: f(d.patterns), friction: f(d.friction) };
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[18px] border hairline bg-white/40 p-5 sm:p-6">
      <h3 className="mb-4 text-[10.5px] uppercase tracking-[0.16em] text-burgundy">{n ? `${n} · ` : ""}{title}</h3>
      {children}
    </section>
  );
}

function Lst({ title, xs }: { title: string; xs: string[] }) {
  if (!xs.length) return null;
  return <div className="mt-3 first:mt-0"><p className="text-[10.5px] uppercase tracking-[0.12em] text-taupe">{title}</p><ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px]">{xs.map((x) => <li key={x}>{x}</li>)}</ul></div>;
}

function PostMap({ answers }: { answers: Answers }) {
  const qs = POST_MAP_REFLECTIONS.questions.filter((q) => typeof answers[q.id] === "string" && (answers[q.id] as string).trim());
  const legacy = typeof answers["interconnections.reflection"] === "string" ? (answers["interconnections.reflection"] as string) : null;
  if (!qs.length && !legacy) return null;
  return (
    <div className="mt-5">
      <p className="text-[10.5px] uppercase tracking-[0.14em] text-taupe">In their own words</p>
      <ul className="mt-2 space-y-3">
        {legacy && <li className="text-[12.5px]"><span className="block text-taupe">What truth about your current life became harder to ignore…?</span><q className="font-serif text-[16px] italic">{legacy}</q></li>}
        {qs.map((q) => <li key={q.id} className="text-[12.5px]"><span className="block text-taupe">{q.prompt}</span><q className="font-serif text-[16px] italic">{answers[q.id] as string}</q></li>)}
      </ul>
    </div>
  );
}

function InsightBlock({ i, answers, editing, onEdit, v, onMark, extra, hideText }: {
  i: Insight; answers: Answers; editing: boolean; onEdit: (id: string, t: string) => void;
  v?: { status: ValidationStatus; note: string | null }; onMark: (i: Insight, s: ValidationStatus, note: string | null) => void;
  extra?: React.ReactNode; hideText?: boolean;
}) {
  const [note, setNote] = useState(v?.note ?? "");
  const claimLabel = { observation: "reported", pattern: "pattern", hypothesis: "hypothesis" }[i.claim];
  return (
    <article className="rounded-[14px] border hairline bg-white/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-serif text-[18px]">{i.title}</h4>
        <span className="flex gap-1.5 text-[10px] text-taupe"><span className="rounded-full bg-linen-deep px-2 py-0.5">{claimLabel}</span><span className="rounded-full bg-linen-deep px-2 py-0.5">{i.confidence} confidence</span></span>
      </div>
      {!hideText && (editing
        ? <textarea className={`${input} mt-2 w-full`} rows={3} value={i.text} onChange={(e) => onEdit(i.id, e.target.value)} />
        : <p className="mt-2 text-[13.5px] leading-relaxed">{i.text}</p>)}
      {extra}
      {i.questions[0] && <p className="mt-2 text-[13px] text-burgundy">Ask: <em className="font-serif text-[15px]">{i.questions[0]}</em></p>}
      <details className="mt-2 text-[12px]">
        <summary className="cursor-pointer text-taupe">Evidence, counter-evidence and alternatives</summary>
        <ul className="mt-2 space-y-1">
          {i.evidence.map((e, k) => <li key={k}><span className="font-mono text-[10.5px] text-taupe">{e.questionId}</span> {questionById(e.questionId)?.prompt ?? ""} → <b className="font-normal">{e.answer}</b></li>)}
          {i.counterEvidence.map((e, k) => <li key={`c${k}`} className="text-[#5E4C6E]">Counter: {questionById(e.questionId)?.prompt ?? e.questionId} → {e.answer}</li>)}
          {i.alternatives.map((a, k) => <li key={`a${k}`} className="italic text-taupe">Alternative: {a}</li>)}
        </ul>
      </details>
      {i.validatable && (
        <div className="mt-3 border-t hairline pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10.5px] uppercase tracking-[0.12em] text-taupe">In the session</span>
            {STATUS.map((s) => (
              <button key={s.v} onClick={() => onMark(i, s.v, note || null)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${v?.status === s.v ? s.tone : "border-linen-line text-mahogany/70 hover:border-burgundy/40"}`}>{s.label}</button>
            ))}
          </div>
          {v && v.status !== "not_discussed" && (
            <div className="mt-2 flex gap-2">
              <input className={`${input} flex-1`} placeholder={v.status === "challenged" ? "Their view, in their words" : v.status === "clarified" ? "What they clarified" : "Anything they added (optional)"} value={note} onChange={(e) => setNote(e.target.value)} />
              <button className={btn} onClick={() => onMark(i, v.status, note || null)}>Save note</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/** v1 sections, provenance and provisional F4/F5 — the technical appendix. */
function LegacyReport({ report: c, answers }: { report: CoachReport; answers: Answers }) {
  void answers;
  const rows = useMemo(() => c.provenance, [c]);
  return (
    <div className="space-y-5 text-[12.5px]">
      {c.provisional && (
        <div>
          <p className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-taupe">Congruence & attention · provisional (not shown to client)</p>
          <table className="w-full"><thead className="text-[9.5px] uppercase tracking-[0.08em] text-taupe"><tr><th className="text-left font-normal">Orbit</th><th className="text-right font-normal">Statement</th><th className="text-right font-normal">Supporting</th><th className="text-right font-normal">Score</th><th className="pl-3 text-left font-normal">Band</th><th className="text-right font-normal">Tier</th></tr></thead>
            <tbody>{c.provisional.congruence.map((x) => { const t = c.provisional!.tiers.find((y) => y.orbit === x.orbit)!; return (
              <tr key={x.orbit} className="border-t hairline"><td className="py-1">{x.name}</td><td className="text-right">{x.direct === null ? "—" : x.direct.toFixed(2)}</td><td className="text-right">{x.supporting === null ? "—" : x.supporting.toFixed(2)}</td><td className="text-right">{x.value === null ? "—" : x.value.toFixed(2)}</td><td className="pl-3">{x.band ?? "not enough information"}{x.mixed && <span className="ml-1.5 text-burgundy">· mixed</span>}{x.nearBoundary && <span className="ml-1.5 text-taupe">· near boundary</span>}</td><td className="text-right">{t.tier ?? "—"}</td></tr>); })}</tbody></table>
        </div>
      )}
      <div>
        <p className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-taupe">Metric provenance</p>
        <table className="w-full"><thead className="text-[9.5px] uppercase tracking-[0.08em] text-taupe"><tr><th className="text-left font-normal">Orbit</th><th className="text-right font-normal">Importance</th><th className="text-right font-normal">Energy</th><th className="text-right font-normal">Support</th><th className="text-right font-normal">n</th></tr></thead>
          <tbody>{rows.map((p) => <tr key={p.orbit} className="border-t hairline"><td className="py-1">{p.name}</td><td className="text-right">{p.importanceDirect ?? "—"}</td><td className="text-right">{p.energySigned ?? "—"}</td><td className="text-right">{p.responseSupportIndex ?? "—"}</td><td className="text-right text-taupe">{p.coverage}</td></tr>)}</tbody></table>
      </div>
      {c.sections.map((s) => (
        <div key={s.key}><p className="text-[10.5px] uppercase tracking-[0.12em] text-taupe">{s.title}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{s.items.map((i) => <li key={i.id}>{i.text}</li>)}</ul></div>
      ))}
      <div><p className="text-[10.5px] uppercase tracking-[0.12em] text-taupe">Formulas</p><ul className="mt-1 list-disc pl-5">{c.formulas.map((f) => <li key={f}>{f}</li>)}</ul></div>
      <div><p className="text-[10.5px] uppercase tracking-[0.12em] text-taupe">Open methodology flags</p><ul className="mt-1 space-y-0.5">{c.openFlags.map((f) => <li key={f.id}><b className="font-normal text-burgundy">{f.id}</b> {f.item}</li>)}</ul></div>
      <p className="text-taupe">Scoring {c.versions.scoring} ({c.scoringStatus}) · question bank {c.versions.questionBank} · template {c.templateVersion}{c.intelligence ? ` / ${c.intelligence.templateVersion}` : ""}</p>
    </div>
  );
}
