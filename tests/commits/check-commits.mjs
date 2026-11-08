// node tests/commits/check-commits.mjs <path to the learner's repository>
// Step 14. For each file in content/posts/:
//  - it was changed in at least three commits;
//  - the commit that added the most words is not the last one;
//  - the last commit changed existing lines.
// Prints the result for each post.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(process.argv[2] ?? "../learner");
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const dir = path.join(repo, "content", "posts");
const posts = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")) : [];
let failed = false;
const say = (ok, text) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${text}`);
  if (!ok) failed = true;
};

if (posts.length === 0) {
  console.log("There are no posts in content/posts yet, so there is nothing to check.");
  process.exit(0);
}

for (const post of posts) {
  const file = `content/posts/${post}`;
  if (post === "hello-sample.md") {
    say(false, `${file}: this is the sample post. Delete it (chapter 3.7, part 4) and write your own.`);
    continue;
  }
  const log = git("log", "--follow", "--reverse", "-p", "--no-color", "-U0", "--format=@@@%H", "--", file);
  const commits = log.split("@@@").filter(Boolean).map((chunk) => {
    const lines = chunk.split("\n");
    const hash = lines[0];
    let addedWords = 0;
    let added = 0;
    let removed = 0;
    let inCode = false;
    for (const line of lines.slice(1)) {
      if (line.startsWith("+++") || line.startsWith("---")) continue;
      if (line.startsWith("+")) {
        added += 1;
        const text = line.slice(1);
        if (text.startsWith("```")) inCode = !inCode;
        if (!inCode) addedWords += text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
      } else if (line.startsWith("-")) removed += 1;
    }
    return { hash, addedWords, added, removed };
  });
  if (commits.length < 3) {
    say(false, `${file}: changed in ${commits.length} commit(s). It needs at least 3: outline, draft and edit (chapters 3.10 and 3.11).`);
    continue;
  }
  say(true, `${file}: changed in ${commits.length} commits`);
  const most = commits.reduce((a, b) => (b.addedWords > a.addedWords ? b : a));
  const last = commits[commits.length - 1];
  say(most.hash !== last.hash, `${file}: the commit that added the most words (${most.addedWords}) ${most.hash === last.hash ? "is the last one. Show your drafts: the draft commit adds the words, the edit commit changes them" : "is not the last one"}`);
  say(last.removed > 0, `${file}: the last commit ${last.removed > 0 ? `changed existing lines (${last.removed} removed or rewritten)` : "only added lines. The edit commit must change existing lines (read aloud and cut)"}`);
}
process.exit(failed ? 1 : 0);
