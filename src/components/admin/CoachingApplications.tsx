"use client";
import Link from "next/link";
import type { ApplicationRow } from "@/server/admin/types";
import { Badge, fmtDate, shortId } from "./ui";

const STATUS: Record<ApplicationRow["status"], string> = { submitted: "Applied · not yet scheduled", scheduled: "Introductory conversation scheduled", cancelled: "Conversation cancelled" };
const TONE: Record<ApplicationRow["status"], string> = { submitted: "pending", scheduled: "confirmed", cancelled: "cancelled" };
const SOURCE: Record<string, string> = { results: "from their results", email: "from the PDF email", direct: "without a Self-Interview on this device" };

/**
 * 1:1 coaching applications (21 Oct): name, email, optional message, the linked Self-Interview and whether the
 * complimentary introductory conversation is scheduled. Applying alone is never shown as booked.
 */
export function CoachingApplications({ rows }: { rows: ApplicationRow[] }) {
  return (
    <section className="rounded-[18px] border hairline bg-white/40 p-5" aria-labelledby="apps-h">
      <h2 id="apps-h" className="text-[10.5px] uppercase tracking-[0.16em] text-burgundy">1:1 coaching applications · {rows.length}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-taupe">No applications yet. They appear here when someone applies from their results or their PDF email.</p>
      ) : (
        <ul className="mt-3 divide-y divide-linen-line">
          {rows.map((a) => (
            <li key={a.id} className="py-3.5 text-[12.5px]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <b className="font-normal text-mahogany">{a.name}</b>
                <a href={`mailto:${a.email}`} className="text-taupe underline decoration-linen-line underline-offset-4 hover:text-burgundy">{a.email}</a>
                <Badge v={TONE[a.status]} label={STATUS[a.status]} />
                {a.status === "scheduled" && a.scheduled_start && <span className="text-mahogany/75">{fmtDate(a.scheduled_start, a.timezone)}</span>}
              </div>
              <p className="mt-1 text-[11.5px] text-taupe">
                Applied {fmtDate(a.created_at)} · {SOURCE[a.source] ?? a.source}
                {a.assessment_id && <> · <Link href={`/admin/assessments/${a.assessment_id}`} className="font-mono text-burgundy underline-offset-4 hover:underline">Map {shortId(a.assessment_id)}</Link></>}
              </p>
              {a.message && <p className="mt-2 whitespace-pre-wrap rounded-[12px] bg-linen/70 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-mahogany/85">{a.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
