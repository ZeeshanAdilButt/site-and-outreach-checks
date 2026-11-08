// Prints which canonical steps were green, and the one-line summary the learner sees in Module 1.
import fs from "node:fs";

const steps = JSON.parse(process.env.STEPS_JSON ?? "{}");
const names = [
  ["s1", "1. Check out your repository"],
  ["s2", "2. checks.yml pins one commit twice"],
  ["s3", "3. Database and DW's seed"],
  ["s4", "4. Install and build"],
  ["s5", "5. Start the site and wait"],
  ["s6", "6. DW's unit tests"],
  ["s7", "7. Views"],
  ["s8", "8. Proposals"],
  ["s9", "9. Redirects"],
  ["s10", "10. Login and data routes"],
  ["s11", "11. Panel queries"],
  ["s12", "12. Database down"],
  ["s13", "13. Design check"],
  ["s14", "14. Post commits"],
  ["s15", "15. Secret scan"],
];
let green = 0;
const lines = [];
for (const [id, name] of names) {
  const outcome = steps[id]?.outcome ?? "skipped";
  if (outcome === "success") green += 1;
  const word = outcome === "success" ? "green" : outcome === "skipped" ? "not run (an earlier step failed)" : "red";
  lines.push(`${word.padEnd(8)} ${name}`);
}
const summary = `canonical steps green: ${green} of ${names.length}`;
console.log(lines.join("\n"));
console.log(`\n${summary}`);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ${summary}\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n`);
process.exit(green === names.length ? 0 : 1);
