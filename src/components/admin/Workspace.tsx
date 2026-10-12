"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { WorkspaceData, NoteView, ScriptVersion } from "@/server/admin/types";
import type { NoteInput } from "@/server/admin/mutations";
import type { DeepDiveScript, ScriptBlock } from "@/engine/coach/script";
import type { CoachItem } from "@/engine/coach/shared";
import { answerLabel } from "@/engine/coach/shared";
import { CHAPTERS } from "@/content/v10/chapters";
import { QUESTION_BANK, QUESTION_BANK_VERSION, questionById } from "@/content/v10/question-bank";
import { NOT_APPLICABLE } from "@/content/types";
import { ResultsView } from "@/components/ResultsView";
import { Badge, Card, btn, btnPrimary, fmtDate, input, shortId } from "./ui";

export interface WorkspaceActions {
  saveScript(content: DeepDiveScript, bookingId: string | null): Promise<number>;
  saveNote(n: NoteInput): Promise<string>;
  setReview(reportId: string, state: "unreviewed" | "in_review" | "reviewed"): Promise<void>;
  setBookingOutcome(bookingId: string, state: "completed" | "no_show"): Promise<void>;
  deleteAssessment(): Promise<void>;
  pdfHref: string | null;
  exportHref: string | null;
  listHref: string;
}

const TABS = [
  ["answers", "A · Answers"], ["map", "B · Client’s Map"], ["report", "C · Coach Report"], ["script", "D · Deep Dive Script"],
  ["contact", "E · Contact & Booking"], ["notes", "F · Session Notes"], ["activity", "G · Activity & Audit"],
] as const;
type Tab = (typeof TABS)[number][0];

