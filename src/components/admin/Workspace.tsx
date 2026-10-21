"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { WorkspaceData, NoteView, ScriptVersion, Stage } from "@/server/admin/types";
import { STAGES } from "@/server/admin/types";
import type { NoteInput } from "@/server/admin/mutations";
import type { DeepDiveScript, ScriptBlock } from "@/engine/coach/script";
import type { CoachItem } from "@/engine/coach/shared";
import { answerLabel } from "@/engine/coach/shared";
import { CHAPTERS } from "@/content/v10/chapters";
import { QUESTION_BANK, QUESTION_BANK_VERSION, questionById } from "@/content/v10/question-bank";
import { NOT_APPLICABLE } from "@/content/types";
import { ResultsView } from "@/components/ResultsView";
import { engineForTemplate, generateResultInsights } from "@/engine/insights";
import { POST_MAP_REFLECTIONS } from "@/content/v10/reflections";
import { Badge, Card, btn, btnPrimary, fmtDate, input, pastPayment, shortId } from "./ui";
import { CoachReportView } from "./CoachReportView";
import { UnderstandingTab } from "./UnderstandingTab";
import type { CoachReport } from "@/engine/coach/report";
import type { UnderstandingDocument, Validation, ValidationStatus } from "@/engine/coach/understanding";

export interface WorkspaceActions {
  saveScript(content: DeepDiveScript, bookingId: string | null): Promise<number>;
  saveNote(n: NoteInput): Promise<string>;
  setReview(reportId: string, state: "unreviewed" | "in_review" | "reviewed"): Promise<void>;
  setBookingOutcome(bookingId: string, state: "completed" | "no_show"): Promise<void>;
  deleteAssessment(): Promise<void>;
  setName(name: string | null): Promise<void>;
  /** Client profiles: create one from this Map, set the stage, add this Map to a suggested profile. */
  createProfile(name: string | null): Promise<string>;
  setStage(clientId: string, stage: Stage): Promise<void>;
  attachToProfile(clientId: string): Promise<void>;
  profileHref(clientId: string): string;
  saveReportVersion(content: CoachReport): Promise<void>;
  saveValidation(v: { insightId: string; title: string; status: ValidationStatus; note: string | null }): Promise<void>;
  generateUnderstanding(validations: Validation[]): Promise<{ version: number; content: UnderstandingDocument }>;
  saveUnderstanding(content: UnderstandingDocument): Promise<number>;
  pdfHref: string | null;
  exportHref: string | null;
  listHref: string;
}

const TABS = [
  ["answers", "A · Answers"], ["map", "B · Client’s Map"], ["report", "C · Coach Report"], ["script", "D · Session Script"],
  ["contact", "E · Contact & Booking"], ["notes", "F · Session Notes"], ["activity", "G · Activity & Audit"], ["understanding", "H · Client Understanding"],
] as const;
type Tab = (typeof TABS)[number][0];

