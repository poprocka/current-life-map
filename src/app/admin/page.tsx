import { asCoach } from "@/server/db";
import { requireCoach } from "@/server/auth";
import { channelSummary, introConversations, listAssessments, reconciliationQueue } from "@/server/admin/queries";
import { IntroConversations } from "@/components/admin/IntroConversations";
import { ChannelSummary } from "@/components/admin/ChannelSummary";
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
  const [list, recon, channels, apps] = await asCoach(s.db, s.ctx, async (sql) => [await listAssessments(sql, filters), await reconciliationQueue(sql), await channelSummary(sql), await introConversations(sql)] as const);
  return (
    <>
      <AdminHeader email={s.email} role={s.role} active="assessments" />
      <main className="px-4 py-6 sm:px-10 sm:py-8">
        <h1 className="font-serif text-[32px] font-light">Assessments</h1>
        <div className="mt-6"><IntroConversations rows={apps} canDelete={s.role === "admin"} /></div>
        <div className="mt-6"><ChannelSummary rows={channels} /></div>
        <div className="mt-6"><ConnectedTable {...list} filters={filters} recon={recon} canExport={s.role === "admin"} /></div>
      </main>
    </>
  );
}
