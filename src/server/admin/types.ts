/** Serializable view models shared by the admin pages, the client workspace and the preview demo. */
import type { LifeMapResult } from "@/engine/compute";
import type { CoachReport } from "@/engine/coach/report";
import type { DeepDiveScript } from "@/engine/coach/script";
import type { UnderstandingDocument, ValidationStatus } from "@/engine/coach/understanding";

export interface ListRow {
  assessment_id: string; created_at: string; completed_at: string | null; status: string; sections_completed: number; assessment_version: string;
  last_activity_at: string; client_id?: string | null; client_name: string | null; client_email: string | null; coaching_enrolled: boolean; client_stage?: Stage | null; contact_source: string | null; email_delivery_state: string | null;
  booking_state: string | null; scheduled_start: string | null; timezone: string | null; payment_state: string | null; report_status: string | null;
  coach_review_state: string | null; follow_up_status: string | null;
  source?: string | null; campaign?: string | null;
}
/** Per-channel funnel for the portal home (first-touch source of each assessment). */
export interface ChannelRow { source: string; started: number; completed: number; pdf: number; booked: number; paid: number }
export interface ListFilters {
  q?: string; booking?: string; completion?: "completed" | "in_progress"; report?: "ready" | "none"; from?: string; to?: string;
  sort?: "created_at" | "completed_at" | "last_activity_at" | "scheduled_start"; dir?: "asc" | "desc"; page?: number;
}
export interface SearchHit { assessment_id: string; created_at: string; status: string; client_name: string | null; client_email: string | null; booking_state: string | null }
export interface ReconRow { id: string; booked_name: string | null; booked_email: string | null; scheduled_start: string | null; booking_state: string; payment_state: string; reconciliation_reason: string | null; assessment_id: string | null; created_at: string }

export interface AnswerRow { question_id: string; question_version: string; response_status: string; raw_ordinal: number | null; value: string | string[] | null; answered_at: string }
export interface ScriptVersion { id: string; version: number; kind: "generated" | "coach_edited"; booking_id: string | null; content: DeepDiveScript; created_at: string }
export interface BookingView {
  id: string; provider: string; provider_event_id: string; provider_invitee_id: string; booking_state: string; scheduled_start: string | null; scheduled_end: string | null;
  timezone: string | null; meeting_url: string | null; booked_name: string | null; booked_email: string | null; intake_answers: { question: string; answer: string }[] | null;
  payment_reference: string | null; payment_state: string; rescheduled_from: string | null; needs_reconciliation: boolean; reconciliation_reason: string | null; created_at: string;
  events: { event_type: string; received_at: string; processed_at: string | null; processing_error: string | null }[];
}
export interface NoteView {
  id: string; booking_id: string | null; notes: string; validated_findings: Record<string, string> | null;
  agreed_next_steps: { steps: string[]; coachingInquiry: boolean } | null; follow_up_status: string; updated_at: string;
}
export interface WorkspaceData {
  assessment: { id: string; status: string; created_at: string; completed_at: string | null; sections_completed: number; assessment_version: string; question_bank_version: string; last_activity_at: string };
  answers: AnswerRow[];
  result: { snapshot: LifeMapResult; sha256: string; generated_at: string; scoring_version: string; narrative_version?: string | null } | null;
  coachReport: { id: string; content: CoachReport; review_state: string; template_version: string; created_at: string; kind?: string } | null;
  /** All versions, newest first: the generated original and every coach edit. */
  coachReports?: { id: string; content: CoachReport; kind: string; created_at: string }[];
  validations?: { insight_id: string; insight_title: string; status: ValidationStatus; note: string | null; updated_at: string }[];
  understandingDocs?: { version: number; kind: string; content: UnderstandingDocument; created_at: string }[];
  scripts: ScriptVersion[];
  clients: { id: string; name: string | null; email: string | null; phone: string | null; link_source: string; linked_at: string; verified_at: string | null; coaching_enrolled: boolean; coaching_enrolled_at: string | null }[];
  bookings: BookingView[];
  pdfRequests: { id: string; email: string; requested_at: string; delivery_state: string; provider_message_id: string | null; retry_count: number; marketing_consent: boolean; last_error: string | null }[];
  consents: { consent_type: string; notice_version: string; status: string; source: string; created_at: string }[];
  notes: NoteView[];
  artifacts: { artifact_type: string; version: number; generation_status: string; checksum: string | null; created_at: string }[];
  audit: { action: string; actor_id: string | null; target_type: string; created_at: string; metadata: Record<string, unknown> | null }[];
  relatedAssessments: { id: string; created_at: string; status: string }[];
  /** The client profile this Map belongs to (most recent non-merged link), and profiles sharing an email (suggestions only). */
  profile?: { client_id: string; name: string | null; stage: Stage } | null;
  possibleProfiles?: { client_id: string; name: string | null; email: string | null; stage: Stage }[];
  viewer: { userId: string; role: "coach" | "admin" };
}

