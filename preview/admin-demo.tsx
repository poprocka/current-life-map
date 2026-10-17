/** Preview-only coach workspace with invented sample data, clearly labelled. Same components as production. */
import React, { useMemo, useState } from "react";
import { ChannelSummary } from "@/components/admin/ChannelSummary";
import { AdminTable } from "@/components/admin/AdminTable";
import { Workspace } from "@/components/admin/Workspace";
import { ClientProfile } from "@/components/admin/ClientProfile";
import { ClientsTable } from "@/components/admin/ClientsTable";
import { AdminHeaderLayout, brandClass, brandSuffix, DemoBanner, navItemClass } from "@/components/admin/ui";
import type { AttachmentView, ClientListRow, ClientMap, ClientProfileData, ChannelRow, ListFilters, ListRow, ReconRow, SessionView, Stage, WorkspaceData } from "@/server/admin/types";
import { computeLifeMap } from "@/engine/compute";
import { generateCoachReport, COACH_REPORT_TEMPLATE_VERSION } from "@/engine/coach/report";
import { generateDeepDiveScript } from "@/engine/coach/script";
import { generateUnderstandingDocument } from "@/engine/coach/understanding";
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
  booking?: { state: string; payment: string; start: string; tz: string; rescheduled?: boolean }; pdf?: string; review: string; follow: string; email2?: string; coaching?: string }
const PEOPLE: Person[] = [
  { id: "3f9c2a71-8d4e-4b1a-9c55-2e7f0a6b1d01", name: "Alex Rivera", email: "alex@example.com", seed: 0, complete: true, sections: 10, created: 4,
    booking: { state: "confirmed", payment: "paid", start: ahead(3, 9), tz: "Europe/Lisbon" }, pdf: "delivered", review: "in_review", follow: "none", email2: "alex.r@work.example" },
  { id: "7b1e5d22-0c3f-4e8a-b6a1-5d9c3e2f4a02", name: null, email: null, seed: 1, complete: true, sections: 10, created: 2, review: "unreviewed", follow: "none" },
  { id: "c4a8f613-5e2b-4d7c-8f19-6a0b2c3d5e03", name: null, email: null, seed: 3, complete: false, sections: 6, created: 1, review: "", follow: "none" },
  { id: "e2d7b904-1a6c-4f3e-9d28-7b1c0d4e6f04", name: null, email: "sam@example.com", seed: 2, complete: true, sections: 10, created: 6, pdf: "sent", review: "unreviewed", follow: "none" },
  { id: "a9f3c185-6b2d-4e1f-8a37-8c2d1e5f7a05", name: "Mira Chen", email: "mira@example.com", seed: 4, complete: true, sections: 10, created: 9,
    booking: { state: "confirmed", payment: "paid", start: ahead(8, 15), tz: "America/New_York", rescheduled: true }, review: "reviewed", follow: "planned", coaching: "2026-10-01" },
  { id: "5d2b7e46-9c1a-4b3f-a6e8-9d3e2f6a8b06", name: "Jordan Lee", email: "jordan@example.com", seed: 5, complete: true, sections: 10, created: 14,
    booking: { state: "cancelled", payment: "refunded", start: ago(2, 14), tz: "Europe/London" }, review: "unreviewed", follow: "none" },
  // Mira's 3-month follow-up, completed through her private link
  { id: "d81f4b27-3e6a-4c90-b2d5-0f1e2a3b4c08", name: "Mira Chen", email: "mira@example.com", seed: 7, complete: true, sections: 10, created: 1, review: "unreviewed", follow: "none" },
  // An older Map someone did with Alex's email (PDF request) — a separate record until Jana confirms it's theirs
  { id: "6e4c9a10-2b7d-4f15-9a3c-1d2e3f4a5b07", name: null, email: "alex@example.com", seed: 6, complete: true, sections: 10, created: 120, pdf: "delivered", review: "unreviewed", follow: "none" },
];

