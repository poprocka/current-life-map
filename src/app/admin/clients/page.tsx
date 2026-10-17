import { asCoach } from "@/server/db";
import { requireCoach } from "@/server/auth";
import { listClients } from "@/server/admin/clients";
import { ConnectedClients } from "@/components/admin/connected";
import { AdminHeader, NotConfigured } from "@/components/admin/AdminHeader";

export default async function ClientsPage() {
  const s = await requireCoach();
  if ("notConfigured" in s) return <NotConfigured what="config" />;
  if ("notCoach" in s) return <NotConfigured what="coach" />;
  const rows = await asCoach(s.db, s.ctx, (sql) => listClients(sql));
  return (
    <>
      <AdminHeader email={s.email} role={s.role} active="clients" />
      <main className="px-4 py-6 sm:px-10 sm:py-8">
        <h1 className="font-serif text-[32px] font-light">Clients</h1>
        <div className="mt-6"><ConnectedClients rows={rows} /></div>
      </main>
    </>
  );
}
