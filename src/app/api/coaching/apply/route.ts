import { NextResponse } from "next/server";
import { getDb, NOT_CONFIGURED } from "@/server/db";
import { calendlyAdapter } from "@/server/booking/calendly";
import { ApplicationBody, submitApplication } from "@/server/coaching";

/**
 * 1:1 coaching application. Saves it, then returns the Calendly link for the complimentary introductory conversation
 * (null while Calendly isn't set up; the application is still saved). Name, email and message come in the body only.
 * "website" is a hidden field people never see; a value there means an automated submission.
 */
export async function POST(req: Request) {
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (raw && typeof raw.website === "string" && raw.website.trim()) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const parsed = ApplicationBody.safeParse(raw);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return NextResponse.json({ error: field === "email" ? "invalid_email" : field === "name" ? "invalid_name" : "invalid" }, { status: 400 });
  }
  const db = getDb();
  if (!db) return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  const r = await submitApplication(db, calendlyAdapter(), parsed.data).catch(() => null);
  if (!r) return NextResponse.json({ error: "failed" }, { status: 500 });
  if (!r.ok) return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  return NextResponse.json({ received: true, schedulingUrl: r.schedulingUrl });
}
