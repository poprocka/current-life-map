"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ClientListRow, Stage } from "@/server/admin/types";
import { STAGES } from "@/server/admin/types";
import { Badge, input, shortId } from "./ui";

const day = (s: string | null) => (s ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(s.length === 10 ? `${s}T12:00:00` : s)) : "—");
export const stageBadge = (s: Stage) => <Badge v={s === "client" ? "confirmed" : s === "lead" ? "pending" : "unreviewed"} label={STAGES.find((x) => x.value === s)!.label} />;

/** Client profiles: Clients first, then Leads, then Prospects. Search by name, email or ID. */
export function ClientsTable({ rows, profileHref }: { rows: ClientListRow[]; profileHref: (id: string) => string }) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<Stage | "">("");
  const shown = useMemo(() => rows.filter((r) => (!stage || r.stage === stage) && (!q.trim() || [r.name, r.email, r.client_id].some((v) => v?.toLowerCase().includes(q.trim().toLowerCase())))), [rows, q, stage]);
  const count = (s: Stage) => rows.filter((r) => r.stage === s).length;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Search clients" className={`${input} w-[280px]`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or ID" />
        <div role="radiogroup" aria-label="Stage filter" className="inline-flex overflow-hidden rounded-full border border-linen-line text-[11.5px]">
          <button role="radio" aria-checked={stage === ""} onClick={() => setStage("")} className={`px-3 py-1.5 ${stage === "" ? "bg-burgundy text-linen" : "text-mahogany/75"}`}>All · {rows.length}</button>
          {STAGES.map((s) => <button key={s.value} role="radio" aria-checked={stage === s.value} onClick={() => setStage(s.value)} className={`px-3 py-1.5 ${stage === s.value ? "bg-burgundy text-linen" : "text-mahogany/75"}`}>{s.label}s · {count(s.value)}</button>)}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto rounded-[18px] border hairline bg-white/40">
        <table className="w-full min-w-[760px] text-left text-[12.5px]">
          <thead className="text-[10.5px] uppercase tracking-[0.12em] text-taupe">
            <tr>{["Client", "Stage", "Maps", "Last Map", "Sessions", "Next session", "Last session"].map((h) => <th key={h} className="px-3 py-2.5 font-normal">{h}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.client_id} className="border-t hairline hover:bg-white/50">
                <td className="px-3 py-2.5">
                  <Link href={profileHref(r.client_id)} className="font-serif text-[15px] text-mahogany underline-offset-4 hover:text-burgundy hover:underline">{r.name ?? r.email ?? <span className="font-mono text-[12px]">{shortId(r.client_id)}</span>}</Link>
                  {r.name && r.email && <span className="block text-[11px] text-taupe">{r.email}</span>}
                </td>
                <td className="px-3 py-2.5">{stageBadge(r.stage)}</td>
                <td className="px-3 py-2.5">{r.maps}</td>
                <td className="px-3 py-2.5">{day(r.last_map_at)}</td>
                <td className="px-3 py-2.5">{r.sessions}</td>
                <td className="px-3 py-2.5">{day(r.next_session)}</td>
                <td className="px-3 py-2.5">{day(r.last_session)}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-taupe">No profiles match.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10.5px] text-taupe">A profile appears when someone requests their PDF, books a Deep Dive, or you create one from a Map. Booking a Deep Dive moves a Prospect to Lead automatically; Client is set by you.</p>
    </div>
  );
}
