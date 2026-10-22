"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AttachmentView, ClientMap, ClientNoteView, ClientProfileData, SearchHit, SessionInput, SessionView, Stage } from "@/server/admin/types";
import { STAGES } from "@/server/admin/types";
import { ORBIT_TINT } from "@/components/map-geometry";
import { ENERGY_SHORT, IMPORTANCE_SHORT } from "@/lib/pdf/model";
import { Badge, Card, btn, btnPrimary, fmtDate, input, shortId } from "./ui";

export interface ProfileActions {
  setStage(stage: Stage, since: string | null): Promise<void>;
  saveDetails(d: { name: string | null; email: string | null; phone: string | null }): Promise<void>;
  createInvite(): Promise<string>;
  revokeInvite(): Promise<void>;
  attach(assessmentId: string): Promise<void>;
  detach(assessmentId: string): Promise<void>;
  search(q: string): Promise<SearchHit[]>;
  saveSession(s: SessionInput): Promise<string>;
  deleteSession(id: string): Promise<void>;
  saveNote(n: { id?: string; body: string }): Promise<string>;
  deleteNote(id: string): Promise<void>;
  upload(file: File, purpose: AttachmentView["purpose"], ids: { sessionId?: string; noteId?: string }): Promise<AttachmentView>;
  deleteAttachment(id: string): Promise<void>;
  attachmentHref(id: string): string;
  workspaceHref(assessmentId: string): string;
  inviteUrl(token: string): string;
  listHref: string;
  /** Reload after changes the page can't patch locally (e.g. a Map attached). */
  refresh(): void;
  /** Admin only: delete the whole profile (notes, sessions, files). Their Self-Interviews are kept. */
  deleteProfile(): Promise<void>;
}

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.heic,.txt,.csv,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp3,.m4a";
const KIND_LABEL: Record<SessionView["kind"], string> = { deep_dive: "Life Map Deep Dive", coaching: "Coaching session", review: "Review", other: "Other" };
const SOURCE_LABEL: Record<string, string> = { client_invite: "private link", coach_manual: "added by you", pdf_request: "PDF request", booking: "booking" };
const today = () => new Date().toISOString().slice(0, 10);
const day = (s: string | null) => (s ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(s.length === 10 ? `${s}T12:00:00` : s)) : "—");
const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Private client profile: stage, every Map, sessions (planning, notes, homework), person notes and files. */
export function ClientProfile({ data, actions }: { data: ClientProfileData; actions: ProfileActions }) {
  const c = data.client;
  const [stage, setStageState] = useState<Stage>(c.stage);
  const [since, setSince] = useState<string | null>(c.coaching_enrolled_at);
  const [err, setErr] = useState<string | null>(null);
  const guard = async (fn: () => Promise<void>) => { setErr(null); try { await fn(); } catch { setErr("Couldn’t save. Please try again."); } };

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-24 pt-5 sm:px-10 sm:pt-6">
      <Link href={actions.listHref} className="text-[11px] uppercase tracking-[0.14em] text-taupe hover:text-burgundy">← All clients</Link>
      <header className="mt-4 border-b hairline pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="eyebrow">Client profile <span className="font-mono normal-case tracking-normal">{shortId(c.id)}</span> · private to coaches</p>
          {data.viewer.role === "admin" && <DeleteProfile onDelete={actions.deleteProfile} />}
        </div>
        <Details client={c} onSave={(d) => guard(() => actions.saveDetails(d))} />
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px]">
          <div role="radiogroup" aria-label="Stage" className="inline-flex overflow-hidden rounded-full border border-linen-line">
            {STAGES.map((st) => (
              <button key={st.value} role="radio" aria-checked={stage === st.value} title={st.hint}
                onClick={() => guard(async () => { const s2 = st.value === "client" ? since ?? today() : null; await actions.setStage(st.value, s2); setStageState(st.value); setSince(s2); if (st.value === "client") actions.refresh(); })}
                className={`px-3.5 py-1.5 text-[11.5px] transition ${stage === st.value ? "bg-burgundy text-linen" : "text-mahogany/75 hover:text-burgundy"}`}>{st.label}</button>
            ))}
          </div>
          {stage !== "client" && <span className="text-taupe">{STAGES.find((s) => s.value === stage)?.hint}{c.stage_changed_at ? ` · since ${day(c.stage_changed_at)}` : ""}</span>}
          {stage === "client" && (
            <label className="flex items-center gap-2 text-taupe">On 1:1 coaching since
              <input type="date" className={`${input} py-1`} value={since ?? ""} onChange={(e) => guard(async () => { const v = e.target.value || null; await actions.setStage("client", v); setSince(v); })} />
            </label>
          )}
          {err && <span role="alert" className="text-burgundy">{err}</span>}
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <MapsCard maps={data.maps} actions={actions} />
          {data.possibleMatches.length > 0 && <MatchesCard matches={data.possibleMatches} actions={actions} />}
          <SessionsCard initial={data.sessions} maps={data.maps} actions={actions} />
        </div>
        <aside className="space-y-6">
          <InviteCard stage={stage} invite={c.invite} actions={actions} />
          <NotesCard initial={data.notes} actions={actions} />
          <Card title="Files about this person">
            <FileList initial={data.attachments} purpose="profile" ids={{}} actions={actions} />
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Details({ client, onSave }: { client: ClientProfileData["client"]; onSave: (d: { name: string | null; email: string | null; phone: string | null }) => Promise<void> }) {
  const [d, setD] = useState({ name: client.name ?? "", email: client.email ?? "", phone: client.phone ?? "" });
  const [shown, setShown] = useState(d);
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={async (e) => { e.preventDefault(); await onSave({ name: d.name.trim() || null, email: d.email.trim() || null, phone: d.phone.trim() || null }); setShown(d); setEditing(false); }}>
        <input aria-label="Name" className={`${input} w-[240px] font-serif text-[20px]`} value={d.name} maxLength={120} placeholder="Name" onChange={(e) => setD({ ...d, name: e.target.value })} />
        <input aria-label="Email" type="email" className={`${input} w-[240px]`} value={d.email} maxLength={254} placeholder="Email" onChange={(e) => setD({ ...d, email: e.target.value })} />
        <input aria-label="Phone" className={`${input} w-[160px]`} value={d.phone} maxLength={40} placeholder="Phone" onChange={(e) => setD({ ...d, phone: e.target.value })} />
        <button className={btnPrimary} type="submit">Save</button>
        <button className={btn} type="button" onClick={() => { setD(shown); setEditing(false); }}>Cancel</button>
      </form>
    );
  return (
    <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 className="font-serif text-[34px] font-light leading-tight">{shown.name || <>Client <span className="font-mono text-[28px]">{shortId(client.id)}</span></>}</h1>
      <span className="text-[12.5px] text-mahogany/75">{[shown.email, shown.phone].filter(Boolean).join(" · ") || "No contact details"}</span>
      <button className="text-[11px] uppercase tracking-[0.12em] text-taupe underline-offset-4 hover:text-burgundy hover:underline" onClick={() => setEditing(true)}>Edit details</button>
    </div>
  );
}

