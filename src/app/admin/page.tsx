import { asCoach } from "@/server/db";
import { requireCoach } from "@/server/auth";
import { listAssessments, reconciliationQueue } from "@/server/admin/queries";
import type { ListFilters } from "@/server/admin/types";
import { ConnectedTable } from "@/components/admin/connected";
import { AdminHeader, NotConfigured } from "@/components/admin/AdminHeader";

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireCoach();
  if ("notConfigured" in s) return <NotConfigured what="config" />;
  if ("notCoach" in s) return <NotConfigured what="coach" />;
  const sp = await searchParams;
  const filters: ListFilters = {
    q: sp.q, booking: sp.booking, completion: sp.completion as ListFilters["completion"], report: sp.report as ListFilters["report"],
    from: sp.from, to: sp.to, sort: sp.sort as ListFilters["sort"], dir: sp.dir as ListFilters["dir"], page: sp.page ? Number(sp.page) : 1,
  };
  const [list, recon] = await asCoach(s.db, s.ctx, async (sql) => [await listAssessments(sql, filters), await reconciliationQueue(sql)] as const);
  return (
    <>
      <AdminHeader email={s.email} role={s.role} />
      <main className="px-6 py-8 sm:px-10">
        <h1 className="font-serif text-[32px] font-light">Assessments</h1>
        <div className="mt-6"><ConnectedTable {...list} filters={filters} recon={recon} canExport={s.role === "admin"} /></div>
      </main>
    </>
  );
}
