import { describe, expect, it } from "vitest";
import { isOpened, isSeen } from "@learner/lib/open-rule";
import { why } from "../helpers/common";

describe("the open rule, step 6 (chapters 5.6 and 5.8)", () => {
  const base = { jsRan: true, visibleSeconds: 5, actions: 2, owner: false };
  it("opens for a person who read for a few seconds and acted", () => {
    expect(isOpened(base), why("5.6", "JavaScript ran, 3 or more visible seconds and a human action should open")).toBe(true);
  });
  it("does not open when the page script never ran", () => {
    expect(isOpened({ ...base, jsRan: false }), why("5.6", "no script, no open")).toBe(false);
  });
  it("does not open under 3 visible seconds, and does at exactly 3", () => {
    expect(isOpened({ ...base, visibleSeconds: 2.9 }), why("5.6", "2.9 seconds is too short")).toBe(false);
    expect(isOpened({ ...base, visibleSeconds: 3 }), why("5.6", "3 seconds is enough")).toBe(true);
  });
  it("does not open without a human action: the email scanner that never scrolls", () => {
    expect(isOpened({ ...base, actions: 0 }), why("5.6", "no human action, no open")).toBe(false);
  });
  it("never opens for the owner", () => {
    expect(isOpened({ ...base, owner: true }), why("5.6", "the owner is never counted")).toBe(false);
  });
  it("sees a section after 5 seconds with half of it on screen, and not at 4", () => {
    expect(isSeen({ secondsHalfOnScreen: 4 }), why("5.8", "4 seconds is not seen")).toBe(false);
    expect(isSeen({ secondsHalfOnScreen: 5 }), why("5.8", "5 seconds is seen")).toBe(true);
  });
});