// ── Maps ─────────────────────────────────────────────────────────────────────
function MapsCard({ maps, actions }: { maps: ClientMap[]; actions: ProfileActions }) {
  const done = maps.filter((m) => m.orbits);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const mine = new Set(maps.map((m) => m.assessment_id));
  return (
    <Card title={`Current Life Maps · ${maps.length}`}>
      {maps.length === 0 ? <p className="text-[12.5px] text-taupe">No Maps on this profile yet.</p> : (
        <ol className="space-y-1.5 text-[12.5px]">
          {maps.map((m, i) => (
            <li key={m.assessment_id} className="flex flex-wrap items-center gap-2">
              <span className="w-6 text-taupe">{i + 1}.</span>
              <Link className="font-mono text-burgundy underline-offset-4 hover:underline" href={actions.workspaceHref(m.assessment_id)}>{shortId(m.assessment_id)}</Link>
              <span>{day(m.completed_at ?? m.created_at)}</span>
              <Badge v={m.status} />
              <span className="text-taupe">via {m.link_sources.map((s) => SOURCE_LABEL[s] ?? s).join(", ")}</span>
              {m.link_sources.some((s) => s === "coach_manual" || s === "client_invite") && (
                <button className="ml-auto text-[11px] text-taupe underline-offset-4 hover:text-burgundy hover:underline" onClick={async () => { if (confirm("Remove this Map from the profile? The Map itself is kept.")) { await actions.detach(m.assessment_id); actions.refresh(); } }}>Remove from profile</button>
              )}
            </li>
          ))}
        </ol>
      )}
      {done.length > 0 && <MapCompare maps={done} />}
      <form className="mt-5 flex flex-wrap items-center gap-2 border-t hairline pt-4" onSubmit={async (e) => { e.preventDefault(); setMsg(null); setHits(q.trim().length >= 2 ? await actions.search(q) : []); }}>
        <label htmlFor="map-search" className="text-[12px] text-taupe">Add a Map</label>
        <input id="map-search" className={`${input} min-w-[220px] flex-1`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or assessment ID" />
        <button className={btn} type="submit">Search</button>
      </form>
      {hits && (
        <ul className="mt-2 space-y-1 text-[12.5px]">
          {hits.length === 0 && <li className="text-taupe">Nothing found.</li>}
          {hits.map((h) => (
            <li key={h.assessment_id} className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{shortId(h.assessment_id)}</span><span>{day(h.created_at)}</span><Badge v={h.status} />
              <span className="text-taupe">{[h.client_name, h.client_email].filter(Boolean).join(" · ") || "anonymous"}</span>
              {mine.has(h.assessment_id) ? <span className="ml-auto text-taupe">on this profile</span> : (
                <button className={`${btn} ml-auto`} onClick={async () => { await actions.attach(h.assessment_id); setMsg("Added to the profile."); actions.refresh(); }}>Add to profile</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {msg && <p role="status" className="mt-2 text-[12px] text-mahogany">{msg}</p>}
      <p className="mt-3 text-[10.5px] text-taupe">Maps completed through this person’s private link are added automatically. Nothing is matched by email without your confirmation.</p>
    </Card>
  );
}

/** Side-by-side: size (importance), energy and brightness (support) for each Map, oldest first. */
function MapCompare({ maps }: { maps: ClientMap[] }) {
  const orbits = maps[0].orbits!;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-[11.5px]">
        <thead className="text-[10px] uppercase tracking-[0.12em] text-taupe">
          <tr><th className="py-1.5 pr-3 font-normal">Orbit</th>{maps.map((m, i) => <th key={m.assessment_id} className="py-1.5 pr-3 font-normal">Map {i + 1} · {day(m.completed_at ?? m.created_at)}</th>)}</tr>
        </thead>
        <tbody>
          {orbits.map((o) => (
            <tr key={o.orbit} className="border-t hairline align-top">
              <th scope="row" className="py-1.5 pr-3 font-normal"><span className="flex items-center gap-1.5 whitespace-nowrap font-serif text-[13px]"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: ORBIT_TINT[o.orbit as keyof typeof ORBIT_TINT] }} />{o.name}</span></th>
              {maps.map((m) => {
                const x = m.orbits!.find((y) => y.orbit === o.orbit)!;
                const s = x.responseSupportIndex;
                return (
                  <td key={m.assessment_id} className="py-1.5 pr-3">
                    <span className="flex items-center gap-1.5">
                      <span aria-label={s === null ? "support not available" : `support ${Math.round(s * 100)} of 100`} title="Brightness (support)" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ORBIT_TINT[o.orbit as keyof typeof ORBIT_TINT], opacity: s === null ? 0.12 : 0.15 + 0.85 * s }} />
                      {x.importanceOrdinal ? IMPORTANCE_SHORT[x.importanceOrdinal - 1] : "—"}
                    </span>
                    <span className="text-taupe">{x.energyRaw ? ENERGY_SHORT[x.energyRaw] : "—"}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10.5px] text-taupe">Dot = brightness (support in their answers). Then importance and energy as they answered.</p>
    </div>
  );
}

function MatchesCard({ matches, actions }: { matches: ClientProfileData["possibleMatches"]; actions: ProfileActions }) {
  const [done, setDone] = useState<string[]>([]);
  return (
    <section className="rounded-[18px] border border-[#E7D3AE] bg-[#FBF4E6] p-5">
      <h3 className="text-[10.5px] uppercase tracking-[0.16em] text-[#6E4F18]">Possible Maps for this person</h3>
      <p className="mt-1 text-[12px] text-[#6E4F18]">Other records use the same email. Add a Map only if you’re sure it’s theirs.</p>
      <ul className="mt-3 space-y-1.5 text-[12.5px]">
        {matches.flatMap((m) => m.assessments.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{shortId(a.id)}</span><span>{day(a.created_at)}</span><Badge v={a.status} /><span className="text-taupe">{m.name ?? m.email}</span>
            {done.includes(a.id) ? <span className="ml-auto text-mahogany">Added</span> :
              <button className={`${btn} ml-auto`} onClick={async () => { await actions.attach(a.id); setDone((d) => [...d, a.id]); actions.refresh(); }}>Add to profile</button>}
          </li>
        )))}
      </ul>
    </section>
  );
}

// ── Private link ─────────────────────────────────────────────────────────────
function InviteCard({ stage, invite, actions }: { stage: Stage; invite: ClientProfileData["client"]["invite"]; actions: ProfileActions }) {
  const [token, setToken] = useState<string | null>(invite?.token ?? null);
  const [copied, setCopied] = useState(false);
  useEffect(() => setToken(invite?.token ?? null), [invite?.token]);
  const url = token ? actions.inviteUrl(token) : null;
  return (
    <Card title="Private Self-Interview link">
      {url ? (
        <>
          <p className="break-all rounded-lg bg-linen-deep px-3 py-2 font-mono text-[11px]">{url}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={btnPrimary} onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ } }}>{copied ? "Copied" : "Copy link"}</button>
            <button className={btn} onClick={async () => { if (confirm("Create a new link? The current one will stop working.")) setToken(await actions.createInvite()); }}>New link</button>
            <button className={btn} onClick={async () => { if (confirm("Turn the link off?")) { await actions.revokeInvite(); setToken(null); } }}>Turn off</button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-taupe">Send this to them for the 3-month (or any) follow-up. Maps completed through it go straight onto this profile. The link carries no personal details.</p>
        </>
      ) : (
        <>
          <p className="text-[12.5px] text-mahogany/80">{stage === "client" ? "No active link." : "Created automatically when you mark someone as a Client."}</p>
          <button className={`${btn} mt-3`} onClick={async () => setToken(await actions.createInvite())}>Create link now</button>
        </>
      )}
    </Card>
  );
}

// ── Sessions ─────────────────────────────────────────────────────────────────
const emptySession = (): SessionInput => ({ session_date: today(), title: "", kind: "coaching", assessment_id: null, plan: "", notes: "", homework: "" });

function SessionsCard({ initial, maps, actions }: { initial: SessionView[]; maps: ClientMap[]; actions: ProfileActions }) {
  const [sessions, setSessions] = useState(initial);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const sorted = useMemo(() => [...sessions].sort((a, b) => (b.session_date ?? "9999").localeCompare(a.session_date ?? "9999") || b.created_at.localeCompare(a.created_at)), [sessions]);
  return (
    <Card title={`Sessions · ${sessions.length}`} aside={editing !== "new" && <button className={btnPrimary} onClick={() => setEditing("new")}>New session</button>}>
      {editing === "new" && (
        <SessionForm initial={emptySession()} maps={maps} onCancel={() => setEditing(null)} onSave={async (s) => {
          const id = await actions.saveSession(s);
          const now = new Date().toISOString();
          setSessions((xs) => [{ ...s, id, title: s.title || null, created_at: now, updated_at: now, attachments: [] } as SessionView, ...xs]);
          setEditing(id);
        }} />
      )}
      {sessions.length === 0 && editing !== "new" && <p className="text-[12.5px] text-taupe">No sessions yet. Add one to plan it, take notes and set homework.</p>}
      <div className="space-y-3">
        {sorted.map((s) => editing === s.id ? (
          <div key={s.id} className="rounded-[14px] border hairline p-4">
            <SessionForm initial={s} maps={maps} onCancel={() => setEditing(null)} onSave={async (x) => {
              await actions.saveSession({ ...x, id: s.id });
              setSessions((xs) => xs.map((y) => (y.id === s.id ? { ...y, ...x, title: x.title || null, updated_at: new Date().toISOString() } : y)));
              setEditing(null);
            }} />
            <div className="mt-4 grid gap-4 border-t hairline pt-4 sm:grid-cols-3">
              {(["session_plan", "session_notes", "homework"] as const).map((p) => (
                <div key={p}><p className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-taupe">{p === "session_plan" ? "Plan files" : p === "session_notes" ? "Notes files" : "Homework files"}</p>
                  <FileList initial={s.attachments.filter((a) => a.purpose === p)} purpose={p} ids={{ sessionId: s.id }} actions={actions}
                    onChange={(list) => setSessions((xs) => xs.map((y) => (y.id === s.id ? { ...y, attachments: [...y.attachments.filter((a) => a.purpose !== p), ...list] } : y)))} /></div>
              ))}
            </div>
          </div>
        ) : (
          <SessionSummary key={s.id} s={s} maps={maps} actions={actions} onEdit={() => setEditing(s.id)}
            onDelete={async () => { if (confirm("Delete this session, its notes and files?")) { await actions.deleteSession(s.id); setSessions((xs) => xs.filter((y) => y.id !== s.id)); } }} />
        ))}
      </div>
    </Card>
  );
}

function SessionSummary({ s, maps, actions, onEdit, onDelete }: { s: SessionView; maps: ClientMap[]; actions: ProfileActions; onEdit: () => void; onDelete: () => void }) {
  const mapNo = s.assessment_id ? maps.findIndex((m) => m.assessment_id === s.assessment_id) + 1 : 0;
  const block = (label: string, text: string, files: AttachmentView[]) => (text || files.length) ? (
    <div><p className="text-[10.5px] uppercase tracking-[0.14em] text-taupe">{label}</p>
      {text && <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed">{text}</p>}
      {files.length > 0 && <ul className="mt-1 space-y-0.5">{files.map((f) => <li key={f.id}><a className="text-[12px] text-burgundy underline-offset-4 hover:underline" href={actions.attachmentHref(f.id)}>{f.filename}</a> <span className="text-[10.5px] text-taupe">{kb(f.size_bytes)}</span></li>)}</ul>}
    </div>) : null;
  return (
    <details className="group rounded-[14px] border hairline p-4" open={false}>
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-serif text-[18px]">{day(s.session_date)}</span>
        <span className="text-[12px] text-mahogany/80">{KIND_LABEL[s.kind]}{s.title ? ` · ${s.title}` : ""}</span>
        {mapNo > 0 && <span className="text-[11px] text-taupe">Map {mapNo}</span>}
        <span className="ml-auto text-[10.5px] text-taupe">Created {fmtDate(s.created_at)}</span>
      </summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {block("Session plan", s.plan, s.attachments.filter((a) => a.purpose === "session_plan"))}
        {block("Notes", s.notes, s.attachments.filter((a) => a.purpose === "session_notes"))}
        {block("Exercises & homework", s.homework, s.attachments.filter((a) => a.purpose === "homework"))}
      </div>
      {!s.plan && !s.notes && !s.homework && !s.attachments.length && <p className="mt-2 text-[12px] text-taupe">Nothing written yet.</p>}
      <div className="mt-3 flex gap-2"><button className={btn} onClick={onEdit}>Edit · files</button><button className={btn} onClick={onDelete}>Delete</button></div>
    </details>
  );
}

function SessionForm({ initial, maps, onSave, onCancel }: { initial: SessionInput; maps: ClientMap[]; onSave: (s: SessionInput) => Promise<void>; onCancel: () => void }) {
  const [s, setS] = useState<SessionInput>({ session_date: initial.session_date, title: initial.title ?? "", kind: initial.kind, assessment_id: initial.assessment_id, plan: initial.plan, notes: initial.notes, homework: initial.homework });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const area = (k: "plan" | "notes" | "homework", label: string, ph: string) => (
    <label className="block"><span className="text-[10.5px] uppercase tracking-[0.14em] text-taupe">{label}</span>
      <textarea className={`${input} mt-1 min-h-[120px] w-full`} value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} placeholder={ph} /></label>
  );
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(false); try { await onSave(s); } catch { setErr(true); } finally { setBusy(false); } }}>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Session date" type="date" className={input} value={s.session_date ?? ""} onChange={(e) => setS({ ...s, session_date: e.target.value || null })} />
        <select aria-label="Session type" className={input} value={s.kind} onChange={(e) => setS({ ...s, kind: e.target.value as SessionInput["kind"] })}>
          {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input aria-label="Title" className={`${input} min-w-[200px] flex-1`} value={s.title ?? ""} maxLength={160} onChange={(e) => setS({ ...s, title: e.target.value })} placeholder="Title (optional)" />
        <select aria-label="Map discussed" className={input} value={s.assessment_id ?? ""} onChange={(e) => setS({ ...s, assessment_id: e.target.value || null })}>
          <option value="">No Map linked</option>
          {maps.map((m, i) => <option key={m.assessment_id} value={m.assessment_id}>Map {i + 1} · {day(m.completed_at ?? m.created_at)}</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {area("plan", "Session plan", "What you want to explore, questions, exercises to try")}
        {area("notes", "Notes", "What came up in the session")}
        {area("homework", "Exercises & homework", "What they’ll practise before next time")}
      </div>
      <div className="flex items-center gap-2">
        <button className={btnPrimary} disabled={busy} type="submit">{busy ? "Saving…" : "Save session"}</button>
        <button className={btn} type="button" onClick={onCancel}>Close</button>
        {err && <span role="alert" className="text-[12px] text-burgundy">Couldn’t save.</span>}
        <span className="ml-auto text-[10.5px] text-taupe">Encrypted. Files can be added once the session is saved.</span>
      </div>
    </form>
  );
}

// ── Person notes and files ──────────────────────────────────────────────────
function NotesCard({ initial, actions }: { initial: ClientNoteView[]; actions: ProfileActions }) {
  const [notes, setNotes] = useState(initial);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  return (
    <Card title="Notes about this person">
      <form onSubmit={async (e) => { e.preventDefault(); if (!draft.trim()) return; const id = await actions.saveNote({ body: draft }); const now = new Date().toISOString(); setNotes((n) => [{ id, body: draft.trim(), created_at: now, updated_at: now, attachments: [] }, ...n]); setDraft(""); }}>
        <textarea aria-label="New note" className={`${input} min-h-[80px] w-full`} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Anything about them, not tied to one session" />
        <button className={`${btnPrimary} mt-2`} type="submit" disabled={!draft.trim()}>Add note</button>
      </form>
      <ul className="mt-4 space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="border-t hairline pt-3">
            <p className="text-[10.5px] text-taupe">{fmtDate(n.created_at)}{n.updated_at !== n.created_at ? ` · edited ${fmtDate(n.updated_at)}` : ""}</p>
            {editing?.id === n.id ? (
              <form className="mt-1" onSubmit={async (e) => { e.preventDefault(); await actions.saveNote(editing); setNotes((xs) => xs.map((x) => (x.id === n.id ? { ...x, body: editing.body, updated_at: new Date().toISOString() } : x))); setEditing(null); }}>
                <textarea aria-label="Edit note" className={`${input} min-h-[80px] w-full`} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
                <div className="mt-1 flex gap-2"><button className={btnPrimary} type="submit">Save</button><button className={btn} type="button" onClick={() => setEditing(null)}>Cancel</button></div>
              </form>
            ) : <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed">{n.body}</p>}
            <FileList initial={n.attachments} purpose="note" ids={{ noteId: n.id }} actions={actions} compact />
            {editing?.id !== n.id && (
              <div className="mt-1 flex gap-3 text-[11px] text-taupe">
                <button className="hover:text-burgundy" onClick={() => setEditing({ id: n.id, body: n.body })}>Edit</button>
                <button className="hover:text-burgundy" onClick={async () => { if (confirm("Delete this note and its files?")) { await actions.deleteNote(n.id); setNotes((xs) => xs.filter((x) => x.id !== n.id)); } }}>Delete</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FileList({ initial, purpose, ids, actions, compact, onChange }: {
  initial: AttachmentView[]; purpose: AttachmentView["purpose"]; ids: { sessionId?: string; noteId?: string }; actions: ProfileActions; compact?: boolean; onChange?: (l: AttachmentView[]) => void;
}) {
  const [files, setFiles] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const update = (l: AttachmentView[]) => { setFiles(l); onChange?.(l); };
  return (
    <div className={compact ? "mt-1" : ""}>
      {files.length > 0 && (
        <ul className="space-y-0.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-[12px]">
              <a className="truncate text-burgundy underline-offset-4 hover:underline" href={actions.attachmentHref(f.id)}>{f.filename}</a>
              <span className="shrink-0 text-[10.5px] text-taupe">{kb(f.size_bytes)}</span>
              <button aria-label={`Delete ${f.filename}`} className="ml-auto shrink-0 text-[11px] text-taupe hover:text-burgundy"
                onClick={async () => { if (confirm(`Delete ${f.filename}?`)) { await actions.deleteAttachment(f.id); update(files.filter((x) => x.id !== f.id)); } }}>×</button>
            </li>
          ))}
        </ul>
      )}
      <label className={`mt-1 inline-flex cursor-pointer items-center gap-1 text-[11px] text-taupe hover:text-burgundy ${busy ? "opacity-60" : ""}`}>
        <span aria-hidden>+</span> {busy ? "Uploading…" : "Attach file"}
        <input type="file" className="sr-only" accept={ACCEPT} disabled={busy} onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
          if (f.size > 10 * 1024 * 1024) return setErr("Files can be up to 10 MB.");
          setBusy(true); setErr(null);
          try { update([...files, await actions.upload(f, purpose, ids)]); } catch { setErr("That file couldn’t be uploaded (PDF, images, documents, spreadsheets, slides, audio; up to 10 MB)."); } finally { setBusy(false); }
        }} />
      </label>
      {err && <p role="alert" className="text-[11px] text-burgundy">{err}</p>}
    </div>
  );
}

/** Delete a whole client profile (Jana, 22 Oct). Typing DELETE confirms; their Self-Interviews stay (delete those from the Map). */
function DeleteProfile({ onDelete }: { onDelete: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  if (!open) return <button className={`${btn} hover:border-[#7A2E2E] hover:text-[#7A2E2E]`} onClick={() => setOpen(true)}>Delete client…</button>;
  return (
    <span className="flex flex-wrap items-center gap-2 rounded-[14px] bg-[#F3E2E2] px-3 py-1.5 text-[11.5px] text-[#7A2E2E]">
      Permanently delete this client with their notes, sessions and files? Their Self-Interviews are kept. Type DELETE
      <input aria-label="Type DELETE to confirm" className={`${input} w-[90px]`} value={text} onChange={(e) => setText(e.target.value)} />
      <button className={btn} disabled={text !== "DELETE"} onClick={async () => { try { await onDelete(); } catch { setErr("Delete failed."); } }}>Delete</button>
      <button className="underline" onClick={() => setOpen(false)}>Cancel</button>
      {err && <span role="alert">{err}</span>}
    </span>
  );
}
