import { expect, test } from "@playwright/test";
import { count, HUMAN_UA, robotStrings, waitFor, why } from "../helpers/common";
import { TOKENS } from "../seed/dw-seed.mjs";

const SLUG = "example-project";
const clicksOf = () => count("select count(*)::int as n from clicks where slug = $1 and (at > now() - interval '1 day')", [SLUG]);

test.describe("step 9: tracked links (chapters 6.2 and 6.3)", () => {
  test("answers 307 with no-store and adds exactly one click", async ({ request }) => {
    const before = await clicksOf();
    const response = await request.get(`/go/${SLUG}`, { maxRedirects: 0, headers: { "user-agent": HUMAN_UA } });
    expect(response.status(), why("6.3", "answer 307, never 308 or 301")).toBe(307);
    expect(response.headers()["cache-control"], why("6.3", "add Cache-Control: no-store")).toContain("no-store");
    expect(response.headers()["location"], why("6.3", "the target comes from links.ts")).toMatch(/^https?:\/\//);
    const grew = await waitFor(async () => (await clicksOf()) === before + 1);
    expect(grew, why("6.3", "record one click for a real person")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 1000));
    expect(await clicksOf(), "more than one click was stored for one tap").toBe(before + 1);
  });

  test("with ?r= the click carries the recipient", async ({ request }) => {
    await request.get(`/go/${SLUG}?r=${TOKENS.live}`, { maxRedirects: 0, headers: { "user-agent": HUMAN_UA } });
    const found = await waitFor(async () =>
      (await count(
        "select count(*)::int as n from clicks c join recipients r on r.id = c.recipient_id where r.token = $1 and c.at > now() - interval '1 day'",
        [TOKENS.live],
      )) > 0,
    );
    expect(found, why("6.3", "keep the recipient when ?r= is a known token")).toBeTruthy();
  });

  test("an unknown ?r= leaves no recipient", async ({ request }) => {
    await request.get(`/go/${SLUG}?r=dw-made-up-token`, { maxRedirects: 0, headers: { "user-agent": HUMAN_UA } });
    await new Promise((r) => setTimeout(r, 1200));
    expect(await count("select count(*)::int as n from clicks where recipient_id is null and at > now() - interval '1 day'")).toBeGreaterThan(0);
  });

  test("a robot is still redirected but not counted", async ({ request }) => {
    const [robot] = robotStrings(1, 51);
    const before = await clicksOf();
    const response = await request.get(`/go/${SLUG}`, { maxRedirects: 0, headers: { "user-agent": robot } });
    expect(response.status()).toBe(307);
    await new Promise((r) => setTimeout(r, 1500));
    expect(await clicksOf(), why("6.3", "classify once and record no click for a robot")).toBe(before);
  });

  test("an unknown slug is a 404 page", async ({ request }) => {
    const response = await request.get("/go/dw-not-a-link", { maxRedirects: 0, headers: { "user-agent": HUMAN_UA } });
    expect(response.status(), why("6.3", "an unknown slug answers 404")).toBe(404);
  });

  test("the target is never read from the query string", async ({ request }) => {
    const response = await request.get(`/go/${SLUG}?to=https://evil.example`, { maxRedirects: 0, headers: { "user-agent": HUMAN_UA } });
    expect(response.headers()["location"]).not.toContain("evil.example");
  });
});
