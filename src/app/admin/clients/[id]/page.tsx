import { notFound } from "next/navigation";
import { asCoach } from "@/server/db";
import { requireCoach } from "@/server/auth";
import { loadClientProfile } from "@/server/admin/clients";
import { ConnectedProfile } from "@/components/admin/connected";
import { AdminHeader, NotConfigured } from "@/components/admin/AdminHeader";

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireCoach();
  if ("notConfigured" in s) return <NotConfigured what="config" />;
  if ("notCoach" in s) return <NotConfigured what="coach" />;
  const { id } = await params;
  const data = await asCoach(s.db, s.ctx, (sql) => loadClientProfile(sql, { userId: s.ctx.userId, role: s.role }, id));
  if (!data) notFound();
  return (<><AdminHeader email={s.email} role={s.role} /><ConnectedProfile data={data} /></>);
}
