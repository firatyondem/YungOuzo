// Safety check: the private roster must never be committed.
// Exits with an error if content/players.real.json is tracked or staged.
//
//   node tools/check-private.js
//
// Runs automatically before every commit once the hook is enabled:
//   git config core.hooksPath .githooks
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const PRIVATE_FILES = ["content/players.real.json", "content/teams.real.json"];

const lines = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/\\/g, "/"))
    .filter(Boolean);

/**
 * Pure check so it can be tested with mocked git output.
 * tracked: output of `git ls-files`, staged: output of `git diff --cached --name-only --diff-filter=ACMR`.
 * Returns a list of problems (empty = safe).
 */
export function findPrivateFiles({ tracked = "", staged = "" } = {}) {
  const trackedSet = new Set(lines(tracked));
  const stagedSet = new Set(lines(staged));
  const problems = [];
  for (const file of PRIVATE_FILES) {
    if (stagedSet.has(file)) problems.push(`${file} is staged for commit`);
    else if (trackedSet.has(file)) problems.push(`${file} is tracked by git`);
  }
  return problems;
}

function git(args) {
  return execSync(`git ${args}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function main() {
  let problems;
  try {
    problems = findPrivateFiles({
      tracked: git(`ls-files -- ${PRIVATE_FILES.join(" ")}`),
      staged: git("diff --cached --name-only --diff-filter=ACMR"),
    });
  } catch (err) {
    console.error("check-private: could not run git:", err.message);
    process.exit(2);
  }
  if (problems.length) {
    console.error("\nPRIVATE ROSTER CHECK FAILED");
    for (const p of problems) console.error("  - " + p);
    console.error("\nFix:  git rm --cached content/players.real.json");
    console.error("The file stays on your disk; it must never be committed or deployed.\n");
    process.exit(1);
  }
  console.log("check-private: ok (private roster is not tracked or staged)");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