/** Assessment detail / client workspace (addendum §3). */
export function Workspace({ data, actions }: { data: WorkspaceData; actions: WorkspaceActions }) {
  const [tab, setTab] = useState<Tab>("answers");
  const validationsRef = useRef<Record<string, { insightId: string; title: string; status: ValidationStatus; note: string | null }>>(
    Object.fromEntries((data.validations ?? []).map((v) => [v.insight_id, { insightId: v.insight_id, title: v.insight_title, status: v.status, note: v.note }])));
  const answers = useMemo(() => Object.fromEntries(data.answers.map((a) => [a.question_id, a.value ?? undefined])) as Record<string, string | string[] | undefined>, [data.answers]);
  const booking = data.bookings.filter((b) => b.booking_state !== "rescheduled").at(-1);

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-24 pt-5 sm:px-10 sm:pt-6">
      <div className="flex gap-4"><Link href={actions.listHref} className="text-[11px] uppercase tracking-[0.14em] text-taupe hover:text-burgundy">← All assessments</Link>{data.profile && <Link href={actions.profileHref(data.profile.client_id)} className="text-[11px] uppercase tracking-[0.14em] text-taupe hover:text-burgundy">Client profile</Link>}</div>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b hairline pb-5">
        <div>
          <p className="eyebrow">Assessment <span className="font-mono normal-case tracking-normal">{data.assessment.id}</span></p>
          <NameHeading id={data.assessment.id} initial={data.clients.map((c) => c.name).filter(Boolean).at(-1) ?? null} onSave={actions.setName} />
          <ProfileLine data={data} actions={actions} />
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-taupe">
            <Badge v={data.assessment.status} /> {data.assessment.status === "completed" ? `Completed ${fmtDate(data.assessment.completed_at)}` : `${data.assessment.sections_completed}/10 sections`}
            {booking && <> · Intro call <Badge v={booking.booking_state} /> {fmtDate(booking.scheduled_start, booking.timezone)} {pastPayment(booking.payment_state) && <Badge v={pastPayment(booking.payment_state)} />}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.exportHref && data.viewer.role === "admin" && <a className={btn} href={actions.exportHref}>Export data</a>}
          {data.viewer.role === "admin" && <DeleteButton onDelete={actions.deleteAssessment} />}
        </div>
      </header>

      {/* Phone: all eight sections in one picker instead of a long sideways tab strip */}
      <label className="mt-5 block sm:hidden">
        <span className="sr-only">Workspace section</span>
        <select className={`${input} w-full py-2.5 text-[16px]`} value={tab} onChange={(e) => setTab(e.target.value as Tab)}>
          {TABS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </label>
      <nav className="mt-5 hidden gap-1 overflow-x-auto border-b hairline sm:flex" role="tablist" aria-label="Workspace sections">
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
        {tab === "report" && <CoachReportView data={data} answers={answers} actions={{
          setReview: actions.setReview, saveReportVersion: actions.saveReportVersion,
          saveValidation: async (v) => { validationsRef.current = { ...validationsRef.current, [v.insightId]: v }; await actions.saveValidation(v); },
          goToUnderstanding: () => setTab("understanding"),
        }} />}
        {tab === "understanding" && <UnderstandingTab data={data} title={data.clients.map((c) => c.name).filter(Boolean).at(-1) ?? `Assessment ${shortId(data.assessment.id)}`}
          actions={{ generateUnderstanding: () => actions.generateUnderstanding(Object.values(validationsRef.current).map((v) => ({ insightId: v.insightId, title: v.title, status: v.status, note: v.note }))), saveUnderstanding: actions.saveUnderstanding }} />}
        {tab === "script" && <ScriptTab data={data} answers={answers} actions={actions} />}
        {tab === "contact" && <ContactTab data={data} actions={actions} />}
        {tab === "notes" && <NotesTab data={data} actions={actions} />}
        {tab === "activity" && <ActivityTab data={data} />}
      </div>
    </div>
  );
}

/**
 * The client profile behind this Map: stage (Prospect / Lead / Client) and a link to the profile, or a button to
 * create one. Profiles sharing an email are offered as suggestions only; nothing is joined until Jana confirms.
 */
function ProfileLine({ data, actions }: { data: WorkspaceData; actions: WorkspaceActions }) {
  const [profile, setProfile] = useState(data.profile ?? null);
  const [added, setAdded] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(null); try { await fn(); } catch { setErr("Couldn’t save. Please try again."); } finally { setBusy(false); } };
  const suggestions = (data.possibleProfiles ?? []).filter((p) => !added.includes(p.client_id));
  return (
    <div className="mt-2 space-y-2 text-[12.5px]">
      {profile ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-taupe">Client profile</span>
          <div role="radiogroup" aria-label="Stage" className="inline-flex overflow-hidden rounded-full border border-linen-line">
            {STAGES.map((st) => (
              <button key={st.value} role="radio" aria-checked={profile.stage === st.value} title={st.hint} disabled={busy}
                onClick={() => run(async () => { await actions.setStage(profile.client_id, st.value); setProfile({ ...profile, stage: st.value }); })}
                className={`px-3 py-1 text-[11.5px] transition ${profile.stage === st.value ? "bg-burgundy text-linen" : "text-mahogany/75 hover:text-burgundy"}`}>{st.label}</button>
            ))}
          </div>
          <Link href={actions.profileHref(profile.client_id)} className="text-[11px] uppercase tracking-[0.12em] text-burgundy underline-offset-4 hover:underline">Open profile →</Link>
        </div>
      ) : (
        <button className={btn} disabled={busy} onClick={() => run(async () => {
          const id = await actions.createProfile(data.clients.map((c) => c.name).filter(Boolean).at(-1) ?? null);
          setProfile({ client_id: id, name: null, stage: "prospect" });
        })}>Create client profile</button>
      )}
      {suggestions.map((p) => (
        <p key={p.client_id} className="flex flex-wrap items-center gap-2 rounded-[12px] bg-[#F6ECD9] px-3 py-2 text-[12px] text-[#6E4F18]">
          Possible match: <b className="font-normal text-mahogany">{p.name ?? p.email}</b> ({STAGES.find((s) => s.value === p.stage)?.label}) has a profile with the same email.
          <button className="underline underline-offset-4 hover:text-burgundy" disabled={busy}
            onClick={() => run(async () => { await actions.attachToProfile(p.client_id); setAdded((a) => [...a, p.client_id]); setProfile({ client_id: p.client_id, name: p.name, stage: p.stage }); })}>
            Add this Map to their profile</button>
        </p>
      ))}
      {err && <p role="alert" className="text-[12px] text-burgundy">{err}</p>}
    </div>
  );
}

