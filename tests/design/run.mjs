// node tests/design/run.mjs <path to the learner's repository>
// Step 13. Measures the same pages as design-check, with DW's own copy of the measuring code, and fails when
// the numbers differ from the learner's committed design-report.json by more than the tolerance.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { lengthsFromVariables, lighthouseScore, measurePage, newestArticlePath } from "./measure.mjs";

const learner = path.resolve(process.argv[2] ?? "../learner");
const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const tol = JSON.parse(fs.readFileSync(new URL("./tolerance.json", import.meta.url), "utf8"));
const chromePath = process.env.CHROME_PATH || undefined;

const reportFile = path.join(learner, "design-report.json");
if (!fs.existsSync(reportFile)) {
  console.error("Chapter 2.13: there is no design-report.json in your repository. Run npm run design-check and commit the file.");
  process.exit(1);
}
const committed = JSON.parse(fs.readFileSync(reportFile, "utf8"));
const variablesFile = path.join(learner, "styles", "variables.css");
const scale = lengthsFromVariables(fs.readFileSync(variablesFile, "utf8"));

const article = await newestArticlePath(base);
const paths = ["/", "/about", "/blog", article, "/style"];
const browser = await chromium.launch({ executablePath: chromePath });
const problems = [];
const lines = [];
const scores = [];
const measuredPaths = new Set();

for (const pagePath of paths) {
  if (!pagePath) continue;
  const mine = {};
  let skipped = false;
  for (const width of [375, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    await page.goto(base + pagePath, { waitUntil: "networkidle" });
    const result = await measurePage(page, scale);
    await context.close();
    if (result.main_text_length < 20) {
      skipped = true;
      break;
    }
    mine[String(width)] = result;
  }
  if (skipped) continue;
  measuredPaths.add(pagePath);
  let score = null;
  for (let attempt = 0; attempt < 2 && score === null; attempt++) {
    try {
      score = await lighthouseScore(base + pagePath, chromePath);
    } catch (error) {
      if (attempt === 1) {
        console.error(`Lighthouse did not finish for ${pagePath}: ${error.message.split("\n")[0]}`);
        process.exit(1);
      }
    }
  }
  scores.push(score);
  const theirs = committed.pages?.[pagePath];
  if (!theirs) {
    problems.push(`${pagePath}: your design-report.json has no entry for this page. Run npm run design-check again and commit it (chapter 2.13).`);
    continue;
  }
  for (const width of ["375", "1280"]) {
    const a = mine[width];
    const b = theirs[width];
    if (!b) {
      problems.push(`${pagePath} at ${width}: missing from your design-report.json.`);
      continue;
    }
    const tag = `${pagePath} at ${width}`;
    if (a.sizes.length !== b.sizes.length || a.sizes.some((s, i) => Math.abs(s - b.sizes[i]) > tol.size_px)) {
      problems.push(`${tag}: the sizes are ${a.sizes.join(", ")} but your file says ${b.sizes.join(", ")}.`);
    }
    if (a.ratio.best !== null && b.ratio.best !== null && Math.abs(a.ratio.best - b.ratio.best) > tol.ratio_best) {
      problems.push(`${tag}: the best ratio is ${a.ratio.best} but your file says ${b.ratio.best}.`);
    }
    if (a.measure_ch && b.measure_ch) {
      for (const k of ["min", "max"]) {
        // Line length in characters depends on how each system renders the font, so Windows, macOS and
        // Linux differ by a few characters. Compare it as a share, which still catches a number that was made up.
        if (Math.abs(a.measure_ch[k] - b.measure_ch[k]) > tol.measure_ch_relative * Math.max(a.measure_ch[k], b.measure_ch[k])) {
          problems.push(`${tag}: the ${k} line length is ${a.measure_ch[k]} characters but your file says ${b.measure_ch[k]}.`);
        }
      }
    }
    if (a.spacing_share !== null && b.spacing_share !== null && Math.abs(a.spacing_share - b.spacing_share) > tol.spacing_share) {
      problems.push(`${tag}: the spacing share is ${a.spacing_share} but your file says ${b.spacing_share}.`);
    }
    if (Math.abs(a.contrast_failures.length - b.contrast_failures.length) > tol.contrast_failures_count) {
      problems.push(`${tag}: ${a.contrast_failures.length} contrast failures measured, your file says ${b.contrast_failures.length}.`);
    }
    lines.push(`${tag}: sizes ${a.sizes.length}, ratio ${a.ratio.best}, measure ${a.measure_ch ? a.measure_ch.min + " to " + a.measure_ch.max : "n/a"}, spacing share ${a.spacing_share}, contrast failures ${a.contrast_failures.length}`);
  }
  if (theirs.accessibility !== null && Math.abs(score - theirs.accessibility) > tol.accessibility_points) {
    problems.push(`${pagePath}: Lighthouse accessibility is ${score} but your file says ${theirs.accessibility}.`);
  }
}
await browser.close();

for (const pagePath of Object.keys(committed.pages ?? {})) {
  if (!measuredPaths.has(pagePath) && paths.includes(pagePath)) {
    problems.push(`${pagePath}: your file has numbers for this page but it has no body text to measure here.`);
  }
}
for (const l of lines) console.log(l);
console.log(`Lowest Lighthouse accessibility measured: ${Math.min(...scores)}`);
if (problems.length > 0) {
  console.error("\nThe committed design-report.json does not match what the canonical run measured:");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("Run npm run design-check with npm run dev running, commit design-report.json, and push (chapter 2.13).");
  process.exit(1);
}
console.log("design-report.json matches the measurement.");
