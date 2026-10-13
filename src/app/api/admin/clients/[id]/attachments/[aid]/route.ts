import { NextResponse } from "next/server";
import { asCoach } from "@/server/db";
import { coachForApi } from "@/server/auth";
import { fileStoreForRequest } from "@/server/files";
import { deleteAttachment, getAttachment } from "@/server/admin/clients";

const ok = (s: string) => /^[0-9a-f-]{36}$/.test(s);

/** Download (decrypted on the server, never cached, always as an attachment). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const s = await coachForApi(req);
  if (s instanceof NextResponse) return s;
  const { id, aid } = await params;
  if (!ok(id) || !ok(aid)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const store = await fileStoreForRequest();
  if (!store) return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
  const f = await asCoach(s.db, s.ctx, (sql) => getAttachment(sql, store, s.ctx.userId, id, aid));
  if (!f) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(Buffer.from(f.bytes), { headers: {
    "Content-Type": f.contentType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const s = await coachForApi(req, { mutation: true });
  if (s instanceof NextResponse) return s;
  const { id, aid } = await params;
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  if (!ok(id) || !ok(aid) || body?.action !== "delete") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const store = await fileStoreForRequest();
  if (!store) return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
  await asCoach(s.db, s.ctx, (sql) => deleteAttachment(sql, store, s.ctx.userId, id, aid));
  return NextResponse.json({ ok: true });
}
