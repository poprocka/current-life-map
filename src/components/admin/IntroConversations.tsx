"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOpen } from "./useCollapsed";
import type { IntroRow } from "@/server/admin/types";
import { Badge, btn, fmtDate, shortId } from "./ui";

const STATE: Record<string, string> = { confirmed: "Scheduled", cancelled: "Cancelled", completed: "Completed", no_show: "No-show", pending: "Pending" };

/**
 * Complimentary introductory conversations for 1:1 coaching (21 Oct), as Calendly reports them: who booked, when, the
 * answers from Calendly's booking form, and the Map they booked from (when they used the button on their results or
 * the link in their PDF email).
 */
export function IntroConversations({ rows, canDelete = false }: { rows: IntroRow[]; canDelete?: boolean }) {
  const [open, setOpen] = useOpen("intro");
  return (
    // Collapsible, remembered on this device (Jana, 22 Oct)
    <details className="group rounded-[18px] border hairline bg-white/40 p-5" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <h2 id="intro-h" className="text-[10.5px] uppercase tracking-[0.16em] text-burgundy">1:1 coaching · introductory conversations · {rows.length}</h2>
        <span className="text-[11px] uppercase tracking-[0.12em] text-taupe hover:text-burgundy"><span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span></span>
      </summary>
      {rows.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-taupe">None yet. Each booking made in Calendly appears here, with the answers from its booking form.</p>
      ) : (
        <ul className="mt-3 divide-y divide-linen-line">
          {rows.map((b) => <IntroItem key={b.id} b={b} canDelete={canDelete} />)}
        </ul>
      )}
    </details>
  );
}

/** One booking. Cancelled ones can be deleted by an admin (two steps, so it can't happen by accident). */
function IntroItem({ b, canDelete }: { b: IntroRow; canDelete: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function remove() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/admin/bookings/${b.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete" }) });
      if (!r.ok) throw new Error();
      router.refresh();
    } catch { setErr("Couldn’t delete it. Please try again."); setBusy(false); setConfirming(false); }
  }
  return (
    <li className="py-3.5 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <b className="font-normal text-mahogany">{b.booked_name ?? "Unknown"}</b>
        {b.booked_email && <a href={`mailto:${b.booked_email}`} className="text-taupe underline decoration-linen-line underline-offset-4 hover:text-burgundy">{b.booked_email}</a>}
        <Badge v={b.booking_state} label={STATE[b.booking_state] ?? b.booking_state} />
        <span className="text-mahogany/75">{fmtDate(b.scheduled_start, b.timezone)}</span>
        {b.meeting_url && b.booking_state === "confirmed" && <a href={b.meeting_url} target="_blank" rel="noopener noreferrer" className="text-burgundy underline underline-offset-4">Join link</a>}
        {canDelete && b.booking_state === "cancelled" && (
          <span className="ml-auto flex items-center gap-2">
            {confirming ? (
              <>
                <span className="text-[11.5px] text-[#7A2E2E]">Delete this cancelled booking?</span>
                <button className={btn} disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Yes, delete"}</button>
                <button className="text-[11.5px] text-taupe underline underline-offset-4" onClick={() => setConfirming(false)}>Cancel</button>
              </>
            ) : (
              <button className={`${btn} hover:border-[#7A2E2E] hover:text-[#7A2E2E]`} onClick={() => setConfirming(true)}>Delete</button>
            )}
          </span>
        )}
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
      {err && <p role="alert" className="mt-1.5 text-[12px] text-burgundy">{err}</p>}
    </li>
  );
}
