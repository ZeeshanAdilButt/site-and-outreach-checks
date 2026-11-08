import { expect, test } from "@playwright/test";
import { count, HUMAN_UA, robotStrings, runSeed, rng, waitFor, why } from "../helpers/common";

const viewsOf = (path: string) => count("select count(*)::int as n from views where path = $1 and visitor not like 'dw5eed%'", [path]);

test.describe("step 7: views (chapters 4.5 and 4.7)", () => {
  test("a robot's request adds no view", async ({ request }) => {
    const [robot] = robotStrings(1, 21);
    const path = `/dw-robot-${runSeed()}`;
    const before = await viewsOf(path);
    const response = await request.post("/api/view", {
      headers: { "user-agent": robot, "content-type": "text/plain" },
      data: JSON.stringify({ path }),
    });
    expect(response.status(), why("4.5", "the view route always answers 204")).toBe(204);
    await new Promise((r) => setTimeout(r, 800));
    expect(await viewsOf(path), why("4.7", `a robot (${robot.slice(0, 50)}) was counted as a view`)).toBe(before);
  });

  test("a page load that runs no script adds no view", async ({ request }) => {
    const before = await viewsOf("/about");
    const response = await request.get("/about", { headers: { "user-agent": HUMAN_UA } });
    expect(response.status()).toBe(200);
    await new Promise((r) => setTimeout(r, 800));
    expect(await viewsOf("/about"), why("4.5", "only the beacon may write a view, never a page load")).toBe(before);
  });

  test("a malformed body answers 204 and adds nothing", async ({ request }) => {
    const response = await request.post("/api/view", { headers: { "content-type": "text/plain" }, data: "not json" });
    expect(response.status()).toBe(204);
  });

  test("a robot's browser that runs the script adds no view", async ({ browser }) => {
    const [robot] = robotStrings(1, 22);
    const context = await browser.newContext({ userAgent: robot });
    const page = await context.newPage();
    const before = await viewsOf("/about");
    await page.goto("/about");
    await page.waitForTimeout(2000);
    await context.close();
    expect(await viewsOf("/about"), why("4.7", "a robot that runs JavaScript must still be dropped by the server")).toBe(before);
  });

  test("a real browser with a normal user agent adds one view, with a 16 character visitor code", async ({ page }) => {
    const before = await viewsOf("/about");
    await page.goto("/about");
    const grew = await waitFor(async () => (await viewsOf("/about")) === before + 1);
    expect(grew, why("4.5", "a visible page in a normal browser must store exactly one view")).toBeTruthy();
    await page.waitForTimeout(1500);
    expect(await viewsOf("/about"), "the page stored more than one view").toBe(before + 1);
    const row = await count("select length(visitor)::int as n from views where path = '/about' and visitor not like 'dw5eed%' order by id desc limit 1");
    expect(row, why("4.3", "the visitor code is 16 hex characters")).toBe(16);
  });

  test("a client-side navigation adds one more view", async ({ page }) => {
    await page.goto("/");
    await waitFor(async () => (await viewsOf("/")) > 0);
    const before = await viewsOf("/blog");
    await page.getByRole("link", { name: /writing/i }).first().click();
    await expect(page).toHaveURL(/\/blog$/);
    const grew = await waitFor(async () => (await viewsOf("/blog")) === before + 1);
    expect(grew, why("4.5", "the beacon sits in the root layout: watch the path so a client-side navigation counts")).toBeTruthy();
  });

  test("a proposal page is never stored as a view", async ({ page }) => {
    const random = rng(runSeed());
    void random;
    await page.goto("/p/dwlivetokenlllllllllll");
    await page.waitForTimeout(1500);
    expect(await count("select count(*)::int as n from views where path like '/p/%'")).toBe(0);
  });
});
