import type { IntakeAnswer } from "@/engine/coach/script";

/** Provider-neutral booking event. Calendly today; Cal.com / Acuity adapters only need to produce this shape. */
export interface NormalizedBookingEvent {
  provider: string;
  type: "created" | "canceled";
  idempotencyKey: string;
  webhookEventId: string;
  inviteeId: string;
  eventId: string;
  /** Opaque signed link token carried through the scheduler (never an assessment id). */
  linkToken: string | null;
  name: string | null;
  email: string | null;
  timezone: string | null;
  start: string | null;
  end: string | null;
  meetingUrl: string | null;
  active: boolean;
  /** canceled only: the cancellation is part of a reschedule */
  rescheduled: boolean;
  /** created only: invitee this booking replaces */
  oldInviteeId: string | null;
  intake: IntakeAnswer[];
  payment: { reference: string | null; successful: boolean; amount: number | null; currency: string | null } | null;
}

export interface SchedulingAdapter {
  id: string;
  /** Verify the webhook came from the provider (signature + timestamp tolerance). */
  verify(headers: Headers, rawBody: string, now?: number): boolean;
  /** Map a verified payload to a normalized event; null for event types we ignore. */
  normalize(json: unknown): NormalizedBookingEvent | null;
  /** Booking page URL carrying the opaque link token. */
  schedulingUrl(linkToken: string): string;
}
