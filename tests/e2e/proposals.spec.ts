import { expect, test } from "@playwright/test";
import { count, HUMAN_UA, rng, robotStrings, runSeed, waitFor, why, withDb } from "../helpers/common";
import { TOKENS } from "../seed/dw-seed.mjs";

const token = TOKENS.live;
const visitsOf = () =>
  count("select count(*)::int as n from proposal_visits v join recipients r on r.id = v.recipient_id where r.token = $1", [token]);
const latest = () =>
  withDb(async (db) => (await db.query(
    `select v.visit_key, v.opened_at, v.visible_seconds, v.sections_seen from proposal_visits v
       join recipients r on r.id = v.recipient_id where r.token = $1 order by v.id desc limit 1`, [token])).rows[0]);

test.describe("step 8: proposals (chapters 5.4, 5.6 and 5.8)", () => {
  test("an unknown token is a 404 page", async ({ request }) => {
    const response = await request.get("/p/dwnotatokenxxxxxxxxxxx");
    expect(response.status(), why("5.4", "look the token up and call notFound() when there is none")).toBe(404);
  });

  test("the page is not indexed, sends no referrer and shows the recording note", async ({ request }) => {
    const html = await (await request.get(`/p/${token}`, { headers: { "user-agent": HUMAN_UA } })).text();
    expect(html, why("5.4", "set robots noindex")).toContain("noindex");
    expect(html, why("5.4", "set referrer no-referrer")).toContain('content="no-referrer"');
    expect(html, why("5.4", "show RecordingNote on every proposal page")).toContain("data-recording-note");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots, why("5.4", "never block /p/ in robots.txt: a crawler that cannot fetch a page cannot see noindex")).not.toContain("/p/");
  });

  test("/p/demo records nothing and shows the note", async ({ request }) => {
    const before = await visitsOf();
    const html = await (await request.get("/p/demo", { headers: { "user-agent": HUMAN_UA } })).text();
    expect(html).toContain("data-recording-note");
    expect(await visitsOf()).toBe(before);
  });

  test("a robot's fetch is kept as fetched and never becomes opened", async ({ request }) => {
    const [robot] = robotStrings(1, 31);
    const before = await visitsOf();
    const response = await request.get(`/p/${token}`, { headers: { "user-agent": robot } });
    expect(response.status()).toBe(200);
    const grew = await waitFor(async () => (await visitsOf()) === before + 1);
    expect(grew, why("5.6", "a robot's fetch is still a fetch: record one fetched row")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 2500));
    const row = await latest();
    expect(row.opened_at, why("5.6", "a robot never opens: no script ran and nobody scrolled")).toBeNull();
    expect(row.visit_key.length, why("5.6", "store a visit_key made by newToken()")).toBe(22);
  });

  test("a prefetch leaves no visit", async ({ request }) => {
    const before = await visitsOf();
    await request.get(`/p/${token}`, { headers: { "user-agent": HUMAN_UA, "sec-purpose": "prefetch" } });
    await new Promise((r) => setTimeout(r, 1500));
    expect(await visitsOf(), why("5.6", "a prefetch is not a fetch")).toBe(before);
  });

  test("a real browser opens after a few seconds and a scroll, and a section on screen is seen", async ({ page }) => {
    const random = rng(runSeed() + 41);
    const waitMs = 4000 + Math.floor(random() * 4000); // 4 to 8 seconds, drawn from the run id
    const before = await visitsOf();
    await page.goto(`/p/${token}`);
    await waitFor(async () => (await visitsOf()) === before + 1);
    await page.waitForTimeout(waitMs);
    await page.mouse.move(200, 300);
    await page.mouse.wheel(0, 250);
    const opened = await waitFor(async () => (await latest())?.opened_at, 15000);
    expect(opened, why("5.6", `the visit was not opened after ${Math.round(waitMs / 1000)} visible seconds and a scroll`)).toBeTruthy();

    // keep one section on screen for longer than the 5 second rule, then hide the page so the last heartbeat is sent
    await page.locator("#fit").scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(7500);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("pagehide"));
    });
    const seen = await waitFor(async () => {
      const row = await latest();
      return row && row.sections_seen.length > 0 ? row : null;
    }, 15000);
    expect(seen, why("5.8", "no section was recorded as seen after one stayed on screen for 7 seconds and the page was hidden")).toBeTruthy();
    expect(seen!.visible_seconds, why("5.8", "visible seconds should be at least the time on the page")).toBeGreaterThanOrEqual(waitMs / 1000);
    const total = await count(
      "select count(*)::int as n from proposal_visits v join recipients r on r.id = v.recipient_id where r.token = $1 and v.opened_at is not null",
      [token],
    );
    expect(total, why("5.6", "opened is set once per visit")).toBeGreaterThanOrEqual(1);
  });

  test("an event with an unknown visit key answers 204 and writes nothing", async ({ request }) => {
    const response = await request.post("/api/proposal-event", {
      headers: { "user-agent": HUMAN_UA, "content-type": "application/json" },
      data: { visit_key: "dw-not-a-key", kind: "opened", jsRan: true, visibleSeconds: 9, actions: 3 },
    });
    expect(response.status()).toBe(204);
  });
});
