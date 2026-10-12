/** Preview-only coach workspace with invented sample data, clearly labelled. Same components as production. */
import React, { useMemo, useState } from "react";
import { AdminTable } from "@/components/admin/AdminTable";
import { Workspace } from "@/components/admin/Workspace";
import { DemoBanner } from "@/components/admin/ui";
import type { ListFilters, ListRow, ReconRow, WorkspaceData } from "@/server/admin/types";
import { computeLifeMap } from "@/engine/compute";
import { generateCoachReport, COACH_REPORT_TEMPLATE_VERSION } from "@/engine/coach/report";
import { generateDeepDiveScript } from "@/engine/coach/script";
import { ACTIVE_QUESTIONS, ASSESSMENT_VERSION, QUESTION_BANK_VERSION, questionById } from "@/content/v10/question-bank";
import { NOT_APPLICABLE } from "@/content/types";
import { navigate } from "./shims/router";

const ago = (days: number, h = 10) => { const d = new Date(Date.now() - days * 864e5); d.setHours(h, 12, 0, 0); return d.toISOString(); };
const ahead = (days: number, h = 10) => { const d = new Date(Date.now() + days * 864e5); d.setUTCHours(h, 0, 0, 0); return d.toISOString(); };

function answersFor(seed: number): Record<string, string | string[]> {
  const a: Record<string, string | string[]> = {};
  const truth = ["3", "1", "4", "0", "2", "3", "1", "2"];
  const imp = ["3", "4", "4", "2", "1", "4", "2", "1"], en = ["-1", "1", "-2", "1", "0", "-1", "0", "2"];
  const orbitIx: Record<string, number> = { mind: 0, body: 1, restoration: 2, growth: 3, love: 4, social: 5, resources: 6, joy: 7 };
  let i = seed;
  for (const q of ACTIVE_QUESTIONS) {
    const k = orbitIx[q.chapterId] ?? 0;
    if (q.responseType === "truth") a[q.id] = q.allowNotApplicable && seed % 2 === 0 ? NOT_APPLICABLE : truth[i++ % truth.length];
    else if (q.responseType === "importance") a[q.id] = imp[(k + seed) % 8];
    else if (q.responseType === "energy") a[q.id] = en[(k + seed) % 8];
    else if (q.responseType === "emotional_state") a[q.id] = [q.options[(seed + k) % q.options.length].value, q.options[(seed + k + 3) % q.options.length].value];
  }
  const o = ["social", "joy", "restoration", "growth", "resources", "body", "mind", "love"];
  Object.assign(a, { "interconnections.01": o[seed % 8], "interconnections.02": o[(seed + 1) % 8], "interconnections.03": o[(seed + 2) % 8], "interconnections.04": o[(seed + 2) % 8],
    "interconnections.05": o[(seed + 3) % 8], "interconnections.06": o[(seed + 4) % 8], "interconnections.07": "somewhat_compete" });
  if (seed % 2 === 0) a["interconnections.reflection"] = "That I have been calling exhaustion “a busy season” for two years.";
  if (seed === 0) {
    a["postmap.02"] = "My work. It looks like the career I wanted, but most days I'm performing it.";
    a["postmap.05"] = "That I'm tired of being the steady one.";
  }
  return a;
}

interface Person { id: string; name: string | null; email: string | null; seed: number; complete: boolean; sections: number; created: number;
  booking?: { state: string; payment: string; start: string; tz: string; rescheduled?: boolean }; pdf?: string; review: string; follow: string; email2?: string }
