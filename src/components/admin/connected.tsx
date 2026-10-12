"use client";
/** Admin components wired to the real API routes (the preview passes demo actions instead). */
import { useRouter } from "next/navigation";
import { AdminTable, type AdminTableProps } from "./AdminTable";
import { Workspace } from "./Workspace";
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

export function ConnectedTable(props: Omit<AdminTableProps, "onFilter" | "onReconcile" | "onSearch" | "workspaceHref" | "exportHref">) {
  const router = useRouter();
  return (
    <AdminTable {...props} exportHref={`/api/admin/export${qs({ ...props.filters, page: undefined })}`}
      workspaceHref={(id) => `/admin/assessments/${id}`}
      onFilter={(f) => router.push(`/admin${qs(f)}`)}
      onSearch={async (q) => { const r = await fetch(`/api/admin/assessments/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }) }); if (!r.ok) throw new Error(); return (await r.json()).hits; }}
      onReconcile={async (bookingId, assessmentId) => { await post(`/api/admin/bookings/${bookingId}`, { action: "reconcile", assessmentId }); router.refresh(); }} />
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
      setName: async (name) => { await post(`/api/admin/assessments/${id}/name`, { name }); router.refresh(); },
      deleteAssessment: async () => { await post(`/api/admin/assessments/${id}/delete`, { confirm: "DELETE" }); router.push("/admin"); router.refresh(); },
      pdfHref: data.result ? `/api/admin/assessments/${id}/pdf` : null,
      exportHref: `/api/admin/assessments/${id}/export`,
      listHref: "/admin",
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
