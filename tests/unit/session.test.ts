import { describe, expect, it } from "vitest";
import { checkSecret, createSession, readSession } from "@learner/lib/session";
import { why } from "../helpers/common";

describe("sessions, step 6 (chapter 4.10)", () => {
  it("accepts the real secret and refuses everything else, without throwing", () => {
    expect(checkSecret(process.env.OWNER_SECRET!), why("4.10", "the right secret must pass")).toBe(true);
    expect(checkSecret("nope")).toBe(false);
    expect(() => checkSecret("x".repeat(1000))).not.toThrow();
    expect(checkSecret(process.env.OWNER_SECRET! + "x"), why("4.10", "a longer secret must not pass")).toBe(false);
    expect(checkSecret(""), why("4.10", "an empty secret must not pass")).toBe(false);
  });
  it("reads a stored session and refuses a made-up one", async () => {
    const session = await createSession();
    expect(session.id, why("4.10", "32 random bytes in base64url")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await readSession(session.id), why("4.10", "a stored session must be read back")).not.toBeNull();
    for (const fake of ["owner", "true", "1", session.id.slice(0, -1) + "x"]) {
      expect(await readSession(fake), why("4.10", `"${fake}" is not in the sessions table`)).toBeNull();
    }
    expect(await readSession(undefined)).toBeNull();
  });
});