const PEOPLE: Person[] = [
  { id: "3f9c2a71-8d4e-4b1a-9c55-2e7f0a6b1d01", name: "Alex Rivera", email: "alex@example.com", seed: 0, complete: true, sections: 10, created: 4,
    booking: { state: "confirmed", payment: "paid", start: ahead(3, 9), tz: "Europe/Lisbon" }, pdf: "delivered", review: "in_review", follow: "none", email2: "alex.r@work.example" },
  { id: "7b1e5d22-0c3f-4e8a-b6a1-5d9c3e2f4a02", name: null, email: null, seed: 1, complete: true, sections: 10, created: 2, review: "unreviewed", follow: "none" },
  { id: "c4a8f613-5e2b-4d7c-8f19-6a0b2c3d5e03", name: null, email: null, seed: 3, complete: false, sections: 6, created: 1, review: "", follow: "none" },
  { id: "e2d7b904-1a6c-4f3e-9d28-7b1c0d4e6f04", name: null, email: "sam@example.com", seed: 2, complete: true, sections: 10, created: 6, pdf: "sent", review: "unreviewed", follow: "none" },
  { id: "a9f3c185-6b2d-4e1f-8a37-8c2d1e5f7a05", name: "Mira Chen", email: "mira@example.com", seed: 4, complete: true, sections: 10, created: 9,
    booking: { state: "confirmed", payment: "paid", start: ahead(8, 15), tz: "America/New_York", rescheduled: true }, review: "reviewed", follow: "planned" },
  { id: "5d2b7e46-9c1a-4b3f-a6e8-9d3e2f6a8b06", name: "Jordan Lee", email: "jordan@example.com", seed: 5, complete: true, sections: 10, created: 14,
    booking: { state: "cancelled", payment: "refunded", start: ago(2, 14), tz: "Europe/London" }, review: "unreviewed", follow: "none" },
];

function listRow(p: Person): ListRow {
  return {
    assessment_id: p.id, created_at: ago(p.created, 9), completed_at: p.complete ? ago(p.created, 9) : null, status: p.complete ? "completed" : "in_progress",
    sections_completed: p.sections, assessment_version: ASSESSMENT_VERSION, last_activity_at: ago(Math.max(0, p.created - 1), 16),
    client_name: p.name, client_email: p.booking && p.email2 ? p.email : p.email, contact_source: [p.pdf && "pdf_request", p.booking && "booking"].filter(Boolean).join(",") || null,
    email_delivery_state: p.pdf ?? null, booking_state: p.booking?.state ?? null, scheduled_start: p.booking?.start ?? null, timezone: p.booking?.tz ?? null,
    payment_state: p.booking?.payment ?? null, report_status: p.complete ? "ready" : null, coach_review_state: p.complete ? p.review : null, follow_up_status: p.follow,
  };
}