// ── Demo client profiles (in memory; nothing is saved) ─────────────────────
interface DemoClient { id: string; name: string | null; email: string | null; stage: Stage; since: string | null; changed: string; created: string; maps: { id: string; via: string[] }[];
  sessions: SessionView[]; notes: ClientProfileData["notes"]; files: AttachmentView[]; invite: string | null; mergedInto?: string }
const CL = { alex: "c1a0e5b2-7d3f-4a19-8c6e-1f2a3b4c5d01", alexOld: "c1a0e5b2-7d3f-4a19-8c6e-1f2a3b4c5d02", mira: "c1a0e5b2-7d3f-4a19-8c6e-1f2a3b4c5d03",
  sam: "c1a0e5b2-7d3f-4a19-8c6e-1f2a3b4c5d04", jordan: "c1a0e5b2-7d3f-4a19-8c6e-1f2a3b4c5d05" };
const iso = (d: string) => new Date(d).toISOString();
const DEMO_CLIENTS: DemoClient[] = [
  { id: CL.mira, name: "Mira Chen", email: "mira@example.com", stage: "client", since: "2026-10-01", changed: ago(12), created: ago(9),
    maps: [{ id: "a9f3c185-6b2d-4e1f-8a37-8c2d1e5f7a05", via: ["booking"] }, { id: "d81f4b27-3e6a-4c90-b2d5-0f1e2a3b4c08", via: ["client_invite"] }],
    invite: "DEMOinviteTokenOnly-for-preview-3m",
    sessions: [
      { id: "s-mira-2", session_date: ahead(5).slice(0, 10), title: "Restoration as the lever", kind: "coaching", assessment_id: "d81f4b27-3e6a-4c90-b2d5-0f1e2a3b4c08",
        plan: "Compare Map 1 and Map 2: Restoration brighter? Explore what changed in her evenings.\nTry: the 'non-negotiables' exercise.", notes: "", homework: "",
        created_at: ago(1, 18), updated_at: ago(1, 18), attachments: [] },
      { id: "s-mira-1", session_date: ago(9).slice(0, 10), title: "Deep Dive", kind: "deep_dive", assessment_id: "a9f3c185-6b2d-4e1f-8a37-8c2d1e5f7a05",
        plan: "Ambition and restoration; what 'busy season' protects.", notes: "Recognised the trade-off immediately. Challenged the idea that work is chosen: 'it's expected'. Wants rest without guilt.",
        homework: "Two evenings a week with no work. Note what comes up.", created_at: ago(11, 9), updated_at: ago(9, 17), attachments: [] },
    ],
    notes: [{ id: "n-mira-1", body: "Prefers early-morning sessions. Training for a half marathon in spring; protect recovery around long runs.", created_at: ago(9, 18), updated_at: ago(9, 18), attachments: [] }],
    files: [] },
  { id: CL.alex, name: "Alex Rivera", email: "alex@example.com", stage: "lead", since: null, changed: ago(3), created: ago(4), maps: [{ id: "3f9c2a71-8d4e-4b1a-9c55-2e7f0a6b1d01", via: ["booking", "pdf_request"] }],
    sessions: [], notes: [], files: [], invite: null },
  { id: CL.alexOld, name: null, email: "alex@example.com", stage: "prospect", since: null, changed: ago(120), created: ago(120), maps: [{ id: "6e4c9a10-2b7d-4f15-9a3c-1d2e3f4a5b07", via: ["pdf_request"] }],
    sessions: [], notes: [], files: [], invite: null },
  { id: CL.sam, name: null, email: "sam@example.com", stage: "prospect", since: null, changed: ago(6), created: ago(6), maps: [{ id: "e2d7b904-1a6c-4f3e-9d28-7b1c0d4e6f04", via: ["pdf_request"] }],
    sessions: [], notes: [], files: [], invite: null },
  { id: CL.jordan, name: "Jordan Lee", email: "jordan@example.com", stage: "lead", since: null, changed: ago(13), created: ago(14), maps: [{ id: "5d2b7e46-9c1a-4b3f-a6e8-9d3e2f6a8b06", via: ["booking"] }],
    sessions: [], notes: [], files: [], invite: null },
];
void iso;
const blobUrls = new Map<string, string>();
const live = () => DEMO_CLIENTS.filter((c) => !c.mergedInto);
const clientOfMap = (aid: string) => live().find((c) => c.maps.some((m) => m.id === aid)) ?? null;