/** Name only when the person shared it or a coach added it; otherwise the assessment ID (never the email). */
function NameHeading({ id, initial, onSave }: { id: string; initial: string | null; onSave: (n: string | null) => Promise<void> }) {
  const [name, setName] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial ?? "");
  const [err, setErr] = useState(false);
  if (editing)
    return (
      <form className="mt-2 flex items-center gap-2" onSubmit={async (e) => {
        e.preventDefault(); setErr(false);
        try { await onSave(draft.trim() || null); setName(draft.trim() || null); setEditing(false); } catch { setErr(true); }
      }}>
        <input autoFocus aria-label="Name" className={`${input} w-[320px] font-serif text-[22px]`} value={draft} maxLength={120} onChange={(e) => setDraft(e.target.value)} placeholder="Name" />
        <button className={btnPrimary} type="submit">Save</button>
        <button className={btn} type="button" onClick={() => { setDraft(name ?? ""); setEditing(false); }}>Cancel</button>
        {err && <span role="alert" className="text-[12px] text-burgundy">Couldn’t save.</span>}
      </form>
    );
  return (
    <div className="mt-2 flex items-baseline gap-3">
      <h1 className="font-serif text-[34px] font-light leading-tight">{name ?? <>Assessment <span className="font-mono text-[28px]">{shortId(id)}</span></>}</h1>
      <button className="text-[11px] uppercase tracking-[0.12em] text-taupe underline-offset-4 hover:text-burgundy hover:underline" onClick={() => setEditing(true)}>{name ? "Edit name" : "Add name"}</button>
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
                <th className="hidden w-[110px] pb-2 text-left font-normal sm:table-cell">ID</th><th className="pb-2 text-left font-normal">Question · Explore · cue</th>
                <th className="w-[38%] pb-2 text-left font-normal sm:w-[230px]">Response</th><th className="hidden w-[130px] pb-2 text-left font-normal sm:table-cell">Answered</th>
              </tr></thead>
              <tbody>
                {qs.map((q) => {
                  const r = rows[q.id], v = answers[q.id];
                  return (
                    <tr key={q.id} className="border-t hairline align-top">
                      <td className="hidden py-2 pr-2 font-mono text-[10.5px] text-taupe sm:table-cell">{q.id}{q.reverseKeyed && <span className="block text-[9.5px] text-[#8A6420]">reverse-keyed</span>}</td>
                      <td className="py-2 pr-3 sm:pr-4">
                        <span className="mb-0.5 block font-mono text-[10px] text-taupe sm:hidden">{q.id}{q.reverseKeyed ? " · reverse-keyed" : ""}</span>
                        {q.prompt}
                        <span className="block text-[11px] text-taupe">{q.exploreCategory}{q.cue?.text ? ` · ${q.cue.text}` : ""}</span>
                      </td>
                      <td className="py-2 pr-2">
                        {r?.response_status === "not_applicable" || v === NOT_APPLICABLE ? <Badge v="not_applicable" label="N/A · excluded" />
                          : v === undefined ? <span className="text-taupe">{q.optional ? "Skipped (optional)" : "Not answered"}</span>
                          : q.responseType === "text" ? <q className="italic">{String(v)}</q>
                          : answerLabel(q.id, v)}
                        {r?.raw_ordinal != null && <span className="ml-1 text-[10.5px] text-taupe">({r.raw_ordinal})</span>}
                        {r && <span className="mt-0.5 block text-[10.5px] text-taupe sm:hidden">{fmtDate(r.answered_at)}</span>}
                      </td>
                      <td className="hidden py-2 text-[11px] text-taupe sm:table-cell">{r ? fmtDate(r.answered_at) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        );
      })}
      <PostMapCard answers={answers} rows={rows} />
    </div>
  );
}