function workspace(p: Person): WorkspaceData {
  const answers = answersFor(p.seed);
  const scored = Object.fromEntries(Object.entries(answers).filter(([k]) => k !== "interconnections.reflection"));
  const shown = p.complete ? answers : Object.fromEntries(Object.entries(answers).filter(([k]) => ["sun", "mind", "body", "restoration", "growth", "love"].includes(questionById(k)!.chapterId)));
  const result = computeLifeMap(scored);
  const intake = p.booking ? [{ question: "What would you most like to understand from your Map?", answer: "Why I feel stretched even when things look fine on paper." }] : [];
  const gen = generateDeepDiveScript(result, answers);
  const withBooking = generateDeepDiveScript(result, answers, intake);
  const bookingId = "b0000000-0000-4000-8000-0000000000" + p.id.slice(-2);
  return {
    assessment: { id: p.id, status: p.complete ? "completed" : "in_progress", created_at: ago(p.created, 9), completed_at: p.complete ? ago(p.created, 9) : null,
      sections_completed: p.sections, assessment_version: ASSESSMENT_VERSION, question_bank_version: QUESTION_BANK_VERSION, last_activity_at: ago(p.created - 1, 16) },
    answers: Object.entries(shown).map(([id, v]) => {
      const q = questionById(id) ?? { responseType: "text" };
      const n = typeof v === "string" ? Number(v) : NaN;
      return { question_id: id, question_version: id.startsWith("postmap.") ? "postmap-1" : QUESTION_BANK_VERSION, response_status: v === NOT_APPLICABLE ? "not_applicable" : "answered",
        raw_ordinal: v === NOT_APPLICABLE ? null : q.responseType === "truth" || q.responseType === "importance" ? n + 1 : q.responseType === "energy" ? 3 - n : null,
        value: v, answered_at: ago(p.created, 9) };
    }),
    result: p.complete ? { snapshot: result, sha256: "9a4c1e7b2f0d" + "5".repeat(52), generated_at: ago(p.created, 9), scoring_version: result.versions.scoring } : null,
    coachReport: p.complete ? { id: "r-" + p.id, content: generateCoachReport(result, answers), review_state: p.review, template_version: COACH_REPORT_TEMPLATE_VERSION, created_at: ago(p.created, 9) } : null,
    scripts: p.complete ? [
      ...(p.booking ? [{ id: "s2", version: 2, kind: "generated" as const, booking_id: bookingId, content: withBooking, created_at: ago(p.created - 1, 11) }] : []),
      { id: "s1", version: 1, kind: "generated" as const, booking_id: null, content: gen, created_at: ago(p.created, 9) },
    ] : [],
    clients: [
      ...(p.pdf ? [{ id: "c1", name: null, email: p.email, phone: null, link_source: "pdf_request", linked_at: ago(p.created, 9), verified_at: null }] : []),
      ...(p.booking ? [{ id: "c2", name: p.name, email: p.email2 ?? p.email, phone: null, link_source: "booking", linked_at: ago(p.created - 1, 11), verified_at: null }] : []),
    ],
    bookings: p.booking ? [
      ...(p.booking.rescheduled ? [{ id: "b-old", provider: "calendly", provider_event_id: "https://api.calendly.com/scheduled_events/DEMO-OLD", provider_invitee_id: "inv-old",
        booking_state: "rescheduled", scheduled_start: ahead(5, 15), scheduled_end: ahead(5, 16), timezone: p.booking.tz, meeting_url: null, booked_name: p.name, booked_email: p.email,
        intake_answers: intake, payment_reference: "ch_demo_1", payment_state: "paid", rescheduled_from: null, needs_reconciliation: false, reconciliation_reason: null, created_at: ago(p.created - 1, 11),
        events: [{ event_type: "calendly.created", received_at: ago(p.created - 1, 11), processed_at: ago(p.created - 1, 11), processing_error: null },
          { event_type: "calendly.canceled", received_at: ago(2, 12), processed_at: ago(2, 12), processing_error: null }] }] : []),
      { id: bookingId, provider: "calendly", provider_event_id: "https://api.calendly.com/scheduled_events/DEMO", provider_invitee_id: "inv",
        booking_state: p.booking.state, scheduled_start: p.booking.start, scheduled_end: new Date(Date.parse(p.booking.start) + 36e5).toISOString(), timezone: p.booking.tz,
        meeting_url: "https://zoom.us/j/0000000000", booked_name: p.name, booked_email: p.email2 ?? p.email, intake_answers: intake, payment_reference: "ch_demo_1",
        payment_state: p.booking.payment, rescheduled_from: p.booking.rescheduled ? "b-old0000" : null, needs_reconciliation: false, reconciliation_reason: null, created_at: ago(p.created - 1, 11),
        events: [{ event_type: "calendly.created", received_at: ago(p.created - 1, 11), processed_at: ago(p.created - 1, 11), processing_error: null },
          ...(p.booking.state === "cancelled" ? [{ event_type: "calendly.canceled", received_at: ago(3, 9), processed_at: ago(3, 9), processing_error: null },
            { event_type: "stripe.charge.refunded", received_at: ago(3, 10), processed_at: ago(3, 10), processing_error: null }] : [])] },
    ] : [],
    pdfRequests: p.pdf ? [{ id: "p1", email: p.email!, requested_at: ago(p.created, 9), delivery_state: p.pdf, provider_message_id: "demo-msg", retry_count: 0, marketing_consent: false, last_error: null }] : [],
    consents: [
      ...(p.pdf ? [{ consent_type: "pdf_delivery", notice_version: "draft-2026-10-12", status: "granted", source: "results_page", created_at: ago(p.created, 9) }] : []),
      ...(p.booking ? [{ consent_type: "booking_link", notice_version: "draft-2026-10-12", status: "granted", source: "results_page", created_at: ago(p.created - 1, 11) }] : []),
    ],
    notes: [],
    artifacts: p.complete ? [
      { artifact_type: "client_pdf", version: 1, generation_status: "ready", checksum: "4e1a9c0b7d2f63", created_at: ago(p.created, 9) },
      { artifact_type: "coach_report", version: 1, generation_status: "ready", checksum: null, created_at: ago(p.created, 9) },
      { artifact_type: "deep_dive_script", version: 1, generation_status: "ready", checksum: null, created_at: ago(p.created, 9) },
    ] : [],
    audit: [
      { action: "assessment.viewed", actor_id: "demo-coach", target_type: "assessment", created_at: new Date().toISOString(), metadata: null },
      ...(p.booking ? [{ action: "booking.created", actor_id: null, target_type: "booking", created_at: ago(p.created - 1, 11), metadata: null }] : []),
      ...(p.pdf ? [{ action: "pdf.requested", actor_id: null, target_type: "assessment", created_at: ago(p.created, 9), metadata: null }] : []),
      ...(p.complete ? [{ action: "assessment.completed", actor_id: null, target_type: "assessment", created_at: ago(p.created, 9), metadata: null }] : []),
    ],
    relatedAssessments: [],
    viewer: { userId: "demo-coach", role: "admin" },
  };
}