function clientMap(m: { id: string; via: string[] }): ClientMap {
  const p = PEOPLE.find((x) => x.id === m.id)!;
  const r = p.complete ? computeLifeMap(Object.fromEntries(Object.entries(answersFor(p.seed)).filter(([k]) => k !== "interconnections.reflection" && !k.startsWith("postmap.")))) : null;
  return { assessment_id: p.id, created_at: ago(p.created, 9), completed_at: p.complete ? ago(p.created, 9) : null, status: p.complete ? "completed" : "in_progress", link_sources: m.via,
    orbits: r ? r.orbits.map((o) => ({ orbit: o.orbit, name: o.name, importanceOrdinal: o.importanceOrdinal, energyRaw: o.energyRaw, responseSupportIndex: o.responseSupportIndex })) : null, sunIndex: r?.sun.responseIndex ?? null };
}
function profileData(c: DemoClient): ClientProfileData {
  const maps = c.maps.map(clientMap).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const matches = c.email ? live().filter((o) => o.id !== c.id && o.email === c.email).map((o) => ({ client_id: o.id, name: o.name, email: o.email, stage: o.stage,
    assessments: o.maps.filter((m) => !c.maps.some((x) => x.id === m.id)).map((m) => { const p = PEOPLE.find((x) => x.id === m.id)!; return { id: p.id, created_at: ago(p.created, 9), status: p.complete ? "completed" : "in_progress" }; }) }))
    .filter((m) => m.assessments.length) : [];
  return { client: { id: c.id, name: c.name, email: c.email, phone: null, stage: c.stage, stage_changed_at: c.changed, created_at: c.created, coaching_enrolled_at: c.since,
      invite: c.invite ? { token: c.invite, created_at: c.changed } : null },
    // Copies: the page keeps its own state; the demo store is updated separately by the actions.
    maps, sessions: c.sessions.map((x) => ({ ...x, attachments: [...x.attachments] })), notes: c.notes.map((x) => ({ ...x, attachments: [...x.attachments] })),
    attachments: c.files.filter((f) => !f.session_id && !f.note_id), possibleMatches: matches, viewer: { userId: "demo-coach", role: "admin" } };
}
function clientRows(): ClientListRow[] {
  const todayS = new Date().toISOString().slice(0, 10);
  return live().map((c) => {
    const maps = c.maps.map(clientMap);
    const dates = c.sessions.map((s) => s.session_date).filter((d): d is string => !!d);
    return { client_id: c.id, name: c.name, email: c.email, stage: c.stage, stage_changed_at: c.changed, created_at: c.created, maps: maps.length,
      last_map_at: maps.map((m) => m.completed_at ?? m.created_at).sort().at(-1) ?? null, sessions: c.sessions.length,
      next_session: dates.filter((d) => d >= todayS).sort()[0] ?? null, last_session: dates.filter((d) => d < todayS).sort().at(-1) ?? null };
  }).sort((a, b) => ["client", "lead", "prospect"].indexOf(a.stage) - ["client", "lead", "prospect"].indexOf(b.stage));
}

