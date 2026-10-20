"use client";
/** Admin components wired to the real API routes (the preview passes demo actions instead). */
import { useRouter } from "next/navigation";
import { AdminTable, type AdminTableProps } from "./AdminTable";
import { Workspace } from "./Workspace";
import { ClientProfile } from "./ClientProfile";
import { ClientsTable } from "./ClientsTable";
import type { ClientListRow, ClientProfileData } from "@/server/admin/types";
import type { ListFilters, WorkspaceData } from "@/server/admin/types";
import { supabaseBrowser } from "@/lib/supabase-browser";

const qs = (f: ListFilters) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export function ConnectedTable(props: Omit<AdminTableProps, "onFilter" | "onReconcile" | "onResolve" | "onSearch" | "workspaceHref" | "exportHref">) {
  const router = useRouter();
  return (
    <AdminTable {...props} exportHref={`/api/admin/export${qs({ ...props.filters, page: undefined })}`}
      workspaceHref={(id) => `/admin/assessments/${id}`}
      onFilter={(f) => router.push(`/admin${qs(f)}`)}
      onSearch={async (q) => { const r = await fetch(`/api/admin/assessments/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }) }); if (!r.ok) throw new Error(); return (await r.json()).hits; }}
      onReconcile={async (bookingId, assessmentId) => { await post(`/api/admin/bookings/${bookingId}`, { action: "reconcile", assessmentId }); router.refresh(); }}
      onResolve={async (bookingId) => { await post(`/api/admin/bookings/${bookingId}`, { action: "resolve" }); router.refresh(); }} />
  );
}

export function ConnectedWorkspace({ data }: { data: WorkspaceData }) {
  const router = useRouter();
  const id = data.assessment.id;
  return (
    <Workspace data={data} actions={{
      saveScript: async (content, bookingId) => (await post(`/api/admin/assessments/${id}/script`, { content, bookingId })).version,
      saveNote: async (n) => (await post(`/api/admin/assessments/${id}/notes`, n)).id,
      setReview: async (reportId, state) => { await post(`/api/admin/assessments/${id}/review`, { reportId, state }); },
      setBookingOutcome: async (bookingId, state) => { await post(`/api/admin/bookings/${bookingId}`, { action: "outcome", state }); },
      saveReportVersion: async (content) => { await post(`/api/admin/assessments/${id}/report-version`, { content }); },
      saveValidation: async (v) => { await post(`/api/admin/assessments/${id}/validations`, v); },
      generateUnderstanding: async () => post(`/api/admin/assessments/${id}/understanding`, { action: "generate" }),
      saveUnderstanding: async (content) => (await post(`/api/admin/assessments/${id}/understanding`, { action: "save", content })).version,
      createProfile: async (name) => { const r = await post(`/api/admin/assessments/${id}/profile`, { name }); router.refresh(); return r.clientId; },
      setStage: async (clientId, stage) => { await post(`/api/admin/clients/${clientId}`, { action: "stage", stage }); router.refresh(); },
      attachToProfile: async (clientId) => { await post(`/api/admin/clients/${clientId}`, { action: "attach", assessmentId: id }); router.refresh(); },
      profileHref: (clientId) => `/admin/clients/${clientId}`,
      setName: async (name) => { await post(`/api/admin/assessments/${id}/name`, { name }); router.refresh(); },
      deleteAssessment: async () => { await post(`/api/admin/assessments/${id}/delete`, { confirm: "DELETE" }); router.push("/admin"); router.refresh(); },
      pdfHref: data.result ? `/api/admin/assessments/${id}/pdf` : null,
      exportHref: `/api/admin/assessments/${id}/export`,
      listHref: "/admin",
    }} />
  );
}

export function ConnectedClients({ rows }: { rows: ClientListRow[] }) {
  return <ClientsTable rows={rows} profileHref={(id) => `/admin/clients/${id}`} />;
}

export function ConnectedProfile({ data }: { data: ClientProfileData }) {
  const router = useRouter();
  const id = data.client.id;
  const act = (body: unknown) => post(`/api/admin/clients/${id}`, body);
  return (
    <ClientProfile data={data} actions={{
      setStage: async (stage, since) => { await act({ action: "stage", stage, since }); },
      saveDetails: async (d) => { await act({ action: "details", ...d }); },
      createInvite: async () => (await act({ action: "invite" })).token,
      revokeInvite: async () => { await act({ action: "revoke_invite" }); },
      attach: async (assessmentId) => { await act({ action: "attach", assessmentId }); },
      detach: async (assessmentId) => { await act({ action: "detach", assessmentId }); },
      search: async (q) => { const r = await fetch(`/api/admin/assessments/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }) }); if (!r.ok) throw new Error(); return (await r.json()).hits; },
      saveSession: async (session) => (await act({ action: "session", session })).id,
      deleteSession: async (sid) => { await act({ action: "delete_session", id: sid }); },
      saveNote: async (n) => (await act({ action: "note", ...n })).id,
      deleteNote: async (nid) => { await act({ action: "delete_note", id: nid }); },
      upload: async (file, purpose, ids) => {
        const fd = new FormData(); fd.set("file", file); fd.set("purpose", purpose);
        if (ids.sessionId) fd.set("sessionId", ids.sessionId); if (ids.noteId) fd.set("noteId", ids.noteId);
        const r = await fetch(`/api/admin/clients/${id}/attachments`, { method: "POST", body: fd });
        if (!r.ok) throw new Error(String(r.status));
        const { id: aid } = await r.json();
        return { id: aid, filename: file.name, content_type: file.type, size_bytes: file.size, purpose, session_id: ids.sessionId ?? null, note_id: ids.noteId ?? null, created_at: new Date().toISOString() };
      },
      deleteAttachment: async (aid) => { await post(`/api/admin/clients/${id}/attachments/${aid}`, { action: "delete" }); },
      attachmentHref: (aid) => `/api/admin/clients/${id}/attachments/${aid}`,
      workspaceHref: (aid) => `/admin/assessments/${aid}`,
      // Client links always point at the public site, even when Jana works on the coach subdomain.
      inviteUrl: (token) => `${(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "")}/#invite=${token}`,
      listHref: "/admin/clients",
      refresh: () => router.refresh(),
    }} />
  );
}

export function SignOut() {
  const router = useRouter();
  return (
    <button className="text-[11px] uppercase tracking-[0.14em] text-taupe hover:text-burgundy"
      onClick={async () => { await supabaseBrowser()?.auth.signOut(); router.push("/admin/login"); router.refresh(); }}>Sign out</button>
  );
}