const RECON: ReconRow[] = [{ id: "r1", booked_name: "Pat Morgan", booked_email: "pat@example.com", scheduled_start: ahead(5, 13), booking_state: "confirmed", payment_state: "paid",
  reconciliation_reason: "No assessment link token on the booking", assessment_id: null, created_at: ago(0, 8) }];

function DemoHeader() {
  return (
    <header className="flex items-center justify-between border-b hairline px-6 py-4 sm:px-10">
      <button onClick={() => navigate("/admin")} className="font-serif text-[20px]">The Current Life Map <span className="text-[11px] uppercase tracking-[0.16em] text-taupe">· Coach workspace</span></button>
      <span className="text-[12px] text-taupe">jana@… · admin (demo)</span>
    </header>
  );
}

export function AdminDemo({ path }: { path: string }) {
  const [filters, setFilters] = useState<ListFilters>({});
  const [recon, setRecon] = useState(RECON);
  const id = path.startsWith("/admin/assessments/") ? path.split("/")[3] : null;
  const rows = useMemo(() => {
    let r = PEOPLE.map(listRow);
    const q = filters.q?.toLowerCase();
    if (q) r = r.filter((x) => x.assessment_id.startsWith(q) || x.client_email?.includes(q) || x.client_name?.toLowerCase().includes(q));
    if (filters.booking) r = r.filter((x) => (filters.booking === "none" ? !x.booking_state : x.booking_state === filters.booking));
    if (filters.completion) r = r.filter((x) => x.status === filters.completion);
    if (filters.report) r = r.filter((x) => (filters.report === "ready" ? x.report_status === "ready" : !x.report_status));
    const k = filters.sort ?? "created_at", dir = filters.dir === "asc" ? 1 : -1;
    return r.sort((a, b) => ((a[k] ?? "") < (b[k] ?? "") ? -dir : dir));
  }, [filters]);
  const person = PEOPLE.find((p) => p.id === id);
  const later = () => new Promise<void>((res) => setTimeout(res, 250));
  return (
    <div className="min-h-dvh bg-linen">
      <DemoBanner />
      <DemoHeader />
      {person ? (
        <Workspace key={person.id} data={workspace(person)} actions={{
          saveScript: async () => { await later(); return 3; }, saveNote: async () => { await later(); return "n1"; },
          setReview: later, setBookingOutcome: later, deleteAssessment: async () => { await later(); navigate("/admin"); },
          pdfHref: null, exportHref: null, listHref: "/admin",
        }} />
      ) : (
        <main className="px-6 py-8 sm:px-10">
          <h1 className="font-serif text-[32px] font-light">Assessments</h1>
          <div className="mt-6">
            <AdminTable rows={rows} total={rows.length} page={1} pages={1} filters={filters} recon={recon} canExport={false}
              onFilter={setFilters} workspaceHref={(i) => `/admin/assessments/${i}`}
              onReconcile={async (bid) => { await later(); setRecon((r) => r.filter((x) => x.id !== bid)); }} />
          </div>
        </main>
      )}
    </div>
  );
}
