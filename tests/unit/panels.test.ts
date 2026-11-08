import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import * as stats from "@learner/lib/stats";
import { expected, FROM, TO } from "../seed/dw-seed.mjs";
import { why } from "../helpers/common";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
afterAll(() => pool.end());
const range = { from: FROM, to: TO };

describe("the panel queries on DW's seed, step 11 (chapters 4.11, 5.9, 6.7, 6.8)", () => {
  it("views per day", async () => {
    const rows = await stats.viewsPerDay(pool, range);
    expect(rows.map((r) => r.views), why("4.11", "views per day on DW's seed")).toEqual(expected.viewsPerDay);
  });
  it("visitors per day counts distinct visitors, so day 3 has fewer than its views", async () => {
    const rows = await stats.visitorsPerDay(pool, range);
    expect(rows.map((r) => r.visitors), why("4.11", "visitors per day: count distinct visitor")).toEqual(expected.visitorsPerDay);
    expect(expected.visitorsPerDay[2]).toBeLessThan(expected.viewsPerDay[2]);
  });
  it("top pages", async () => {
    expect((await stats.topPages(pool, range)).map((r) => ({ path: r.path, views: r.views })), why("4.11", "top pages, most views first")).toEqual(expected.topPages);
  });
  it("referrers, with direct for no referrer", async () => {
    const rows = await stats.referrers(pool, range);
    expect(rows.map((r) => ({ referrer: r.referrer, views: r.views })), why("4.11", "referrers: write no referrer as direct")).toEqual(expected.referrers);
  });
  it("blog reads count article pages only", async () => {
    const rows = await stats.blogReads(pool, range);
    expect(rows.map((r) => ({ path: r.path, views: r.views })), why("6.7", "blog reads: paths under /blog/ only")).toEqual(expected.blogReads);
  });
  it("share needs a base of 5", () => {
    expect(stats.share(3, 4), why("6.7", "below 5, too few to tell")).toEqual({ part: 3, base: 4, percent: null, label: "too few to tell" });
    expect(stats.share(30, 40), why("6.7", "30 of 40 is 75")).toEqual({ part: 30, base: 40, percent: 75, label: null });
    expect(stats.share(1, 5).percent).toBe(20);
  });
  it("proposal status has one row per recipient and fetched-only and unopened ones are kept", async () => {
    const rows = await stats.proposalStatus(pool, range);
    const dw = rows.filter((r) => r.name.startsWith("DW "));
    expect(dw.length, why("5.9", "one row for every recipient: use a left join")).toBe(expected.recipientCount);
    const ada = dw.find((r) => r.name === "DW Ada")!;
    expect([ada.open_count, ada.visible_seconds, ada.sections], why("5.9", "Ada opened twice, 85 seconds, three sections")).toEqual([2, 85, ["ask", "fit", "trade-offs"]]);
    const ben = dw.find((r) => r.name === "DW Ben")!;
    expect([ben.fetched, ben.open_count, ben.first_open]).toEqual([1, 0, null]);
    const cy = dw.find((r) => r.name === "DW Cy")!;
    expect([cy.fetched, cy.open_count]).toEqual([0, 0]);
  });
  it("clicks count recipient and public clicks apart", async () => {
    const rows = await stats.clicks(pool, range);
    expect(rows.reduce((n, r) => n + r.with_recipient, 0), why("6.8", "clicks that carry a recipient")).toBe(expected.clicksWithRecipient);
    expect(rows.reduce((n, r) => n + r.public_clicks, 0), why("6.8", "public clicks")).toBe(expected.clicksPublic);
  });
  it("the funnel counts only what came after each reach-out, with a base", async () => {
    const f = await stats.funnel(pool, range);
    expect([f.sent, f.opened, f.clicked], why("6.8", "sent, opened and clicked, each only after its own sent_at")).toEqual([expected.funnel.sent, expected.funnel.opened, expected.funnel.clicked]);
    expect(f.openedShare.percent, why("6.8", `${f.sent} sent is above the base of 5`)).toBe(Math.round((100 * expected.funnel.opened) / expected.funnel.sent));
  });
  it("the filtered share is dropped over dropped plus views", async () => {
    const r = await stats.filteredShare(pool, range);
    expect([r.dropped, r.views, r.base], why("6.8", "dropped rows out of dropped plus people views")).toEqual([expected.droppedCount, expected.viewsTotal, expected.droppedCount + expected.viewsTotal]);
  });
});