function listRow(p: Person): ListRow {
  return {
    assessment_id: p.id, created_at: ago(p.created, 9), completed_at: p.complete ? ago(p.created, 9) : null, status: p.complete ? "completed" : "in_progress",
    sections_completed: p.sections, assessment_version: ASSESSMENT_VERSION, last_activity_at: ago(Math.max(0, p.created - 1), 16),
    coaching_enrolled: !!p.coaching, client_name: p.name, client_email: p.booking && p.email2 ? p.email : p.email, contact_source: [p.pdf && "pdf_request", p.booking && "booking"].filter(Boolean).join(",") || null,
    email_delivery_state: p.pdf ?? null, booking_state: p.booking?.state ?? null, scheduled_start: p.booking?.start ?? null, timezone: p.booking?.tz ?? null,
    payment_state: p.booking?.payment ?? null, report_status: p.complete ? "ready" : null, coach_review_state: p.complete ? p.review : null, follow_up_status: p.follow,
    client_stage: clientOfMap(p.id)?.stage ?? null,
    source: DEMO_SOURCES[PEOPLE.indexOf(p) % DEMO_SOURCES.length], campaign: null,
  };
}
const DEMO_SOURCES = ["instagram", "qr_card", "linkedin", null, "instagram", "website", "instagram", "newsletter"];
function demoChannels(rows: ListRow[]): ChannelRow[] {
  const m = new Map<string, ChannelRow>();
  for (const r of rows) {
    const k = r.source ?? "direct", x = m.get(k) ?? { source: k, started: 0, completed: 0, pdf: 0, booked: 0, paid: 0 };
    x.started++; if (r.status === "completed") x.completed++; if (r.email_delivery_state) x.pdf++;
    if (r.booking_state && r.booking_state !== "cancelled") x.booked++; if (r.payment_state === "paid") x.paid++;
    m.set(k, x);
  }
  return [...m.values()].sort((a, b) => b.started - a.started);
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
      ...(p.pdf ? [{ id: "c1", name: null, email: p.email, phone: null, link_source: "pdf_request", linked_at: ago(p.created, 9), verified_at: null, coaching_enrolled: false, coaching_enrolled_at: null }] : []),
      ...(p.booking ? [{ id: "c2", name: p.name, email: p.email2 ?? p.email, phone: null, link_source: "booking", linked_at: ago(p.created - 1, 11), verified_at: null, coaching_enrolled: !!p.coaching, coaching_enrolled_at: p.coaching ?? null }] : []),
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
    profile: (() => { const c = clientOfMap(p.id); return c ? { client_id: c.id, name: c.name, stage: c.stage } : null; })(),
    possibleProfiles: (() => { const c = clientOfMap(p.id); return c?.email ? live().filter((o) => o.id !== c.id && o.email === c.email && o.stage !== "prospect").map((o) => ({ client_id: o.id, name: o.name, email: o.email, stage: o.stage })) : []; })(),
    viewer: { userId: "demo-coach", role: "admin" },
  };
}

const RECON: ReconRow[] = [{ id: "r1", booked_name: "Pat Morgan", booked_email: "pat@example.com", scheduled_start: ahead(5, 13), booking_state: "confirmed", payment_state: "paid",
  reconciliation_reason: "No assessment link token on the booking", assessment_id: null, created_at: ago(0, 8) }];

function DemoHeader({ path }: { path: string }) {
  const clients = path.startsWith("/admin/clients");
  return (
    <AdminHeaderLayout
      home={<button onClick={() => navigate("/admin")} className={`${brandClass} text-left`}>The Current Life Map <span className={brandSuffix}>· Coach workspace</span></button>}
      links={<>
        <button onClick={() => navigate("/admin")} className={navItemClass(!clients)} aria-current={!clients ? "page" : undefined}>Assessments</button>
        <button onClick={() => navigate("/admin/clients")} className={navItemClass(clients)} aria-current={clients ? "page" : undefined}>Clients</button>
      </>}
      account={<span>admin (demo)</span>}
    />
  );
}

