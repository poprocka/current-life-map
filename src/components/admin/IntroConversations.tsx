"use client";
import Link from "next/link";
import type { IntroRow } from "@/server/admin/types";
import { Badge, fmtDate, shortId } from "./ui";

const STATE: Record<string, string> = { confirmed: "Scheduled", cancelled: "Cancelled", completed: "Completed", no_show: "No-show", pending: "Pending" };

/**
 * Complimentary introductory conversations for 1:1 coaching (21 Oct), as Calendly reports them: who booked, when, the
 * answers from Calendly's booking form, and the Map they booked from (when they used the button on their results or
 * the link in their PDF email).
 */
export function IntroConversations({ rows }: { rows: IntroRow[] }) {
  return (
    <section className="rounded-[18px] border hairline bg-white/40 p-5" aria-labelledby="intro-h">
      <h2 id="intro-h" className="text-[10.5px] uppercase tracking-[0.16em] text-burgundy">1:1 coaching · introductory conversations · {rows.length}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-taupe">None yet. Each booking made in Calendly appears here, with the answers from its booking form.</p>
      ) : (
        <ul className="mt-3 divide-y divide-linen-line">
          {rows.map((b) => (
            <li key={b.id} className="py-3.5 text-[12.5px]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <b className="font-normal text-mahogany">{b.booked_name ?? "Unknown"}</b>
                {b.booked_email && <a href={`mailto:${b.booked_email}`} className="text-taupe underline decoration-linen-line underline-offset-4 hover:text-burgundy">{b.booked_email}</a>}
                <Badge v={b.booking_state} label={STATE[b.booking_state] ?? b.booking_state} />
                <span className="text-mahogany/75">{fmtDate(b.scheduled_start, b.timezone)}</span>
                {b.meeting_url && b.booking_state === "confirmed" && <a href={b.meeting_url} target="_blank" rel="noopener noreferrer" className="text-burgundy underline underline-offset-4">Join link</a>}
              </div>
              <p className="mt-1 text-[11.5px] text-taupe">
                Booked {fmtDate(b.created_at)}
                {b.assessment_id
                  ? <> · <Link href={`/admin/assessments/${b.assessment_id}`} className="font-mono text-burgundy underline-offset-4 hover:underline">Map {shortId(b.assessment_id)}</Link></>
                  : " · not linked to a Map"}
              </p>
              {b.intake_answers?.filter((q) => q.answer?.trim()).map((q, i) => (
                <div key={i} className="mt-2 rounded-[12px] bg-linen/70 px-3.5 py-2.5">
                  <p className="text-[11px] text-taupe">{q.question}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-mahogany/85">{q.answer}</p>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
