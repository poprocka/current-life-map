"use client";
import Link from "next/link";
import { useState } from "react";
import { useEffect } from "react";
import type { ListFilters, ListRow, ReconRow, SearchHit } from "@/server/admin/types";
import { sourceLabel } from "@/content/channels";
import { Badge, btn, btnPrimary, fmtDate, input, shortId } from "./ui";

const BOOKING_STATES = ["none", "pending", "confirmed", "rescheduled", "cancelled", "completed", "no_show"];

export interface AdminTableProps {
  rows: ListRow[]; total: number; page: number; pages: number; filters: ListFilters;
  recon: ReconRow[];
  canExport: boolean;
  onFilter: (f: ListFilters) => void;
  onReconcile: (bookingId: string, assessmentId: string) => Promise<void>;
  /** Find assessments by name, email or assessment ID (prefix). */
  onSearch: (q: string) => Promise<SearchHit[]>;
  exportHref?: string;
  workspaceHref: (id: string) => string;
}

/** Primary admin screen (addendum §2). No answer details or coach notes are shown here. */
export function AdminTable(p: AdminTableProps) {
  const [f, setF] = useState<ListFilters>(p.filters);
  const [more, setMore] = useState(false);
  const activeFilters = ["booking", "completion", "report", "from", "to"].filter((k) => p.filters[k as keyof ListFilters]).length;
  const set = (k: keyof ListFilters, v: string) => setF((x) => ({ ...x, [k]: v || undefined }));
  const sortBy = (k: NonNullable<ListFilters["sort"]>) => p.onFilter({ ...p.filters, sort: k, dir: p.filters.sort === k && p.filters.dir !== "asc" ? "asc" : "desc", page: 1 });
  const Th = ({ k, children }: { k?: NonNullable<ListFilters["sort"]>; children: React.ReactNode }) => (
    <th scope="col" className="whitespace-nowrap px-3 py-2 text-left font-normal">
      {k ? <button className="uppercase tracking-[0.1em] hover:text-burgundy" onClick={() => sortBy(k)}>{children}{p.filters.sort === k ? (p.filters.dir === "asc" ? " ↑" : " ↓") : ""}</button> : children}
    </th>
  );

  return (
    <div className="space-y-6">
      {p.recon.length > 0 && <ReconQueue rows={p.recon} onReconcile={p.onReconcile} onSearch={p.onSearch} />}

      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); p.onFilter({ ...f, page: 1 }); }}>
        <label className="flex w-full flex-col gap-1 text-[10.5px] uppercase tracking-[0.12em] text-taupe sm:w-auto">Search
          <input type="search" className={`${input} w-full py-2.5 text-[16px] normal-case tracking-normal sm:w-[260px] sm:py-1.5 sm:text-[12.5px]`} placeholder="ID, email or name" value={f.q ?? ""} onChange={(e) => set("q", e.target.value)} />
        </label>
        <button type="button" className={`${btn} sm:hidden`} aria-expanded={more} onClick={() => setMore((m) => !m)}>Filters{activeFilters ? ` · ${activeFilters}` : ""}</button>
        <div className={`${more ? "flex" : "hidden"} w-full flex-wrap items-end gap-3 sm:contents`}>
        <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-[0.12em] text-taupe">Booking
          <select className={input} value={f.booking ?? ""} onChange={(e) => set("booking", e.target.value)}>
            <option value="">Any</option>{BOOKING_STATES.map((s) => <option key={s} value={s}>{s.replace("_", "-")}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-[0.12em] text-taupe">Completion
          <select className={input} value={f.completion ?? ""} onChange={(e) => set("completion", e.target.value)}>
            <option value="">Any</option><option value="completed">Completed</option><option value="in_progress">In progress</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-[0.12em] text-taupe">Report
          <select className={input} value={f.report ?? ""} onChange={(e) => set("report", e.target.value)}>
            <option value="">Any</option><option value="ready">Ready</option><option value="none">Not generated</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-[0.12em] text-taupe">From
          <input type="date" className={input} value={f.from ?? ""} onChange={(e) => set("from", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-[0.12em] text-taupe">To
          <input type="date" className={input} value={f.to ?? ""} onChange={(e) => set("to", e.target.value)} />
        </label>
        </div>
        <button className={btnPrimary} type="submit">Apply</button>
        <button className={btn} type="button" onClick={() => { setF({}); p.onFilter({}); }}>Clear</button>
        <span className="w-full text-[12px] text-taupe sm:ml-auto sm:w-auto">{p.total} assessment{p.total === 1 ? "" : "s"}</span>
        {p.canExport && p.exportHref && <a className={btn} href={p.exportHref}>Export CSV</a>}
      </form>

      <ul className="space-y-3 lg:hidden" aria-label="Assessments">
        {p.rows.map((r) => (
          <li key={r.assessment_id}>
            <Link href={p.workspaceHref(r.assessment_id)} className="block rounded-[18px] border hairline bg-white/50 p-4 active:bg-linen-deep/50">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-serif text-[17px] text-mahogany">{r.client_name ?? <span className="text-taupe">Anonymous</span>}</span>
                <span className="shrink-0 font-mono text-[11px] text-burgundy">{shortId(r.assessment_id)}</span>
              </div>
              {r.client_email && <p className="truncate text-[12px] text-taupe">{r.client_email}</p>}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                {r.status === "completed" ? <Badge v="completed" /> : <Badge v="in_progress" label={`${r.sections_completed}/10 sections`} />}
                {r.client_stage && <Badge v={r.client_stage === "client" ? "confirmed" : r.client_stage === "lead" ? "pending" : "unreviewed"} label={r.client_stage === "client" ? "Client" : r.client_stage === "lead" ? "Lead" : "Prospect"} />}
                {r.booking_state && <Badge v={r.booking_state} label={`Deep Dive ${r.booking_state.replace("_", "-")}`} />}
                {r.payment_state && r.payment_state !== "none" && <Badge v={r.payment_state} />}
                {r.email_delivery_state && <Badge v={r.email_delivery_state} label={`PDF ${r.email_delivery_state}`} />}
                {r.coach_review_state && r.coach_review_state !== "unreviewed" && <Badge v={r.coach_review_state} label={`review ${r.coach_review_state.replace("_", " ")}`} />}
              </div>
              <p className="mt-2 text-[11.5px] text-taupe">
                {r.scheduled_start ? <>Session {fmtDate(r.scheduled_start, r.timezone)} · </> : null}Created {fmtDate(r.created_at)} · via {sourceLabel(r.source)}
              </p>
            </Link>
          </li>
        ))}
        {!p.rows.length && <li className="rounded-[18px] border hairline px-4 py-8 text-center text-[12.5px] text-taupe">No assessments match these filters.</li>}
      </ul>

      <div className="hidden overflow-x-auto rounded-[18px] border hairline bg-white/40 lg:block">
        <table className="w-full min-w-[1700px] text-[12px] text-mahogany/90">
          <thead className="border-b hairline text-[10px] uppercase tracking-[0.1em] text-taupe">
            <tr>
              <Th>Assessment</Th><Th k="created_at">Created</Th><Th k="completed_at">Completed</Th><Th>Progress</Th><Th>Version</Th>
              <Th>Client</Th><Th>Email</Th><Th>Came from</Th><Th>Contact source</Th><Th>Email delivery</Th>
              <Th>Booking</Th><Th k="scheduled_start">Session</Th><Th>Payment</Th>
              <Th>Report</Th><Th>Coach review</Th><Th>Follow-up</Th><Th>Stage</Th><Th k="last_activity_at">Last activity</Th>
            </tr>
          </thead>
          <tbody>
            {p.rows.map((r) => (
              <tr key={r.assessment_id} className="border-b hairline align-top last:border-0 hover:bg-linen-deep/40">
                <td className="px-3 py-2.5"><Link className="font-mono text-[11.5px] text-burgundy underline-offset-4 hover:underline" href={p.workspaceHref(r.assessment_id)}>{shortId(r.assessment_id)}</Link></td>
                <td className="whitespace-nowrap px-3 py-2.5">{fmtDate(r.created_at)}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{fmtDate(r.completed_at)}</td>
                <td className="px-3 py-2.5">{r.status === "completed" ? <Badge v="completed" /> : <span>{r.sections_completed}/10</span>}</td>
                <td className="px-3 py-2.5 text-taupe">{r.assessment_version.replace("v10-with-approved-oct12-overrides", "v10 · 12 Oct")}</td>
                <td className="px-3 py-2.5">{r.client_name ?? <span className="text-taupe">Anonymous</span>}</td>
                <td className="px-3 py-2.5">{r.client_email ?? <span className="text-taupe">—</span>}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{sourceLabel(r.source)}{r.campaign && <span className="block text-[10.5px] text-taupe">{r.campaign.replace(/_/g, " ")}</span>}</td>
                <td className="px-3 py-2.5">{r.contact_source?.split(",").map((s) => s.replace("_", " ")).join(", ") ?? "—"}</td>
                <td className="px-3 py-2.5"><Badge v={r.email_delivery_state} /></td>
                <td className="px-3 py-2.5">{r.booking_state ? <Badge v={r.booking_state} /> : <span className="text-taupe">none</span>}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{r.scheduled_start ? <>{fmtDate(r.scheduled_start, r.timezone)}<span className="block text-[10.5px] text-taupe">{r.timezone}</span></> : "—"}</td>
                <td className="px-3 py-2.5"><Badge v={r.payment_state} /></td>
                <td className="px-3 py-2.5"><Badge v={r.report_status} /></td>
                <td className="px-3 py-2.5"><Badge v={r.coach_review_state} /></td>
                <td className="px-3 py-2.5"><Badge v={r.follow_up_status === "none" ? null : r.follow_up_status} /></td>
                <td className="px-3 py-2.5">{r.client_stage ? <Badge v={r.client_stage === "client" ? "confirmed" : r.client_stage === "lead" ? "pending" : "unreviewed"} label={r.client_stage === "client" ? "Client" : r.client_stage === "lead" ? "Lead" : "Prospect"} /> : <span className="text-taupe/70">—</span>}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-taupe">{fmtDate(r.last_activity_at)}</td>
              </tr>
            ))}
            {!p.rows.length && <tr><td colSpan={18} className="px-3 py-10 text-center text-taupe">No assessments match these filters.</td></tr>}
          </tbody>
        </table>
      </div>

      {p.pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-[12px]" aria-label="Pages">
          <button className={btn} disabled={p.page <= 1} onClick={() => p.onFilter({ ...p.filters, page: p.page - 1 })}>Previous</button>
          <span className="text-taupe">Page {p.page} of {p.pages}</span>
          <button className={btn} disabled={p.page >= p.pages} onClick={() => p.onFilter({ ...p.filters, page: p.page + 1 })}>Next</button>
        </nav>
      )}
    </div>
  );
}

function ReconQueue({ rows, onReconcile, onSearch }: { rows: ReconRow[]; onReconcile: AdminTableProps["onReconcile"]; onSearch: AdminTableProps["onSearch"] }) {
  return (
    <section className="rounded-[18px] border border-[#E7C98F] bg-[#FBF3E3] p-5" aria-labelledby="recon-h">
      <h2 id="recon-h" className="text-[10.5px] uppercase tracking-[0.16em] text-[#8A6420]">Needs reconciliation · {rows.length}</h2>
      <p className="mt-1 text-[12px] text-mahogany/70">Bookings that couldn’t be matched to a Self-Interview automatically. Find the right assessment by name, email or assessment ID, then confirm the link. Nothing is linked until you confirm.</p>
      <ul className="mt-4 divide-y divide-[#EBD9B4]">
        {rows.map((r) => <ReconItem key={r.id} r={r} onReconcile={onReconcile} onSearch={onSearch} />)}
      </ul>
    </section>
  );
}

function ReconItem({ r, onReconcile, onSearch }: { r: ReconRow; onReconcile: AdminTableProps["onReconcile"]; onSearch: AdminTableProps["onSearch"] }) {
  const [q, setQ] = useState(r.booked_email ?? r.booked_name ?? "");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (term: string) => {
    if (term.trim().length < 2) return setHits(null);
    try { setHits(await onSearch(term.trim())); } catch { setHits([]); }
  };
  useEffect(() => { const t = setTimeout(() => run(q), 250); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <li className="py-4 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 sm:min-w-[200px]"><b className="font-normal">{r.booked_name ?? "Unknown"}</b> <span className="text-taupe">{r.booked_email}</span></span>
        <span className="text-taupe">{fmtDate(r.scheduled_start)}</span>
        <Badge v={r.booking_state} /><Badge v={r.payment_state} />
        <span className="flex-1 text-[#8A6420]">{r.reconciliation_reason}</span>
      </div>
      {!r.assessment_id && (
        <div className="mt-3 rounded-[12px] bg-white/60 p-3">
          <label className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-taupe">Find assessment
            <input className={`${input} w-full normal-case tracking-normal sm:w-[340px]`} placeholder="Name, email or assessment ID" value={q}
              onChange={(e) => { setQ(e.target.value); setPicked(null); }} />
          </label>
          {hits && (hits.length ? (
            <ul className="mt-2 space-y-1">
              {hits.map((h) => (
                <li key={h.assessment_id}>
                  <label className={`flex cursor-pointer flex-wrap items-center gap-3 rounded-lg px-2 py-1.5 ${picked === h.assessment_id ? "bg-linen-deep" : "hover:bg-linen-deep/50"}`}>
                    <input type="radio" name={`pick-${r.id}`} checked={picked === h.assessment_id} onChange={() => setPicked(h.assessment_id)} />
                    <span className="font-mono text-[11px] text-burgundy">{shortId(h.assessment_id)}</span>
                    <span>{h.client_name ?? <span className="text-taupe">No name</span>}</span>
                    <span className="text-taupe">{h.client_email ?? "no email"}</span>
                    <span className="text-taupe">{fmtDate(h.created_at)}</span>
                    <Badge v={h.status} />
                    {h.booking_state && <span className="text-[11px] text-taupe">already has a booking: {h.booking_state}</span>}
                  </label>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[12px] text-taupe">No assessments match. If they haven’t taken the Self-Interview yet, send it to them first.</p>)}
          <div className="mt-3 flex items-center gap-3">
            <button className={btnPrimary} disabled={!picked || busy}
              onClick={async () => { setBusy(true); setErr(null); try { await onReconcile(r.id, picked!); } catch { setErr("Couldn’t link that booking. Please try again."); } setBusy(false); }}>
              Link booking to selected assessment
            </button>
            {err && <span role="alert" className="text-[12px] text-burgundy">{err}</span>}
          </div>
        </div>
      )}
    </li>
  );
}
