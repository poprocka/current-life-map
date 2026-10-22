"use client";
import { sourceLabel } from "@/content/channels";
import type { ChannelRow } from "@/server/admin/types";
import { useOpen } from "./useCollapsed";

/** "Where people come from": one row per channel, from first visit to booked introductory conversation. Phone: stacked cards. */
export function ChannelSummary({ rows, days = 90 }: { rows: ChannelRow[]; days?: number }) {
  const [open, setOpen] = useOpen("channels");
  if (!rows.length) return null;
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");
  const cols: [keyof ChannelRow, string][] = [["started", "Started"], ["completed", "Completed"], ["pdf", "PDF"], ["booked", "Booked"]];
  return (
    <details className="group rounded-[18px] border hairline bg-white/40 p-4 sm:p-5" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <h2 className="text-[10.5px] uppercase tracking-[0.16em] text-burgundy">Where people come from · last {days} days</h2>
        <span className="text-[11px] uppercase tracking-[0.12em] text-taupe hover:text-burgundy"><span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span></span>
      </summary>
      <ul className="mt-3 space-y-2 sm:hidden">
        {rows.map((r) => (
          <li key={r.source} className="rounded-xl bg-white/60 px-3 py-2.5 text-[12px]">
            <div className="flex items-baseline justify-between"><b className="font-normal text-mahogany">{sourceLabel(r.source)}</b><span className="text-taupe">{r.started} started</span></div>
            <p className="mt-1 text-taupe">{r.completed} completed ({pct(r.completed, r.started)}) · {r.pdf} PDF · {r.booked} booked</p>
          </li>
        ))}
      </ul>
      <table className="mt-3 hidden w-full text-left text-[12.5px] sm:table">
        <thead className="text-[10px] uppercase tracking-[0.1em] text-taupe">
          <tr><th className="pb-2 font-normal">Channel</th>{cols.map(([, h]) => <th key={h} className="pb-2 text-right font-normal">{h}</th>)}<th className="pb-2 text-right font-normal">Started → booked</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.source} className="border-t hairline">
              <td className="py-2">{sourceLabel(r.source)}</td>
              {cols.map(([k]) => <td key={k} className="py-2 text-right tabular-nums">{r[k]}</td>)}
              <td className="py-2 text-right tabular-nums text-taupe">{pct(r.booked, r.started)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10.5px] text-taupe">The first link that brought each person here. &ldquo;Direct / unknown&rdquo; means a typed address, a private client link, or a browser that hides where it came from.</p>
    </details>
  );
}
