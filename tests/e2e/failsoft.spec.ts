import { expect, test } from "@playwright/test";
import { DOWN_BASE, HUMAN_UA, why } from "../helpers/common";
import { TOKENS } from "../seed/dw-seed.mjs";

// This copy of the site runs on port 3001 with DATABASE_URL pointing at a closed port.
const headers = { "user-agent": HUMAN_UA };
const timed = async <T>(fn: () => Promise<T>) => {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
};

test.describe("step 12: the fail-soft copy, database down (chapters 4.5, 5.4 and 6.3)", () => {
  test("the home page still answers within 5 seconds", async ({ request }) => {
    const { value, ms } = await timed(() => request.get(`${DOWN_BASE}/`, { headers, timeout: 5000 }));
    expect(value.status(), why("4.5", "the home page must not need the database")).toBe(200);
    expect(ms).toBeLessThan(5000);
  });

  test("a tracked link still redirects within 5 seconds", async ({ request }) => {
    const { value, ms } = await timed(() => request.get(`${DOWN_BASE}/go/example-project`, { headers, maxRedirects: 0, timeout: 5000 }));
    expect(value.status(), why("6.3", "the redirect must work with the database down: the target comes from links.ts")).toBe(307);
    expect(ms).toBeLessThan(5000);
  });

  test("the view route still answers 204 within 5 seconds", async ({ request }) => {
    const { value, ms } = await timed(() =>
      request.post(`${DOWN_BASE}/api/view`, { headers: { ...headers, "content-type": "text/plain" }, data: JSON.stringify({ path: "/" }), timeout: 5000 }),
    );
    expect(value.status(), why("4.5", "always answer 204, even when the write fails")).toBe(204);
    expect(ms).toBeLessThan(5000);
  });

  test("a proposal page shows its try-again page, never a blank error", async ({ page }) => {
    const start = Date.now();
    const response = await page.goto(`${DOWN_BASE}/p/${TOKENS.live}`, { timeout: 8000 });
    expect(response?.status(), why("5.4", "do not catch the database error in the page: error.tsx answers with status 500")).toBe(500);
    // error.tsx is a client component, so its words appear once the page has loaded in a real browser
    await expect(page.getByText(/try again in a minute/i), why("5.4", "app/p/[token]/error.tsx must say try again in a minute")).toBeVisible({ timeout: 5000 });
    expect(Date.now() - start).toBeLessThan(8000);
  });
});