// ── Client profiles (Oct 13) ─────────────────────────────────────────────────
export type Stage = "prospect" | "lead" | "client";
export const STAGES: { value: Stage; label: string; hint: string }[] = [
  { value: "prospect", label: "Prospect", hint: "Did the Self-Interview" },
  { value: "lead", label: "Lead", hint: "Applied for 1:1 coaching" },
  { value: "client", label: "Client", hint: "On 1:1 coaching" },
];
export interface ClientListRow {
  client_id: string; name: string | null; email: string | null; stage: Stage; stage_changed_at: string | null; created_at: string;
  maps: number; last_map_at: string | null; sessions: number; next_session: string | null; last_session: string | null;
}
export interface MapSummaryOrbit { orbit: string; name: string; importanceOrdinal: number | null; energyRaw: number | null; responseSupportIndex: number | null }
export interface ClientMap {
  assessment_id: string; created_at: string; completed_at: string | null; status: string; link_sources: string[];
  orbits: MapSummaryOrbit[] | null; sunIndex: number | null;
}
export interface AttachmentView { id: string; filename: string; content_type: string; size_bytes: number; purpose: string; session_id: string | null; note_id: string | null; created_at: string }
export interface SessionView {
  id: string; session_date: string | null; title: string | null; kind: "deep_dive" | "coaching" | "review" | "other"; assessment_id: string | null;
  plan: string; notes: string; homework: string; created_at: string; updated_at: string; attachments: AttachmentView[];
}
export interface ClientNoteView { id: string; body: string; created_at: string; updated_at: string; attachments: AttachmentView[] }
export interface PossibleMatch { client_id: string; name: string | null; email: string | null; stage: Stage; assessments: { id: string; created_at: string; status: string }[] }
/** Records sharing an email (22 Oct): shown as a merge suggestion, merged only when Jana confirms. First = suggested to keep. */
export interface DuplicateGroup {
  email: string;
  clients: { client_id: string; name: string | null; email: string | null; stage: Stage; maps: number; sessions: number; created_at: string }[];
}
export interface ClientProfileData {
  client: { id: string; name: string | null; email: string | null; phone: string | null; stage: Stage; stage_changed_at: string | null; created_at: string; coaching_enrolled_at: string | null; invite: { token: string | null; created_at: string } | null };
  maps: ClientMap[];
  sessions: SessionView[];
  notes: ClientNoteView[];
  attachments: AttachmentView[];       // profile-level files (not tied to a session or note)
  possibleMatches: PossibleMatch[];    // same email on another record — attach only when Jana confirms
  viewer: { userId: string; role: "coach" | "admin" };
}
export interface SessionInput { id?: string; session_date: string | null; title: string | null; kind: SessionView["kind"]; assessment_id: string | null; plan: string; notes: string; homework: string }

/** Introductory conversation booked in Calendly (21 Oct), with the answers from Calendly's booking form. */
export interface IntroRow {
  id: string; created_at: string; booked_name: string | null; booked_email: string | null; scheduled_start: string | null; timezone: string | null;
  booking_state: string; meeting_url: string | null; assessment_id: string | null; intake_answers: { question: string; answer: string }[] | null;
}