function PostMapCard({ answers, rows }: { answers: Record<string, string | string[] | undefined>; rows?: Record<string, { answered_at: string }> }) {
  const any = POST_MAP_REFLECTIONS.questions.some((q) => typeof answers[q.id] === "string");
  return (
    <Card title="Optional reflections (after the Map)">
      {any ? (
        <ul className="divide-y divide-linen-line">
          {POST_MAP_REFLECTIONS.questions.map((q) => (
            <li key={q.id} className="py-2.5 text-[12.5px]">
              <span className="block text-taupe">{q.prompt}</span>
              {typeof answers[q.id] === "string" ? <q className="mt-1 block font-serif text-[16px] italic text-mahogany">{answers[q.id]}</q> : <span className="text-taupe/70">Not answered</span>}
              {rows?.[q.id] && <span className="block text-[10.5px] text-taupe">{fmtDate(rows[q.id].answered_at)}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="text-[12.5px] text-taupe">None written. They are optional and don’t affect the Map.</p>}
    </Card>
  );
}

// ── B. Client's Map ──────────────────────────────────────────────────────────
function MapTab({ data, pdfHref }: { data: WorkspaceData; pdfHref: string | null }) {
  if (!data.result) return <p className="text-[13px] text-taupe">No results yet — the respondent hasn’t completed the Self-Interview.</p>;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-linen-deep/60 px-4 py-3 text-[12px] text-mahogany/80">
        <span>Frozen snapshot · scoring <span className="font-mono">{data.result.scoring_version}</span> · generated {fmtDate(data.result.generated_at)} · fingerprint <span className="font-mono">{data.result.sha256.slice(0, 12)}</span> (printed on the client’s PDF)</span>
        {pdfHref && <a className={btn} href={pdfHref} target="_blank" rel="noopener noreferrer">Open client PDF</a>}
      </div>
      <p className="mt-3 font-serif text-[17px] italic text-mahogany/80">Public Current Life Map: “Here’s what your answers reveal about the life you’re living.” Exactly what they read.</p>
      <div className="mt-2 rounded-[24px] border hairline bg-linen">
        <ResultsView result={data.result.snapshot} insights={generateResultInsights(data.result.snapshot, Object.fromEntries(data.answers.map((a) => [a.question_id, a.value ?? undefined])), { engine: engineForTemplate(data.result.narrative_version) })} embedded />
      </div>
    </div>
  );
}

// ── D. Personalised session script ─────────────────────────────────────────
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
          <div className="overflow-x-auto"><table className="w-full text-[12px]"><tbody>
            {data.pdfRequests.map((p) => (
              <tr key={p.id} className="border-t hairline first:border-0"><td className="py-1.5">{p.email}</td><td><Badge v={p.delivery_state} /></td>
                <td className="text-[11px] text-taupe">{fmtDate(p.requested_at)}{p.retry_count ? ` · ${p.retry_count} failed attempt(s)` : ""}</td>
                <td className="text-[11px] text-taupe">marketing: {p.marketing_consent ? "yes" : "no"}</td></tr>
            ))}
          </tbody></table></div>
        ) : <p className="text-[12.5px] text-taupe">No PDF requested by email.</p>}
      </Card>
      <div className="lg:col-span-2">
        <Card title="Introductory conversations">
          {bookings.length ? bookings.map((b) => (
            <div key={b.id} className="border-t hairline py-4 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <Badge v={b.booking_state} />{pastPayment(b.payment_state) && <Badge v={pastPayment(b.payment_state)} />}
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
                {b.payment_reference && <><dt className="text-taupe">Payment reference (earlier Deep Dive)</dt><dd className="font-mono text-[10.5px]">{b.payment_reference}</dd></>}
                {b.rescheduled_from && <><dt className="text-taupe">Rescheduled from</dt><dd className="font-mono text-[10.5px]">{shortId(b.rescheduled_from)}</dd></>}
              </dl>
              {b.intake_answers?.length ? <div className="mt-3"><p className="text-[10.5px] uppercase tracking-[0.12em] text-taupe">Booking questions</p>
                {b.intake_answers.map((q, i) => <p key={i} className="mt-1 text-[12.5px]"><span className="text-taupe">{q.question}</span><br />{q.answer}</p>)}</div> : null}
              <details className="mt-3 text-[11.5px]"><summary className="cursor-pointer text-taupe">History ({b.events.length})</summary>
                <ul className="mt-1 space-y-0.5">{b.events.map((e, i) => <li key={i}>{fmtDate(e.received_at)} · {e.event_type} · {e.processed_at ? "processed" : "pending"}{e.processing_error ? ` · ${e.processing_error}` : ""}</li>)}</ul>
              </details>
            </div>
          )) : <p className="text-[12.5px] text-taupe">No introductory conversation booked.</p>}
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Card title="Consent and privacy notice">
          {data.consents.length ? <div className="overflow-x-auto"><table className="w-full text-[12px]"><tbody>{data.consents.map((c, i) => (
            <tr key={i} className="border-t hairline first:border-0"><td className="py-1.5">{c.consent_type.replace("_", " ")}</td><td><Badge v={c.status === "granted" ? "confirmed" : "cancelled"} label={c.status} /></td>
              <td className="text-taupe">notice {c.notice_version}</td><td className="text-taupe">{c.source.replace("_", " ")}</td><td className="text-[11px] text-taupe">{fmtDate(c.created_at)}</td></tr>
          ))}</tbody></table></div> : <p className="text-[12.5px] text-taupe">No consents recorded (anonymous, no requests).</p>}
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
        <Card title="Interpretations from the session">
          <p className="text-[12.5px] leading-relaxed">Mark which interpretations they confirmed, clarified or challenged directly under each one in the Coach Report (tab C). Those marks, with the agreed next steps here, build the Client Understanding & Coaching Direction (tab H).</p>
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
        <div className="overflow-x-auto"><table className="w-full text-[12px]"><tbody>{data.audit.map((a, i) => (
          <tr key={i} className="border-t hairline first:border-0"><td className="py-1.5 pr-3 text-[11px] text-taupe">{fmtDate(a.created_at)}</td><td className="pr-3">{a.action}</td>
            <td className="text-[11px] text-taupe">{a.actor_id ? (a.actor_id === data.viewer.userId ? "you" : shortId(a.actor_id)) : "system"}</td></tr>
        ))}</tbody></table></div>
        <p className="mt-2 text-[10.5px] text-taupe">Ids and states only. Answers, free text and notes are never written to logs.</p>
      </Card>
      <div className="space-y-5">
        <Card title="Webhook deliveries">
          {hooks.length ? <div className="overflow-x-auto"><table className="w-full text-[12px]"><tbody>{hooks.map((h, i) => (
            <tr key={i} className="border-t hairline first:border-0"><td className="py-1.5 pr-3 text-[11px] text-taupe">{fmtDate(h.received_at)}</td><td className="pr-3">{h.event_type}</td>
              <td><Badge v={h.processed_at ? "confirmed" : "pending"} label={h.processed_at ? "processed" : "pending"} /></td><td className="text-[11px] text-burgundy">{h.processing_error}</td></tr>
          ))}</tbody></table></div> : <p className="text-[12.5px] text-taupe">No webhook events for this assessment.</p>}
        </Card>
        <Card title="Generated artifacts">
          <div className="overflow-x-auto"><table className="w-full text-[12px]"><tbody>{data.artifacts.map((a, i) => (
            <tr key={i} className="border-t hairline first:border-0"><td className="py-1.5 pr-3">{a.artifact_type.replace(/_/g, " ")} v{a.version}</td><td><Badge v={a.generation_status} /></td>
              <td className="font-mono text-[10px] text-taupe">{a.checksum?.slice(0, 12) ?? ""}</td><td className="text-[11px] text-taupe">{fmtDate(a.created_at)}</td></tr>
          ))}</tbody></table></div>
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
