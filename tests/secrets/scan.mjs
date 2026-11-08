// node tests/secrets/scan.mjs <path to the learner's repository>
// Step 15, part 2. Reads every line ever added in the whole history and fails on:
//  - a connection string that carries a password, for a host other than localhost or 127.0.0.1
//    (postgres://user:password@host). A test address like postgres://nobody@127.0.0.1:1/none passes;
//  - OWNER_SECRET= with a value, written as an env file line, in any file except .env.example.
// (The gitleaks scan of the same history runs as its own part of the step.)
import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";

const repo = path.resolve(process.argv[2] ?? "../learner");
const child = spawn("git", ["log", "--all", "-p", "--no-color", "-U0", "--format=@@@%h"], { cwd: repo });
const rl = readline.createInterface({ input: child.stdout });

const CONNECTION = /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|amqp):\/\/([^:\s/@"'`]+):([^@\s"'`]+)@([^/\s:?"'`]+)/gi;
const OWNER = /^\s*(?:export\s+)?OWNER_SECRET=(\S+)/;
const SAFE_HOSTS = new Set(["localhost", "127.0.0.1"]);

let commit = "";
let file = "";
const findings = [];
rl.on("line", (line) => {
  if (line.startsWith("@@@")) {
    commit = line.slice(3);
  } else if (line.startsWith("+++ b/")) {
    file = line.slice(6);
  } else if (line.startsWith("+") && !line.startsWith("+++")) {
    const text = line.slice(1);
    for (const m of text.matchAll(CONNECTION)) {
      const host = m[4].toLowerCase();
      // a placeholder such as <password> or $PASSWORD is not a real password
      if (SAFE_HOSTS.has(host) || /^[<$]/.test(m[3]) || m[3].toLowerCase() === "password") continue;
      findings.push(`${file} (commit ${commit}): a connection string with a password for the host ${host}. Chapter 4.4: keep it in .env.local and in Vercel only. Rotate that password, because it is in your history.`);
    }
    const o = text.match(OWNER);
    if (o && file !== ".env.example") {
      findings.push(`${file} (commit ${commit}): OWNER_SECRET= with a value. Chapter 4.10: never write the secret in a file that is committed. Make a new secret, because this one is in your history.`);
    }
  }
});
child.on("close", () => {
  if (findings.length > 0) {
    for (const f of [...new Set(findings)]) console.error(f);
    process.exit(1);
  }
  console.log("No connection string with a password and no OWNER_SECRET value in the history.");
});