/** Assessment detail / client workspace (addendum §3). */
export function Workspace({ data, actions }: { data: WorkspaceData; actions: WorkspaceActions }) {
  const [tab, setTab] = useState<Tab>("answers");
  const answers = useMemo(() => Object.fromEntries(data.answers.map((a) => [a.question_id, a.value ?? undefined])) as Record<string, string | string[] | undefined>, [data.answers]);
  const client = data.clients.at(-1);
  const booking = data.bookings.filter((b) => b.booking_state !== "rescheduled").at(-1);

  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-24 pt-6 sm:px-10">
      <Link href={actions.listHref} className="text-[11px] uppercase tracking-[0.14em] text-taupe hover:text-burgundy">← All assessments</Link>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b hairline pb-5">
        <div>
          <p className="eyebrow">Assessment <span className="font-mono normal-case tracking-normal">{data.assessment.id}</span></p>
          <h1 className="mt-2 font-serif text-[34px] font-light leading-tight">{client?.name ?? client?.email ?? "Anonymous respondent"}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-taupe">
            <Badge v={data.assessment.status} /> {data.assessment.status === "completed" ? `Completed ${fmtDate(data.assessment.completed_at)}` : `${data.assessment.sections_completed}/10 sections`}
            {booking && <> · Deep Dive <Badge v={booking.booking_state} /> {fmtDate(booking.scheduled_start, booking.timezone)} <Badge v={booking.payment_state} /></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.exportHref && data.viewer.role === "admin" && <a className={btn} href={actions.exportHref}>Export data</a>}
          {data.viewer.role === "admin" && <DeleteButton onDelete={actions.deleteAssessment} />}
        </div>
      </header>

      <nav className="mt-5 flex gap-1 overflow-x-auto border-b hairline" role="tablist" aria-label="Workspace sections">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[12px] transition ${tab === k ? "border-burgundy text-burgundy" : "border-transparent text-mahogany/70 hover:text-mahogany"}`}>
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-6" role="tabpanel">
        {tab === "answers" && <AnswersTab data={data} answers={answers} />}
        {tab === "map" && <MapTab data={data} pdfHref={actions.pdfHref} />}
        {tab === "report" && <ReportTab data={data} answers={answers} actions={actions} />}
        {tab === "script" && <ScriptTab data={data} answers={answers} actions={actions} />}
        {tab === "contact" && <ContactTab data={data} actions={actions} />}
        {tab === "notes" && <NotesTab data={data} actions={actions} />}
        {tab === "activity" && <ActivityTab data={data} />}
      </div>
    </div>
  );
}

function Evidence({ item, answers }: { item: CoachItem; answers: Record<string, string | string[] | undefined> }) {
  if (!item.evidence.length) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {item.evidence.map((e, i) => {
        const q = questionById(e.questionId);
        const title = q ? `${q.prompt}\n→ ${answerLabel(e.questionId, answers[e.questionId])}` : e.kind === "derived" ? `Derived value ${e.answer}` : e.answer;
        return <span key={i} title={title} className="cursor-help rounded bg-linen-deep px-1.5 py-0.5 font-mono text-[10px] text-mahogany/70">{e.questionId}{e.kind === "derived" ? ` = ${e.answer}` : ""}</span>;
      })}
    </span>
  );
}

function ItemLine({ item, answers }: { item: CoachItem; answers: Record<string, string | string[] | undefined> }) {
  return (
    <li className="py-2">
      <span className="text-[13px] leading-relaxed">{item.text}</span>
      {item.basis === "hypothesis" && <span className="ml-2 rounded-full bg-[#F6ECD9] px-2 py-0.5 text-[10px] text-[#8A6420]">hypothesis</span>}
      {item.basis === "coach" && <span className="ml-2 rounded-full bg-linen-deep px-2 py-0.5 text-[10px] text-taupe">coach</span>}
      {item.uncertainty && <span className="block text-[11.5px] italic text-taupe">{item.uncertainty}</span>}
      <Evidence item={item} answers={answers} />
    </li>
  );
}

// ── A. Answers ───────────────────────────────────────────────────────────────
function AnswersTab({ data, answers }: { data: WorkspaceData; answers: Record<string, string | string[] | undefined> }) {
  const rows = Object.fromEntries(data.answers.map((a) => [a.question_id, a]));
  return (
    <div className="space-y-6">
      <p className="text-[12px] text-taupe">
        Question bank <span className="font-mono">{data.assessment.question_bank_version}</span> · assessment version <span className="font-mono">{data.assessment.assessment_version}</span>
        {data.assessment.question_bank_version !== QUESTION_BANK_VERSION && <b className="ml-2 font-normal text-burgundy">Answered under an earlier question bank — wording shown is the current version.</b>}
      </p>
      {CHAPTERS.map((c) => {
        const qs = QUESTION_BANK.filter((q) => q.chapterId === c.id && q.enabled);
        return (
          <Card key={c.id} title={`${c.name}${c.subtitle ? ` — ${c.subtitle}` : ""}`}>
            <table className="w-full text-[12.5px]">
              <thead className="text-[10px] uppercase tracking-[0.1em] text-taupe"><tr>
                <th className="w-[110px] pb-2 text-left font-normal">ID</th><th className="pb-2 text-left font-normal">Question · Explore · cue</th>
                <th className="w-[230px] pb-2 text-left font-normal">Response</th><th className="w-[130px] pb-2 text-left font-normal">Answered</th>
              </tr></thead>
              <tbody>
                {qs.map((q) => {
                  const r = rows[q.id], v = answers[q.id];
                  return (
                    <tr key={q.id} className="border-t hairline align-top">
                      <td className="py-2 pr-2 font-mono text-[10.5px] text-taupe">{q.id}{q.reverseKeyed && <span className="block text-[9.5px] text-[#8A6420]">reverse-keyed</span>}</td>
                      <td className="py-2 pr-4">
                        {q.prompt}
                        <span className="block text-[11px] text-taupe">{q.exploreCategory}{q.cue?.text ? ` · ${q.cue.text}` : ""}</span>
                      </td>
                      <td className="py-2 pr-2">
                        {r?.response_status === "not_applicable" || v === NOT_APPLICABLE ? <Badge v="not_applicable" label="N/A · excluded" />
                          : v === undefined ? <span className="text-taupe">{q.optional ? "Skipped (optional)" : "Not answered"}</span>
                          : q.responseType === "text" ? <q className="italic">{String(v)}</q>
                          : answerLabel(q.id, v)}
                        {r?.raw_ordinal != null && <span className="ml-1 text-[10.5px] text-taupe">({r.raw_ordinal})</span>}
                      </td>
                      <td className="py-2 text-[11px] text-taupe">{r ? fmtDate(r.answered_at) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}

// ── B. Client's Map ──────────────────────────────────────────────────────────
function MapTab({ data, pdfHref }: { data: WorkspaceData; pdfHref: string | null }) {
  if (!data.result) return <p className="text-[13px] text-taupe">No results yet — the respondent hasn’t completed the self-interview.</p>;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-linen-deep/60 px-4 py-3 text-[12px] text-mahogany/80">
        <span>Frozen snapshot · scoring <span className="font-mono">{data.result.scoring_version}</span> · generated {fmtDate(data.result.generated_at)} · fingerprint <span className="font-mono">{data.result.sha256.slice(0, 12)}</span> (printed on the client’s PDF)</span>
        {pdfHref && <a className={btn} href={pdfHref} target="_blank" rel="noopener noreferrer">Open client PDF</a>}
      </div>
      <div className="mt-2 rounded-[24px] border hairline bg-linen">
        <ResultsView result={data.result.snapshot} embedded />
      </div>
    </div>
  );
}

// ── C. Coach Report ──────────────────────────────────────────────────────────
function ReportTab({ data, answers, actions }: { data: WorkspaceData; answers: Record<string, string | string[] | undefined>; actions: WorkspaceActions }) {
  const r = data.coachReport;
  const [review, setReview] = useState(r?.review_state ?? "unreviewed");
  if (!r) return <p className="text-[13px] text-taupe">The Coach Report is generated when the respondent completes the self-interview.</p>;
  const c = r.content;
  const reflection = answers["interconnections.reflection"];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <p className="rounded-[14px] bg-[#F3E9EC] px-4 py-3 text-[12px] text-burgundy">Private to coaches. Never shown in public results, the client PDF or any API the client can reach.</p>
        {typeof reflection === "string" && reflection.trim() && (
          <Card title="In their own words"><blockquote className="font-serif text-[18px] italic leading-relaxed">“{reflection}”</blockquote>
            <p className="mt-2 text-[11px] text-taupe">interconnections.reflection — not used in any calculation</p></Card>
        )}
        {c.sections.map((s) => (
          <Card key={s.key} title={s.title}>
            {s.note && <p className="mb-1 text-[11.5px] text-taupe">{s.note}</p>}
            {s.items.length ? <ul className="divide-y divide-linen-line">{s.items.map((i) => <ItemLine key={i.id} item={i} answers={answers} />)}</ul>
              : <p className="text-[12.5px] text-taupe">Nothing in the answers points here.</p>}
          </Card>
        ))}
        <Card title="Hypotheses and questions to validate">
          {c.hypotheses.length ? <ul className="divide-y divide-linen-line">{c.hypotheses.map((h) => (
            <li key={h.id} className="py-2"><ItemLine item={h} answers={answers} /><p className="text-[12.5px] text-burgundy">Ask: {h.questionToValidate}</p></li>
          ))}</ul> : <p className="text-[12.5px] text-taupe">No hypotheses meet the evidence rules.</p>}
        </Card>
      </div>
      <aside className="space-y-5">
        <Card title="Review">
          <select className={`${input} w-full`} value={review} onChange={async (e) => { const v = e.target.value as typeof review; setReview(v); await actions.setReview(r.id, v as never); }}>
            <option value="unreviewed">Unreviewed</option><option value="in_review">In review</option><option value="reviewed">Reviewed</option>
          </select>
          <p className="mt-2 text-[11px] text-taupe">Template {r.template_version} · generated {fmtDate(r.created_at)}</p>
        </Card>
        <Card title="Metric provenance">
          <table className="w-full text-[11.5px]"><thead className="text-[9.5px] uppercase tracking-[0.08em] text-taupe"><tr>
            <th className="text-left font-normal">Orbit</th><th className="text-right font-normal">Imp.</th><th className="text-right font-normal">Energy</th><th className="text-right font-normal">Support</th><th className="text-right font-normal">n</th>
          </tr></thead><tbody>
            {c.provenance.map((p) => <tr key={p.orbit} className="border-t hairline"><td className="py-1">{p.name}</td><td className="text-right">{p.importanceDirect ?? "—"}</td>
              <td className="text-right">{p.energySigned ?? "—"}</td><td className="text-right">{p.responseSupportIndex ?? "—"}</td><td className="text-right text-taupe">{p.coverage}</td></tr>)}
          </tbody></table>
          <p className="mt-2 text-[10.5px] text-taupe">Scoring {c.versions.scoring} ({c.scoringStatus}) · question bank {c.versions.questionBank}</p>
        </Card>
        <Card title="Formulas"><ul className="list-disc space-y-1 pl-4 text-[11.5px] text-mahogany/80">{c.formulas.map((f) => <li key={f}>{f}</li>)}</ul></Card>
        <Card title="Open methodology flags"><ul className="space-y-1 text-[11.5px] text-mahogany/80">{c.openFlags.map((f) => <li key={f.id}><b className="font-normal text-burgundy">{f.id}</b> {f.item}</li>)}</ul></Card>
      </aside>
    </div>
  );
}

// ── D. Personalised Deep Dive script ─────────────────────────────────────────
function ScriptTab({ data, answers, actions }: { data: WorkspaceData; answers: Record<string, string | string[] | undefined>; actions: WorkspaceActions }) {
  const [versions, setVersions] = useState<ScriptVersion[]>(data.scripts);
  const [selected, setSelected] = useState<number>(data.scripts[0]?.version ?? 0);
  const current = versions.find((v) => v.version === selected);
  const [draft, setDraft] = useState<DeepDiveScript | null>(current?.content ?? null);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const original = versions.find((v) => v.kind === "generated");
  if (!current || !draft) return <p className="text-[13px] text-taupe">The script is generated once the results snapshot exists.</p>;

  const pick = (v: number) => { setSelected(v); setDraft(versions.find((x) => x.version === v)!.content); setEditing(false); setStatus(null); };
  const updateBlock = (i: number, patch: Partial<ScriptBlock>) => setDraft((d) => d && ({ ...d, blocks: d.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  const updatePrompt = (bi: number, pi: number, text: string) =>
    updateBlock(bi, { prompts: draft.blocks[bi].prompts.map((p, j) => (j === pi ? { ...p, text } : p)) });
  const removePrompt = (bi: number, pi: number) => updateBlock(bi, { prompts: draft.blocks[bi].prompts.filter((_, j) => j !== pi) });
  const addPrompt = (bi: number) => updateBlock(bi, { prompts: [...draft.blocks[bi].prompts, { id: `coach.${Date.now()}`, text: "", evidence: [], basis: "coach" }] });
  const save = async () => {
    setStatus("Saving…");
    try {
      const v = await actions.saveScript(draft, current.booking_id);
      const nv: ScriptVersion = { id: `local-${v}`, version: v, kind: "coach_edited", booking_id: current.booking_id, content: draft, created_at: new Date().toISOString() };
      setVersions((xs) => [nv, ...xs]); setSelected(v); setEditing(false); setStatus(`Saved as version ${v}. Earlier versions are kept.`);
    } catch { setStatus("Couldn’t save. Your edits are still here — try again."); }
  };
  const total = draft.blocks.reduce((s, b) => s + (b.endMin - b.startMin), 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        {draft.blocks.map((b, bi) => (
          <Card key={b.key} title={`${b.startMin}–${b.endMin} min · ${b.title}`}
            aside={editing ? <span className="flex items-center gap-1 text-[11px] text-taupe">
              <input aria-label="Start minute" type="number" className={`${input} w-[64px]`} value={b.startMin} onChange={(e) => updateBlock(bi, { startMin: Number(e.target.value) })} />–
              <input aria-label="End minute" type="number" className={`${input} w-[64px]`} value={b.endMin} onChange={(e) => updateBlock(bi, { endMin: Number(e.target.value) })} /> min</span> : undefined}>
            <p className="text-[11.5px] text-taupe">{b.purpose}</p>
            <ul className="mt-2 divide-y divide-linen-line">
              {b.prompts.map((p, pi) => editing ? (
                <li key={p.id} className="py-2">
                  <textarea aria-label="Prompt" className={`${input} w-full`} rows={2} value={p.text} onChange={(e) => updatePrompt(bi, pi, e.target.value)} />
                  <span className="flex items-center justify-between"><Evidence item={p} answers={answers} />
                    <button className="text-[11px] text-taupe underline hover:text-burgundy" onClick={() => removePrompt(bi, pi)}>Remove</button></span>
                </li>
              ) : <ItemLine key={p.id} item={p} answers={answers} />)}
            </ul>
            {editing && <button className={`${btn} mt-2`} onClick={() => addPrompt(bi)}>Add prompt</button>}
          </Card>
        ))}
        {draft.gaps.length > 0 && (
          <Card title="Gaps to keep in mind"><ul className="divide-y divide-linen-line">{draft.gaps.map((g) => <ItemLine key={g.id} item={g} answers={answers} />)}</ul></Card>
        )}
      </div>
      <aside className="space-y-5">
        <Card title="Versions">
          <ul className="space-y-1 text-[12px]">
            {versions.map((v) => (
              <li key={v.version}><button onClick={() => pick(v.version)} className={`w-full rounded-lg px-2 py-1.5 text-left ${v.version === selected ? "bg-linen-deep text-burgundy" : "hover:bg-linen-deep/50"}`}>
                v{v.version} · {v.kind === "generated" ? "generated" : "edited by coach"}{v.booking_id ? " · with booking" : ""}
                <span className="block text-[10.5px] text-taupe">{fmtDate(v.created_at)}</span></button></li>
            ))}
          </ul>
          {original && original.version !== selected && <button className="mt-2 text-[11px] text-taupe underline" onClick={() => pick(original.version)}>View generated original (v{original.version})</button>}
        </Card>
        <Card title="Edit">
          {editing ? (
            <div className="flex flex-col gap-2">
              <p className={`text-[11.5px] ${total === 60 ? "text-taupe" : "text-burgundy"}`}>Total: {total} minutes</p>
              <button className={btnPrimary} onClick={save}>Save as new version</button>
              <button className={btn} onClick={() => { setDraft(current.content); setEditing(false); }}>Discard changes</button>
            </div>
          ) : <button className={btnPrimary} onClick={() => setEditing(true)}>Edit this version</button>}
          {status && <p role="status" className="mt-2 text-[11.5px] text-mahogany/80">{status}</p>}
          <p className="mt-3 text-[10.5px] leading-relaxed text-taupe">Every personalised prompt links to the question IDs it comes from. Hover an ID to see the exact question and answer.</p>
        </Card>
      </aside>
    </div>
  );
}

// ── E. Contact & Booking ─────────────────────────────────────────────────────
function ContactTab({ data, actions }: { data: WorkspaceData; actions: WorkspaceActions }) {
  const emails = new Set(data.clients.map((c) => c.email?.toLowerCase()).filter(Boolean));
  const [bookings, setBookings] = useState(data.bookings);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Contact details">
        {data.clients.length ? (
          <ul className="space-y-3 text-[13px]">
            {data.clients.map((c) => (
              <li key={`${c.id}-${c.link_source}`}>
                <b className="font-normal">{c.name ?? "—"}</b> · {c.email ?? "—"}{c.phone ? ` · ${c.phone}` : ""}
                <span className="block text-[11px] text-taupe">From {c.link_source.replace("_", " ")} · linked {fmtDate(c.linked_at)}{c.verified_at ? ` · verified ${fmtDate(c.verified_at)}` : ""}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-[12.5px] text-taupe">Anonymous. No contact details were provided.</p>}
        {emails.size > 1 && <p className="mt-3 rounded-lg bg-[#F6ECD9] px-3 py-2 text-[11.5px] text-[#6E4F18]">Different emails were given for the PDF and the booking. Both are kept as entered — contacts are never merged automatically.</p>}
      </Card>
      <Card title="PDF requests">
        {data.pdfRequests.length ? (
          <table className="w-full text-[12px]"><tbody>
            {data.pdfRequests.map((p) => (
              <tr key={p.id} className="border-t hairline first:border-0"><td className="py-1.5">{p.email}</td><td><Badge v={p.delivery_state} /></td>
                <td className="text-[11px] text-taupe">{fmtDate(p.requested_at)}{p.retry_count ? ` · ${p.retry_count} failed attempt(s)` : ""}</td>
                <td className="text-[11px] text-taupe">marketing: {p.marketing_consent ? "yes" : "no"}</td></tr>
            ))}
          </tbody></table>
        ) : <p className="text-[12.5px] text-taupe">No PDF requested by email.</p>}
      </Card>
      <div className="lg:col-span-2">
        <Card title="Deep Dive bookings">
          {bookings.length ? bookings.map((b) => (
            <div key={b.id} className="border-t hairline py-4 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <Badge v={b.booking_state} /><Badge v={b.payment_state} />
                <span>{fmtDate(b.scheduled_start, b.timezone)} – {b.scheduled_end ? fmtDate(b.scheduled_end, b.timezone).split(", ").pop() : ""}</span>
                <span className="text-taupe">{b.timezone}</span>
                {b.needs_reconciliation && <span className="text-[11.5px] text-[#8A6420]">⚑ {b.reconciliation_reason}</span>}
                {b.booking_state === "confirmed" && (
                  <span className="ml-auto flex gap-2">
                    <button className={btn} onClick={async () => { await actions.setBookingOutcome(b.id, "completed"); setBookings((xs) => xs.map((x) => x.id === b.id ? { ...x, booking_state: "completed" } : x)); }}>Mark completed</button>
                    <button className={btn} onClick={async () => { await actions.setBookingOutcome(b.id, "no_show"); setBookings((xs) => xs.map((x) => x.id === b.id ? { ...x, booking_state: "no_show" } : x)); }}>No-show</button>
                  </span>
                )}
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
                <dt className="text-taupe">Booked as</dt><dd>{b.booked_name} · {b.booked_email}</dd>
                <dt className="text-taupe">Meeting</dt><dd>{b.meeting_url ? <a className="underline" href={b.meeting_url} target="_blank" rel="noopener noreferrer">{b.meeting_url}</a> : "—"}</dd>
                <dt className="text-taupe">Scheduler event</dt><dd className="break-all font-mono text-[10.5px]">{b.provider} · {b.provider_event_id}</dd>
                <dt className="text-taupe">Payment reference</dt><dd className="font-mono text-[10.5px]">{b.payment_reference ?? "—"}</dd>
                {b.rescheduled_from && <><dt className="text-taupe">Rescheduled from</dt><dd className="font-mono text-[10.5px]">{shortId(b.rescheduled_from)}</dd></>}
              </dl>
              {b.intake_answers?.length ? <div className="mt-3"><p className="text-[10.5px] uppercase tracking-[0.12em] text-taupe">Booking questions</p>
                {b.intake_answers.map((q, i) => <p key={i} className="mt-1 text-[12.5px]"><span className="text-taupe">{q.question}</span><br />{q.answer}</p>)}</div> : null}
              <details className="mt-3 text-[11.5px]"><summary className="cursor-pointer text-taupe">History ({b.events.length})</summary>
                <ul className="mt-1 space-y-0.5">{b.events.map((e, i) => <li key={i}>{fmtDate(e.received_at)} · {e.event_type} · {e.processed_at ? "processed" : "pending"}{e.processing_error ? ` · ${e.processing_error}` : ""}</li>)}</ul>
              </details>
            </div>
          )) : <p className="text-[12.5px] text-taupe">No Deep Dive booked.</p>}
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Card title="Consent and privacy notice">
          {data.consents.length ? <table className="w-full text-[12px]"><tbody>{data.consents.map((c, i) => (
            <tr key={i} className="border-t hairline first:border-0"><td className="py-1.5">{c.consent_type.replace("_", " ")}</td><td><Badge v={c.status === "granted" ? "confirmed" : "cancelled"} label={c.status} /></td>
              <td className="text-taupe">notice {c.notice_version}</td><td className="text-taupe">{c.source.replace("_", " ")}</td><td className="text-[11px] text-taupe">{fmtDate(c.created_at)}</td></tr>
          ))}</tbody></table> : <p className="text-[12.5px] text-taupe">No consents recorded (anonymous, no requests).</p>}
          <p className="mt-2 text-[11px] text-taupe">Report-delivery consent is separate from marketing consent. Marketing is never set by a PDF request or a booking.</p>
        </Card>
      </div>
    </div>
  );
}

// ── F. Session notes & follow-up ─────────────────────────────────────────────
const FINDING = [["not_discussed", "Not discussed"], ["confirmed", "Confirmed"], ["partly", "Partly"], ["contradicted", "Contradicted"]] as const;

function NotesTab({ data, actions }: { data: WorkspaceData; actions: WorkspaceActions }) {
  const latest: NoteView | undefined = data.notes[0];
  const hyps = data.coachReport?.content.hypotheses ?? [];
  const [id, setId] = useState(latest?.id);
  const [notes, setNotes] = useState(latest?.notes ?? "");
  const [findings, setFindings] = useState<Record<string, string>>(latest?.validated_findings ?? {});
  const [steps, setSteps] = useState((latest?.agreed_next_steps?.steps ?? []).join("\n"));
  const [inquiry, setInquiry] = useState(latest?.agreed_next_steps?.coachingInquiry ?? false);
  const [follow, setFollow] = useState(latest?.follow_up_status ?? "none");
  const [status, setStatus] = useState<string | null>(null);
  const booking = data.bookings.filter((b) => b.booking_state !== "rescheduled").at(-1);
  const save = async () => {
    setStatus("Saving…");
    try {
      const nid = await actions.saveNote({ id, bookingId: booking?.id ?? null, notes, validatedFindings: findings,
        agreedNextSteps: { steps: steps.split("\n").map((s) => s.trim()).filter(Boolean), coachingInquiry: inquiry }, followUpStatus: follow as NoteInput["followUpStatus"] });
      setId(nid); setStatus("Saved. Notes are encrypted and visible to coaches only.");
    } catch { setStatus("Couldn’t save. Your notes are still here — try again."); }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <Card title="Session notes (coach only)">
          <textarea aria-label="Session notes" className={`${input} min-h-[220px] w-full leading-relaxed`} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="What the client said, corrected or clarified." />
        </Card>
        <Card title="Hypotheses — confirmed or contradicted in session">
          {hyps.length ? <ul className="divide-y divide-linen-line">{hyps.map((h) => (
            <li key={h.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5 text-[12.5px]">
              <span className="max-w-[560px]">{h.text}</span>
              <select aria-label="Validation" className={input} value={findings[h.id] ?? "not_discussed"} onChange={(e) => setFindings((f) => ({ ...f, [h.id]: e.target.value }))}>
                {FINDING.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </li>
          ))}</ul> : <p className="text-[12.5px] text-taupe">No hypotheses were generated for this assessment.</p>}
        </Card>
      </div>
      <aside className="space-y-5">
        <Card title="Agreed next steps">
          <textarea aria-label="Agreed next steps" className={`${input} min-h-[110px] w-full`} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="One per line" />
          <p className="mt-1 text-[10.5px] text-taupe">Only steps the client agreed to in the session.</p>
          <label className="mt-3 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={inquiry} onChange={(e) => setInquiry(e.target.checked)} /> Client asked about ongoing coaching</label>
        </Card>
        <Card title="Follow-up">
          <select aria-label="Follow-up status" className={`${input} w-full`} value={follow} onChange={(e) => setFollow(e.target.value)}>
            <option value="none">None</option><option value="planned">Planned</option><option value="sent">Sent</option><option value="done">Done</option>
          </select>
          <button className={`${btnPrimary} mt-3 w-full`} onClick={save}>Save notes</button>
          {status && <p role="status" className="mt-2 text-[11.5px] text-mahogany/80">{status}</p>}
        </Card>
        <Card title="Later assessments by this client">
          {data.relatedAssessments.length ? <ul className="space-y-1 text-[12px]">{data.relatedAssessments.map((a) => (
            <li key={a.id}><Link className="font-mono text-burgundy underline-offset-4 hover:underline" href={`/admin/assessments/${a.id}`}>{shortId(a.id)}</Link> · {fmtDate(a.created_at)} <Badge v={a.status} /></li>
          ))}</ul> : <p className="text-[12px] text-taupe">None linked.</p>}
        </Card>
      </aside>
    </div>
  );
}

// ── G. Activity & audit ──────────────────────────────────────────────────────
function ActivityTab({ data }: { data: WorkspaceData }) {
  const hooks = data.bookings.flatMap((b) => b.events.map((e) => ({ ...e, booking: b.id })));
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Audit trail">
        <table className="w-full text-[12px]"><tbody>{data.audit.map((a, i) => (
          <tr key={i} className="border-t hairline first:border-0"><td className="py-1.5 pr-3 text-[11px] text-taupe">{fmtDate(a.created_at)}</td><td className="pr-3">{a.action}</td>
            <td className="text-[11px] text-taupe">{a.actor_id ? (a.actor_id === data.viewer.userId ? "you" : shortId(a.actor_id)) : "system"}</td></tr>
        ))}</tbody></table>
        <p className="mt-2 text-[10.5px] text-taupe">Ids and states only. Answers, free text and notes are never written to logs.</p>
      </Card>
      <div className="space-y-5">
        <Card title="Webhook deliveries">
          {hooks.length ? <table className="w-full text-[12px]"><tbody>{hooks.map((h, i) => (
            <tr key={i} className="border-t hairline first:border-0"><td className="py-1.5 pr-3 text-[11px] text-taupe">{fmtDate(h.received_at)}</td><td className="pr-3">{h.event_type}</td>
              <td><Badge v={h.processed_at ? "confirmed" : "pending"} label={h.processed_at ? "processed" : "pending"} /></td><td className="text-[11px] text-burgundy">{h.processing_error}</td></tr>
          ))}</tbody></table> : <p className="text-[12.5px] text-taupe">No webhook events for this assessment.</p>}
        </Card>
        <Card title="Generated artifacts">
          <table className="w-full text-[12px]"><tbody>{data.artifacts.map((a, i) => (
            <tr key={i} className="border-t hairline first:border-0"><td className="py-1.5 pr-3">{a.artifact_type.replace(/_/g, " ")} v{a.version}</td><td><Badge v={a.generation_status} /></td>
              <td className="font-mono text-[10px] text-taupe">{a.checksum?.slice(0, 12) ?? ""}</td><td className="text-[11px] text-taupe">{fmtDate(a.created_at)}</td></tr>
          ))}</tbody></table>
        </Card>
      </div>
    </div>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  if (!open) return <button className={`${btn} hover:border-[#7A2E2E] hover:text-[#7A2E2E]`} onClick={() => setOpen(true)}>Delete…</button>;
  return (
    <span className="flex items-center gap-2 rounded-full bg-[#F3E2E2] px-3 py-1 text-[11.5px] text-[#7A2E2E]">
      Permanently delete answers, results, coach material and orphaned contacts? Type DELETE
      <input aria-label="Type DELETE to confirm" className={`${input} w-[90px]`} value={text} onChange={(e) => setText(e.target.value)} />
      <button className={btn} disabled={text !== "DELETE"} onClick={async () => { try { await onDelete(); } catch { setErr("Delete failed."); } }}>Delete</button>
      <button className="underline" onClick={() => setOpen(false)}>Cancel</button>
      {err && <span role="alert">{err}</span>}
    </span>
  );
}