let demoVersion = 0;
export function AdminDemo({ path }: { path: string }) {
  const [filters, setFilters] = useState<ListFilters>({});
  const [recon, setRecon] = useState(RECON);
  const id = path.startsWith("/admin/assessments/") ? path.split("/")[3] : null;
  const clientId = path.startsWith("/admin/clients/") ? path.split("/")[3] : null;
  const [, bump] = useState(0);
  const refresh = () => bump((n) => n + 1);
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
      <DemoHeader path={path} />
      {path === "/admin/clients" ? (
        <main className="px-4 py-6 sm:px-10 sm:py-8">
          <h1 className="font-serif text-[32px] font-light">Clients</h1>
          <div className="mt-6"><ClientsTable rows={clientRows()} profileHref={(i) => `/admin/clients/${i}`} /></div>
        </main>
      ) : clientId && DEMO_CLIENTS.find((c) => c.id === clientId) ? (() => {
        const c0 = DEMO_CLIENTS.find((c) => c.id === clientId)!;
        const c = c0.mergedInto ? DEMO_CLIENTS.find((x) => x.id === c0.mergedInto)! : c0;
        const findSession = (sid: string) => c.sessions.find((x) => x.id === sid)!;
        return <ClientProfile key={c.id + c.maps.length + c.stage} data={profileData(c)} actions={{
          setStage: async (st, since) => { await later(); c.stage = st; c.since = since; c.changed = new Date().toISOString(); if (st === "client" && !c.invite) c.invite = "DEMO" + Math.random().toString(36).slice(2, 26); },
          saveDetails: async (d) => { await later(); c.name = d.name; c.email = d.email; },
          createInvite: async () => { await later(); c.invite = "DEMO" + Math.random().toString(36).slice(2, 26); return c.invite; },
          revokeInvite: async () => { await later(); c.invite = null; },
          attach: async (aid) => {
            await later();
            if (!c.maps.some((m) => m.id === aid)) c.maps.push({ id: aid, via: ["coach_manual"] });
            for (const o of DEMO_CLIENTS) if (o.id !== c.id && !o.mergedInto && o.stage === "prospect" && o.maps.every((m) => c.maps.some((x) => x.id === m.id)) && !o.sessions.length && !o.notes.length) o.mergedInto = c.id;
          },
          detach: async (aid) => { await later(); c.maps = c.maps.filter((m) => m.id !== aid || !m.via.some((v) => v === "coach_manual" || v === "client_invite")); },
          search: async (q) => { const t = q.toLowerCase(); return PEOPLE.filter((x) => x.id.startsWith(t) || x.email?.includes(t) || x.name?.toLowerCase().includes(t))
            .map((x) => ({ assessment_id: x.id, created_at: ago(x.created, 9), status: x.complete ? "completed" : "in_progress", client_name: x.name, client_email: x.email, booking_state: x.booking?.state ?? null })); },
          saveSession: async (sx) => {
            await later();
            if (sx.id) { Object.assign(findSession(sx.id), sx, { title: sx.title || null, updated_at: new Date().toISOString() }); return sx.id; }
            const sid = "s-" + Math.random().toString(36).slice(2, 10); const now = new Date().toISOString();
            c.sessions.unshift({ ...sx, id: sid, title: sx.title || null, created_at: now, updated_at: now, attachments: [] }); return sid;
          },
          deleteSession: async (sid) => { await later(); c.sessions = c.sessions.filter((x) => x.id !== sid); },
          saveNote: async (n) => {
            await later(); const now = new Date().toISOString();
            if (n.id) { Object.assign(c.notes.find((x) => x.id === n.id)!, { body: n.body, updated_at: now }); return n.id; }
            const nid = "n-" + Math.random().toString(36).slice(2, 10); c.notes.unshift({ id: nid, body: n.body.trim(), created_at: now, updated_at: now, attachments: [] }); return nid;
          },
          deleteNote: async (nid) => { await later(); c.notes = c.notes.filter((x) => x.id !== nid); },
          upload: async (file, purpose, ids) => {
            await later(); const aid = "f-" + Math.random().toString(36).slice(2, 10);
            blobUrls.set(aid, URL.createObjectURL(file));
            const a: AttachmentView = { id: aid, filename: file.name, content_type: file.type, size_bytes: file.size, purpose, session_id: ids.sessionId ?? null, note_id: ids.noteId ?? null, created_at: new Date().toISOString() };
            if (ids.sessionId) findSession(ids.sessionId).attachments.push(a); else if (ids.noteId) c.notes.find((x) => x.id === ids.noteId)!.attachments.push(a); else c.files.push(a);
            return a;
          },
          deleteAttachment: async (aid) => { await later(); c.files = c.files.filter((f) => f.id !== aid); for (const x of c.sessions) x.attachments = x.attachments.filter((f) => f.id !== aid); for (const x of c.notes) x.attachments = x.attachments.filter((f) => f.id !== aid); },
          attachmentHref: (aid) => blobUrls.get(aid) ?? "#",
          workspaceHref: (aid) => `/admin/assessments/${aid}`,
          inviteUrl: (token) => `https://self-interview.com/#invite=${token}`,
          listHref: "/admin/clients",
          refresh,
        }} />;
      })() : person ? (
        <Workspace key={person.id} data={workspace(person)} actions={{
          saveScript: async () => { await later(); return 3; }, saveNote: async () => { await later(); return "n1"; },
          setReview: later, setBookingOutcome: later, setName: later,
          createProfile: async (name) => {
            await later(); const nid = "c1a0e5b2-7d3f-4a19-8c6e-" + Math.random().toString(16).slice(2, 14).padEnd(12, "0");
            DEMO_CLIENTS.push({ id: nid, name, email: person.email, stage: "prospect", since: null, changed: new Date().toISOString(), created: new Date().toISOString(), maps: [{ id: person.id, via: ["coach_manual"] }], sessions: [], notes: [], files: [], invite: null });
            return nid;
          },
          setStage: async (cid, st) => { await later(); const c = DEMO_CLIENTS.find((x) => x.id === cid)!; c.stage = st; c.changed = new Date().toISOString(); if (st === "client" && !c.invite) c.invite = "DEMO" + Math.random().toString(36).slice(2, 26); },
          attachToProfile: async (cid) => { await later(); DEMO_CLIENTS.find((x) => x.id === cid)!.maps.push({ id: person.id, via: ["coach_manual"] }); },
          profileHref: (cid) => `/admin/clients/${cid}`,
          saveReportVersion: later, saveValidation: later,
          generateUnderstanding: async (validations) => {
            await later();
            const w = workspace(person);
            return { version: (demoVersion += 1), content: generateUnderstandingDocument({ intelligence: w.coachReport!.content.intelligence!, validations,
              agreedNextSteps: ["Protect two evenings a week for rest"], coachingInquiry: true, enrolled: person.coaching ? { since: person.coaching } : null }) };
          },
          saveUnderstanding: async () => { await later(); return (demoVersion += 1); }, deleteAssessment: async () => { await later(); navigate("/admin"); },
          pdfHref: null, exportHref: null, listHref: "/admin",
        }} />
      ) : (
        <main className="px-4 py-6 sm:px-10 sm:py-8">
          <h1 className="font-serif text-[32px] font-light">Assessments</h1>
          <div className="mt-6"><ChannelSummary rows={demoChannels(PEOPLE.map(listRow))} /></div>
          <div className="mt-6">
            <AdminTable rows={rows} total={rows.length} page={1} pages={1} filters={filters} recon={recon} canExport={false}
              onFilter={setFilters} workspaceHref={(i) => `/admin/assessments/${i}`}
              onSearch={async (q) => {
                const t = q.toLowerCase();
                return PEOPLE.filter((x) => x.id.startsWith(t) || x.email?.includes(t) || x.name?.toLowerCase().includes(t))
                  .map((x) => ({ assessment_id: x.id, created_at: ago(x.created, 9), status: x.complete ? "completed" : "in_progress", client_name: x.name, client_email: x.email, booking_state: x.booking?.state ?? null }));
              }}
              onReconcile={async (bid) => { await later(); setRecon((r) => r.filter((x) => x.id !== bid)); }} />
          </div>
        </main>
      )}
    </div>
  );
}
