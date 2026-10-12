"use client";
import Link from "next/link";
import { useState } from "react";
import type { ListFilters, ListRow, ReconRow } from "@/server/admin/types";
import { Badge, btn, btnPrimary, fmtDate, input, shortId } from "./ui";

const BOOKING_STATES = ["none", "pending", "confirmed", "rescheduled", "cancelled", "completed", "no_show"];

export interface AdminTableProps {
  rows: ListRow[]; total: number; page: number; pages: number; filters: ListFilters;
  recon: ReconRow[];
  canExport: boolean;
  onFilter: (f: ListFilters) => void;
  onReconcile: (bookingId: string, assessmentId: string) => Promise<void>;
  exportHref?: string;
  workspaceHref: (id: string) => string;
}

/** Primary admin screen (addendum §2). No answer details or coach notes are shown here. */
export function AdminTable(p: AdminTableProps) {
  const [f, setF] = useState<ListFilters>(p.filters);
  const set = (k: keyof ListFilters, v: string) => setF((x) => ({ ...x, [k]: v || undefined }));
  const sortBy = (k: NonNullable<ListFilters["sort"]>) => p.onFilter({ ...p.filters, sort: k, dir: p.filters.sort === k && p.filters.dir !== "asc" ? "asc" : "desc", page: 1 });
  const Th = ({ k, children }: { k?: NonNullable<ListFilters["sort"]>; children: React.ReactNode }) => (
    <th scope="col" className="whitespace-nowrap px-3 py-2 text-left font-normal">
      {k ? <button className="uppercase tracking-[0.1em] hover:text-burgundy" onClick={() => sortBy(k)}>{children}{p.filters.sort === k ? (p.filters.dir === "asc" ? " ↑" : " ↓") : ""}</button> : children}
    </th>
  );

  return (
    <div className="space-y-6">
      {p.recon.length > 0 && <ReconQueue rows={p.recon} onReconcile={p.onReconcile} />}

      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); p.onFilter({ ...f, page: 1 }); }}>
        <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-[0.12em] text-taupe">Search
          <input className={`${input} w-[260px] normal-case tracking-normal`} placeholder="ID, email or name" value={f.q ?? ""} onChange={(e) => set("q", e.target.value)} />
        </label>
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
        <button className={btnPrimary} type="submit">Apply</button>
        <button className={btn} type="button" onClick={() => { setF({}); p.onFilter({}); }}>Clear</button>
        <span className="ml-auto text-[12px] text-taupe">{p.total} assessment{p.total === 1 ? "" : "s"}</span>
        {p.canExport && p.exportHref && <a className={btn} href={p.exportHref}>Export CSV</a>}
      </form>

      <div className="overflow-x-auto rounded-[18px] border hairline bg-white/40">
        <table className="w-full min-w-[1500px] text-[12px] text-mahogany/90">
          <thead className="border-b hairline text-[10px] uppercase tracking-[0.1em] text-taupe">
            <tr>
              <Th>Assessment</Th><Th k="created_at">Created</Th><Th k="completed_at">Completed</Th><Th>Progress</Th><Th>Version</Th>
              <Th>Client</Th><Th>Email</Th><Th>Contact source</Th><Th>Email delivery</Th>
              <Th>Booking</Th><Th k="scheduled_start">Session</Th><Th>Payment</Th>
              <Th>Report</Th><Th>Coach review</Th><Th>Follow-up</Th><Th k="last_activity_at">Last activity</Th>
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
                <td className="px-3 py-2.5">{r.contact_source?.split(",").map((s) => s.replace("_", " ")).join(", ") ?? "—"}</td>
                <td className="px-3 py-2.5"><Badge v={r.email_delivery_state} /></td>
                <td className="px-3 py-2.5">{r.booking_state ? <Badge v={r.booking_state} /> : <span className="text-taupe">none</span>}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{r.scheduled_start ? <>{fmtDate(r.scheduled_start, r.timezone)}<span className="block text-[10.5px] text-taupe">{r.timezone}</span></> : "—"}</td>
                <td className="px-3 py-2.5"><Badge v={r.payment_state} /></td>
                <td className="px-3 py-2.5"><Badge v={r.report_status} /></td>
                <td className="px-3 py-2.5"><Badge v={r.coach_review_state} /></td>
                <td className="px-3 py-2.5"><Badge v={r.follow_up_status === "none" ? null : r.follow_up_status} /></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-taupe">{fmtDate(r.last_activity_at)}</td>
              </tr>
            ))}
            {!p.rows.length && <tr><td colSpan={16} className="px-3 py-10 text-center text-taupe">No assessments match these filters.</td></tr>}
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

function ReconQueue({ rows, onReconcile }: { rows: ReconRow[]; onReconcile: AdminTableProps["onReconcile"] }) {
  const [target, setTarget] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <section className="rounded-[18px] border border-[#E7C98F] bg-[#FBF3E3] p-5" aria-labelledby="recon-h">
      <h2 id="recon-h" className="text-[10.5px] uppercase tracking-[0.16em] text-[#8A6420]">Needs reconciliation · {rows.length}</h2>
      <p className="mt-1 text-[12px] text-mahogany/70">Booking events that could not be matched safely, or need a decision. Nothing about the assessment was shared with the scheduler.</p>
      <ul className="mt-4 divide-y divide-[#EBD9B4]">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-[12.5px]">
            <span className="min-w-[200px]"><b className="font-normal">{r.booked_name ?? "Unknown"}</b> <span className="text-taupe">{r.booked_email}</span></span>
            <span className="text-taupe">{fmtDate(r.scheduled_start)}</span>
            <Badge v={r.booking_state} /><Badge v={r.payment_state} />
            <span className="flex-1 text-[#8A6420]">{r.reconciliation_reason}</span>
            {!r.assessment_id && (
              <span className="flex items-center gap-2">
                <input className={`${input} w-[300px] font-mono text-[11px]`} placeholder="Assessment ID to link" value={target[r.id] ?? ""}
                  onChange={(e) => setTarget((t) => ({ ...t, [r.id]: e.target.value.trim() }))} />
                <button className={btn} disabled={!/^[0-9a-f-]{36}$/.test(target[r.id] ?? "") || busy === r.id}
                  onClick={async () => { setBusy(r.id); setErr(null); try { await onReconcile(r.id, target[r.id]); } catch { setErr("Couldn't link that booking. Check the assessment ID."); } setBusy(null); }}>
                  Link
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {err && <p role="alert" className="mt-2 text-[12px] text-burgundy">{err}</p>}
    </section>
  );
}
