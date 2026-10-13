import { NextResponse } from "next/server";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { fileStoreForRequest } from "@/server/files";
import { ALLOWED_TYPES, MAX_ATTACHMENT_BYTES, addAttachment, type AttachmentPurpose } from "@/server/admin/clients";

const PURPOSES: AttachmentPurpose[] = ["profile", "note", "session_plan", "session_notes", "homework"];
const uuidOrNull = (v: FormDataEntryValue | null) => (typeof v === "string" && /^[0-9a-f-]{36}$/.test(v) ? v : null);

/** Upload one file (multipart). Encrypted on the server before it is stored; type and size are checked here. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await coachForApi(req, { mutation: true });
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_ATTACHMENT_BYTES + 64 * 1024) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const purpose = form?.get("purpose") as AttachmentPurpose | null;
  if (!form || !(file instanceof File) || !purpose || !PURPOSES.includes(purpose)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  if (!ALLOWED_TYPES[file.type]) return NextResponse.json({ error: "type_not_allowed" }, { status: 415 });
  const store = await fileStoreForRequest();
  if (!store) return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const r = await asCoach(s.db, s.ctx, (sql) => addAttachment(sql, store, s.ctx.userId, id, {
    purpose, sessionId: uuidOrNull(form.get("sessionId")), noteId: uuidOrNull(form.get("noteId")), filename: file.name, contentType: file.type, bytes }));
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
