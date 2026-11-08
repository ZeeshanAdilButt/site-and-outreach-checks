# site-and-outreach-checks

DW's own checks for the course Level 2, Your Site and Outreach Engine. A learner's repository calls the reusable
workflow `.github/workflows/canonical.yml` from its own `.github/workflows/checks.yml`, pinned to one commit of this
repository. The learner cannot change these tests.

## What the workflow does

It never runs the learner's `npm` scripts. It builds with `next build`, starts `next start`, and runs these tests.

| Step | What it checks | Where |
|---|---|---|
| 1 | Checks out the learner's repository with its full history | workflow |
| 2 | Checks out this repository at `checks_sha`, and checks that `checks.yml` pins the same commit in `uses` and in `checks_sha` | `scripts/verify-pin.mjs` |
| 3 | Runs the learner's `db/schema.sql` in a Postgres service, then DW's own seed | `tests/seed/` |
| 4 | `npm ci`, the browser, `next build` | workflow |
| 5 | Starts the site on port 3000 and waits up to 60 seconds | workflow |
| 6 | Unit tests that import the learner's `lib/filter.ts`, `open-rule.ts`, `tokens.ts`, `session.ts` and `visitor.ts` | `tests/unit/` |
| 7 | Views: a robot adds none, a real browser adds one | `tests/e2e/views.spec.ts` |
| 8 | Proposals: a robot stays fetched, a real browser opens and sees a section | `tests/e2e/proposals.spec.ts` |
| 9 | Redirects: 307, no-store, exactly one click, the recipient from `?r=` | `tests/e2e/redirects.spec.ts` |
| 10 | Login and data routes: 401 without a real session, the cookie flags | `tests/e2e/login.spec.ts` |
| 11 | The panel queries give DW's expected answers on DW's seed | `tests/unit/panels.test.ts` |
| 12 | A second copy on port 3001 with an unreachable database still answers | `tests/e2e/failsoft.spec.ts` |
| 13 | The design check, compared with the committed `design-report.json` | `tests/design/` |
| 14 | Each post has at least three commits, the biggest word-adding commit is not the last, the last one changes lines | `tests/commits/` |
| 15 | gitleaks (pinned binary, sha256 checked) over the whole history, and a scan for a connection string with a password and for `OWNER_SECRET=` with a value | `tests/secrets/` |

The run ends with one line, `canonical steps green: n of 15`.

Robot user agents are drawn at run time from `tests/robots.txt` (696 real robot strings, see `tests/robots.NOTICE.txt`).
Waits and other values are drawn from the run id.

## Run it on your machine

Needs the learner repository built and a Postgres. Example (Git Bash):

```text
export DATABASE_URL=postgres://postgres:pg@127.0.0.1:5435/sor_checks
export OWNER_SECRET=local-owner VISITOR_SECRET=local-visitor LEARNER=/path/to/learner
node tests/seed/load.mjs $LEARNER
npm run unit && npm run panels
# in the learner folder: npx next build, then next start -p 3100 (and 3101 with a closed database port)
export BASE_URL=http://localhost:3100 BASE_URL_DOWN=http://localhost:3101
npx playwright test
node tests/design/run.mjs $LEARNER
node tests/commits/check-commits.mjs $LEARNER
node tests/secrets/scan.mjs $LEARNER
```

`CHROME_PATH` points at a Chromium to use when Playwright's own browser is not installed. The workflow installs its own.

## Changing a check

A fix is a new commit here and a one-line change in the starter's `checks.yml`, announced in the course.
`tests/design/measure.mjs` is a copy of `scripts/design-measure.mjs` in the starter. Keep the two the same.
