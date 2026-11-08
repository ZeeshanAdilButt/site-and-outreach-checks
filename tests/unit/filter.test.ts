import { describe, expect, it } from "vitest";
import { classify } from "@learner/lib/filter";
import { createSession } from "@learner/lib/session";
import { HUMAN_UA, robotStrings, ROBOT_POOL_SIZE, why } from "../helpers/common";

const PEOPLE = [
  HUMAN_UA,
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
];
const req = (headers: Record<string, string>, method = "GET") => ({ headers: new Headers(headers), method });

describe("the filter, step 6 (chapter 4.7)", () => {
  it("counts normal browsers as people", async () => {
    for (const ua of PEOPLE) {
      expect(await classify(req({ "user-agent": ua })), why("4.7", `a normal browser string was dropped: ${ua.slice(0, 60)}`)).toEqual({ person: true });
    }
  });

  it("drops robot strings drawn at run time from the pinned list", async () => {
    const strings = robotStrings(60);
    expect(ROBOT_POOL_SIZE).toBeGreaterThan(300);
    const letThrough: string[] = [];
    for (const ua of strings) {
      const verdict = await classify(req({ "user-agent": ua }));
      if (verdict.person) letThrough.push(ua);
    }
    expect(
      letThrough,
      why(
        "4.7",
        `${letThrough.length} of ${strings.length} robot strings counted as people. The first three: ${letThrough.slice(0, 3).join(" | ")}. A list of names you typed cannot keep up. Use the isbot package.`,
      ),
    ).toEqual([]);
  });

  it("gives a robot the reason robot", async () => {
    const [ua] = robotStrings(1, 7);
    expect(await classify(req({ "user-agent": ua })), why("4.7", "the reason for a robot is robot")).toEqual({ person: false, reason: "robot" });
  });

  it("drops an empty browser string", async () => {
    expect(await classify(req({ "user-agent": "" })), why("4.7", "an empty user agent is dropped")).toEqual({ person: false, reason: "empty-agent" });
    expect(await classify(req({}))).toEqual({ person: false, reason: "empty-agent" });
  });

  it("drops prefetches, from each of the three headers", async () => {
    for (const h of [{ "sec-purpose": "prefetch;prerender" }, { purpose: "prefetch" }, { "next-router-prefetch": "1" }]) {
      expect(await classify(req({ "user-agent": HUMAN_UA, ...h })), why("4.7", `a prefetch was counted: ${JSON.stringify(h)}`)).toEqual({ person: false, reason: "prefetch" });
    }
  });

  it("drops a HEAD request", async () => {
    expect(await classify(req({ "user-agent": HUMAN_UA }, "HEAD")), why("4.7", "a HEAD request is not a visit")).toEqual({ person: false, reason: "head" });
  });

  it("uses the order owner, head, prefetch, empty-agent, robot when there are several causes", async () => {
    const [ua] = robotStrings(1, 11);
    expect(await classify(req({ "user-agent": ua, "sec-purpose": "prefetch" })), why("4.7", "prefetch comes before robot")).toEqual({ person: false, reason: "prefetch" });
    expect(await classify(req({ "user-agent": ua }, "HEAD")), why("4.7", "head comes before robot")).toEqual({ person: false, reason: "head" });
    expect(await classify(req({ "user-agent": "", purpose: "prefetch" })), why("4.7", "prefetch comes before empty-agent")).toEqual({ person: false, reason: "prefetch" });
  });

  it("drops the owner, and only for a real session", async () => {
    const session = await createSession();
    expect(await classify(req({ "user-agent": HUMAN_UA, cookie: `session=${session.id}` })), why("4.10", "a valid session means the owner")).toEqual({ person: false, reason: "owner" });
    expect(await classify(req({ "user-agent": HUMAN_UA, cookie: "session=owner" })), why("4.10", "a made-up cookie is not the owner")).toEqual({ person: true });
    const head = await classify(req({ "user-agent": HUMAN_UA, cookie: `session=${session.id}` }, "HEAD"));
    expect(head, why("4.7", "owner comes first in the order")).toEqual({ person: false, reason: "owner" });
  });
});
