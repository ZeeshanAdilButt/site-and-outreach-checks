import { describe, expect, it, vi } from "vitest";
import { newToken } from "@learner/lib/tokens";
import { why } from "../helpers/common";

describe("tokens, step 6 (chapter 5.4)", () => {
  it("makes 22 characters of base64url", () => {
    for (let i = 0; i < 50; i++) expect(newToken(), why("5.4", "16 random bytes in base64url are 22 characters")).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
  it("never repeats in 5000 tokens", () => {
    expect(new Set(Array.from({ length: 5000 }, () => newToken())).size, why("5.4", "tokens must come from crypto.getRandomValues")).toBe(5000);
  });
  it("takes exactly 16 bytes of randomness from crypto.getRandomValues", () => {
    const spy = vi.spyOn(globalThis.crypto, "getRandomValues");
    newToken();
    expect(spy, why("5.4", "call crypto.getRandomValues once")).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0][0] as Uint8Array).byteLength).toBe(16);
    spy.mockRestore();
  });
});
