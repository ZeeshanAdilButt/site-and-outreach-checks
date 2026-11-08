import { describe, expect, it } from "vitest";
import { dailyVisitorHash } from "@learner/lib/visitor";
import { HUMAN_UA, why } from "../helpers/common";

describe("the daily visitor hash, step 6 (chapter 4.5)", () => {
  it("is 16 hex characters and stable within a day", () => {
    const a = dailyVisitorHash("2026-03-03", "198.51.100.4", HUMAN_UA);
    expect(a, why("4.5", "16 hex characters")).toMatch(/^[0-9a-f]{16}$/);
    expect(dailyVisitorHash("2026-03-03", "198.51.100.4", HUMAN_UA)).toBe(a);
  });
  it("changes with the day, the address and the browser", () => {
    const a = dailyVisitorHash("2026-03-03", "198.51.100.4", HUMAN_UA);
    expect(dailyVisitorHash("2026-03-04", "198.51.100.4", HUMAN_UA), why("4.5", "a new day must give a new code")).not.toBe(a);
    expect(dailyVisitorHash("2026-03-03", "198.51.100.5", HUMAN_UA)).not.toBe(a);
    expect(dailyVisitorHash("2026-03-03", "198.51.100.4", "Other/1.0")).not.toBe(a);
  });
  it("depends on the secret", () => {
    const a = dailyVisitorHash("2026-03-03", "198.51.100.4", HUMAN_UA);
    const saved = process.env.VISITOR_SECRET;
    process.env.VISITOR_SECRET = "a different secret";
    try {
      expect(dailyVisitorHash("2026-03-03", "198.51.100.4", HUMAN_UA), why("4.5", "use VISITOR_SECRET in the HMAC")).not.toBe(a);
    } finally {
      process.env.VISITOR_SECRET = saved;
    }
  });
});
