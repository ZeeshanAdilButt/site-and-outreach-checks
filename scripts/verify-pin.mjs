// node scripts/verify-pin.mjs <learner repository> <checks_sha>
// The learner's checks.yml writes the same commit twice: in "uses" and in "with: checks_sha".
// A called workflow cannot read its own commit, so this checks that the two lines agree with the input.
import fs from "node:fs";
import path from "node:path";

const [learner, sha] = process.argv.slice(2);
const file = path.join(learner, ".github", "workflows", "checks.yml");
if (!fs.existsSync(file)) {
  console.error("Chapter 1.2: there is no .github/workflows/checks.yml in your repository. It comes with the template.");
  process.exit(1);
}
const text = fs.readFileSync(file, "utf8");
const uses = text.match(/^\s*uses:\s*ZeeshanAdilButt\/site-and-outreach-checks\/\.github\/workflows\/canonical\.yml@(\S+)\s*$/m)?.[1];
const pinned = text.match(/^\s*checks_sha:\s*(\S+)\s*$/m)?.[1];
const problems = [];
if (!uses) problems.push('the "uses:" line that calls canonical.yml is missing or was changed');
if (!pinned) problems.push('the "checks_sha:" line is missing');
if (uses && pinned && uses !== pinned) problems.push(`"uses" pins ${uses} but "checks_sha" says ${pinned}. They must be the same commit`);
if (uses && uses !== sha) problems.push(`"uses" pins ${uses} but this run was given ${sha}`);
if (problems.length > 0) {
  console.error("Chapter 1.2: your .github/workflows/checks.yml is not pinned properly:");
  for (const p of problems) console.error(`  - ${p}.`);
  process.exit(1);
}
console.log(`checks.yml pins ${sha} in both places.`);
