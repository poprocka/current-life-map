import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { ENV } from "./e2e/helpers";
import { freshDb, asAppDb } from "./db/pg";
import { asCoach, setDb, type Db } from "@/server/db";
import { createAssessment } from "@/server/assessments";
import { channelSummary, listAssessments } from "@/server/admin/queries";
import { cleanSlug, SHORT_LINKS, sourceFromReferrer } from "@/content/channels";
import nextConfig from "../next.config";

void ENV;
const JANA = "11111111-1111-1111-1111-111111111111";
let pg: PGlite, db: Db;
beforeAll(async () => {
  pg = await freshDb();
  await pg.exec(`insert into auth.users values ('${JANA}'); insert into coach_users (user_id, display_name, role) values ('${JANA}', 'Jana', 'admin');`);
  db = asAppDb(pg); setDb(db);
});

describe("acquisition channels", () => {
  it("only short slugs are accepted as channel values", () => {
    expect(cleanSlug("Instagram")).toBe("instagram");
    expect(cleanSlug("qr card")).toBe("qr_card");
    expect(cleanSlug("jane@example.com")).toBeNull();
    expect(cleanSlug("x".repeat(41))).toBeNull();
    expect(sourceFromReferrer("https://l.instagram.com/?u=x")).toBe("instagram");
    expect(sourceFromReferrer("https://www.linkedin.com/feed/")).toBe("linkedin");
    expect(sourceFromReferrer("https://example.org/")).toBeNull();
  });

  it("stores the first-touch channel and summarises the funnel per channel in the portal", async () => {
    await createAssessment(db, { source: "instagram", campaign: "fall_launch" });
    await createAssessment(db, { source: "instagram" });
    await createAssessment(db, { source: "qr_card" });
    await createAssessment(db, { source: "someone@mail.com" }); // dropped → direct
    const coach = { userId: JANA, aal: "aal2" as const };
    const rows = await asCoach(db, coach, (sql) => channelSummary(sql));
    expect(rows.find((r) => r.source === "instagram")?.started).toBe(2);
    expect(rows.find((r) => r.source === "qr_card")?.started).toBe(1);
    expect(rows.find((r) => r.source === "direct")?.started).toBe(1);
    const list = await asCoach(db, coach, (sql) => listAssessments(sql, {}));
    expect(list.rows.some((r) => r.campaign === "fall_launch")).toBe(true);
    // The database itself refuses anything that isn't a slug
    await expect(pg.query(`update assessments set source = 'Not A Slug!' where source = 'qr_card'`)).rejects.toThrow();
  });

  it("short links redirect to the public page with UTM tags", async () => {
    const r = await nextConfig.redirects!();
    const ig = r.find((x) => x.source === "/ig")!;
    expect(ig.destination).toBe("/?utm_source=instagram&utm_medium=social");
    expect(ig.permanent).toBe(false);
    expect(r.map((x) => x.source)).toEqual(SHORT_LINKS.map((l) => `/${l.path}`));
  });
});
