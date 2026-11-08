import { expect, test } from "@playwright/test";
import { HUMAN_UA, why } from "../helpers/common";
import { expected, FROM, TO } from "../seed/dw-seed.mjs";

const ROUTES = ["views-per-day", "visitors-per-day", "top-pages", "referrers", "proposals", "blog-reads", "clicks", "funnel", "filtered-share"];
const headers = { "user-agent": HUMAN_UA };

async function login(request: import("@playwright/test").APIRequestContext, secret: string) {
  return request.post("/api/login", { headers: { ...headers, "content-type": "application/json" }, data: { secret }, maxRedirects: 0 });
}

test.describe("step 10: login and data routes (chapters 4.9 and 4.10)", () => {
  test("every data route answers 401 with no cookie", async ({ request }) => {
    for (const route of ROUTES) {
      const response = await request.get(`/api/stats/${route}`, { headers });
      expect(response.status(), why("4.10", `/api/stats/${route} must answer 401 without a session`)).toBe(401);
    }
  });

  test("a made-up cookie value answers 401", async ({ request }) => {
    for (const value of ["owner", "true", "1", "admin", "0".repeat(43)]) {
      const response = await request.get("/api/stats/top-pages", { headers: { ...headers, cookie: `session=${value}` } });
      expect(response.status(), why("4.10", `a cookie "${value}" must not count: look the id up in the sessions table`)).toBe(401);
    }
  });

  test("the dashboard sends you to /login without a session", async ({ request }) => {
    const response = await request.get("/dashboard", { headers, maxRedirects: 0 });
    expect([302, 303, 307, 308], why("4.10", "redirect to /login without a valid session")).toContain(response.status());
    expect(response.headers()["location"]).toMatch(/\/login$/);
  });

  test("a wrong secret sets no cookie and answers 401", async ({ request }) => {
    const response = await login(request, "dw-wrong-secret");
    expect(response.status(), why("4.10", "a wrong secret answers 401")).toBe(401);
    expect(response.headers()["set-cookie"], why("4.10", "a wrong secret must set nothing")).toBeUndefined();
  });

  test("the right secret sets an HttpOnly, Secure, SameSite cookie and the data routes then answer", async ({ request }) => {
    const response = await login(request, process.env.OWNER_SECRET!);
    expect(response.status(), why("4.10", "the right secret answers 200")).toBe(200);
    const cookie = response.headers()["set-cookie"] ?? "";
    expect(cookie, why("4.10", "set a cookie named session")).toMatch(/^session=[A-Za-z0-9_-]{43}/);
    expect(cookie, why("4.10", "HttpOnly")).toContain("HttpOnly");
    expect(cookie, why("4.10", "Secure")).toContain("Secure");
    expect(cookie, why("4.10", "SameSite")).toMatch(/SameSite=(Lax|Strict)/);
    const session = cookie.split(";")[0];

    for (const route of ROUTES) {
      const data = await request.get(`/api/stats/${route}?from=${FROM}&to=${TO}`, { headers: { ...headers, cookie: session } });
      expect(data.status(), why("4.11", `/api/stats/${route} must answer 200 with a session`)).toBe(200);
    }
    const top = await (await request.get(`/api/stats/top-pages?from=${FROM}&to=${TO}`, { headers: { ...headers, cookie: session } })).json();
    expect(top[0], why("4.11", "the first top page on DW's seed")).toEqual(expected.topPages[0]);

    const page = await request.get("/dashboard", { headers: { ...headers, cookie: session }, maxRedirects: 0 });
    expect(page.status(), why("4.10", "the dashboard opens with a session")).toBe(200);

    const out = await request.post("/api/logout", { headers: { ...headers, cookie: session } });
    expect([200, 204, 303, 307]).toContain(out.status());
    const after = await request.get("/api/stats/top-pages", { headers: { ...headers, cookie: session } });
    expect(after.status(), why("4.10", "logout deletes the session row")).toBe(401);
  });

  test("the owner's visit is not counted", async ({ request, page }) => {
    const response = await login(request, process.env.OWNER_SECRET!);
    const cookie = (response.headers()["set-cookie"] ?? "").split(";")[0];
    const value = cookie.split("=")[1];
    const { count } = await import("../helpers/common");
    const before = await count("select count(*)::int as n from views where path = '/privacy'");
    await page.context().addCookies([{ name: "session", value, url: new URL(test.info().project.use.baseURL ?? "http://localhost:3000").origin }]);
    await page.goto("/privacy");
    await page.waitForTimeout(2000);
    expect(await count("select count(*)::int as n from views where path = '/privacy'"), why("4.10", "the owner is never counted: classify says owner")).toBe(before);
  });
});
