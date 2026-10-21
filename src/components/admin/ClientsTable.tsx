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
        <input type="search" aria-label="Search clients" className={`${input} w-full py-2.5 text-[16px] sm:w-[280px] sm:py-1.5 sm:text-[12.5px]`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or ID" />
        <div role="radiogroup" aria-label="Stage filter" className="inline-flex max-w-full overflow-x-auto rounded-full border border-linen-line text-[11.5px]">
          <button role="radio" aria-checked={stage === ""} onClick={() => setStage("")} className={`whitespace-nowrap px-3 py-2 sm:py-1.5 ${stage === "" ? "bg-burgundy text-linen" : "text-mahogany/75"}`}>All · {rows.length}</button>
          {STAGES.map((s) => <button key={s.value} role="radio" aria-checked={stage === s.value} onClick={() => setStage(s.value)} className={`whitespace-nowrap px-3 py-2 sm:py-1.5 ${stage === s.value ? "bg-burgundy text-linen" : "text-mahogany/75"}`}>{s.label}s · {count(s.value)}</button>)}
        </div>
      </div>
      <ul className="mt-4 space-y-3 md:hidden" aria-label="Clients">
        {shown.map((r) => (
          <li key={r.client_id}>
            <Link href={profileHref(r.client_id)} className="block rounded-[18px] border hairline bg-white/50 p-4 active:bg-linen-deep/50">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-serif text-[17px] text-mahogany">{r.name ?? r.email ?? <span className="font-mono text-[12px]">{shortId(r.client_id)}</span>}</span>
                {stageBadge(r.stage)}
              </div>
              {r.name && r.email && <p className="truncate text-[12px] text-taupe">{r.email}</p>}
              <p className="mt-2 text-[11.5px] text-taupe">
                {r.maps} Map{r.maps === 1 ? "" : "s"} · {r.sessions} session{r.sessions === 1 ? "" : "s"}{r.next_session ? ` · next ${day(r.next_session)}` : r.last_session ? ` · last ${day(r.last_session)}` : ""}
              </p>
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className="rounded-[18px] border hairline px-4 py-8 text-center text-[12.5px] text-taupe">No profiles match.</li>}
      </ul>
      <div className="mt-4 hidden overflow-x-auto rounded-[18px] border hairline bg-white/40 md:block">
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
      <p className="mt-2 text-[10.5px] text-taupe">A profile appears when someone requests their PDF, applies for 1:1 coaching, or you create one from a Map. Applying for coaching moves a Prospect to Lead automatically; Client is set by you.</p>
    </div>
  );
}
