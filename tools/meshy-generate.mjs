// Generates the game's 3D models with the Meshy API (https://docs.meshy.ai).
// Node 18+, built-in fetch, no dependencies.
//
//   node tools/meshy-generate.mjs                  run every job that has no output yet
//   node tools/meshy-generate.mjs --group archetypes   only one group (archetypes|stars|variants|props)
//   node tools/meshy-generate.mjs --only sniper,big    only these job ids
//   node tools/meshy-generate.mjs --force sniper       regenerate one job even if its file exists
//   node tools/meshy-generate.mjs --dry-run            show the plan and the credit estimate, call nothing
//   node tools/meshy-generate.mjs --budget 600         stop starting jobs at this many credits (default 1000)
//
// The key is read from the environment variable MESHY_API_KEY, or from a line
// MESHY_API_KEY=... in a .env file next to package.json (.env is gitignored).
// It is never printed, logged or written anywhere.
//
// Per job (tools/meshy-jobs.json):
//   Text to 3D preview -> poll -> refine (texture) -> poll -> [humanoid: rig -> poll
//   -> animations -> poll] -> download the final GLB (animated, else rigged, else textured).
// Up to 5 jobs run in parallel, polled every 10 s, 15 minutes per job. A failed
// job never stops the others. Credits are counted from each task's
// `consumed_credits`; no new job starts once spent + its estimate would pass the
// budget. Every task id and its credits are appended to tools/meshy-ledger.json.
//
// Endpoints used (as documented):
//   POST/GET https://api.meshy.ai/openapi/v2/text-to-3d      preview and refine
//   POST/GET https://api.meshy.ai/openapi/v1/rigging         auto-rigging (humanoids)
//   POST/GET https://api.meshy.ai/openapi/v1/animations      preset animations (action_ids)
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.meshy.ai/openapi";
const LEDGER = join(root, "tools/meshy-ledger.json");
const POLL_MS = 10_000;
const JOB_TIMEOUT_MS = 15 * 60_000;
const PARALLEL = 5;
const BIG_FILE = 5 * 1024 * 1024;
// Documented prices (docs.meshy.ai/en/api/pricing), used for estimates only.
const PRICE = { preview: { "meshy-6-lite": 5, "meshy-t2": 5, "meshy-t2.5": 5, "meshy-6": 20, "meshy-7.1": 20, latest: 20 }, refine: 10, rig: 5, action: 3 };

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const DRY = flag("--dry-run");
const FORCE = new Set((value("--force") || "").split(",").filter(Boolean));
const ONLY = new Set((value("--only") || "").split(",").filter(Boolean));
const GROUP = value("--group");
const BUDGET = Number(value("--budget")) || 1000;

function readKey() {
  if (process.env.MESHY_API_KEY) return process.env.MESHY_API_KEY.trim();
  const envFile = join(root, ".env");
  if (existsSync(envFile)) {
    const line = readFileSync(envFile, "utf8").split(/\r?\n/).find((l) => /^\s*MESHY_API_KEY\s*=/.test(l));
    if (line) return line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  }
  return "";
}
const KEY = readKey();

const config = JSON.parse(readFileSync(join(root, "tools/meshy-jobs.json"), "utf8"));
const defaults = config.defaults || {};
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { note: "Meshy tasks started by tools/meshy-generate.mjs. Credits come from each task's consumed_credits.", tasks: [] };
const spentBefore = ledger.tasks.reduce((n, t) => n + (t.credits || 0), 0);
let spent = spentBefore;
let reserved = 0; // estimates of jobs that are running

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toTimeString().slice(0, 8);
const say = (id, text) => console.log(`${stamp()}  ${String(id).padEnd(22)} ${text}`);

function estimate(job) {
  const model = job.ai_model || defaults.ai_model || "meshy-6-lite";
  let n = (PRICE.preview[model] ?? 20) + PRICE.refine;
  if (job.humanoid) n += PRICE.rig + PRICE.action * Object.keys(job.animations || defaults.animations || {}).length;
  return n;
}

async function call(method, path, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${KEY}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 && attempt < 6) {
      await sleep(5000 * (attempt + 1)); // rate limited: wait and retry
      continue;
    }
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) throw new Error(`${method} ${path.replace(/[0-9a-f-]{20,}/, ":id")} -> ${res.status} ${(data && (data.message || data.error)) || text.slice(0, 160)}`);
    return data;
  }
}

function record(job, step, id, credits) {
  ledger.tasks.push({ job: job.id, step, id, credits: credits || 0, at: new Date().toISOString() });
  spent += credits || 0;
  writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + "\n");
}

/** Poll a task until it succeeds. Throws on FAILED / CANCELED / timeout. */
async function waitFor(job, step, path, id, deadline) {
  let last = -1;
  for (;;) {
    if (Date.now() > deadline) throw new Error(`${step}: timed out after 15 minutes`);
    const t = await call("GET", `${path}/${id}`);
    if (t.status === "SUCCEEDED") {
      record(job, step, id, t.consumed_credits);
      say(job.id, `${step} done (${t.consumed_credits ?? "?"} credits)`);
      return t;
    }
    if (t.status === "FAILED" || t.status === "CANCELED") {
      record(job, step, id, 0);
      throw new Error(`${step} ${t.status}: ${(t.task_error && t.task_error.message) || "no reason given"}`);
    }
    if (t.progress !== last) {
      last = t.progress;
      say(job.id, `${step} ${t.status === "PENDING" ? `queued${t.preceding_tasks ? ` (${t.preceding_tasks} ahead)` : ""}` : `${t.progress ?? 0}%`}`);
    }
    await sleep(POLL_MS);
  }
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
  return buf.length;
}

async function runJob(job) {
  const out = join(root, job.output);
  const deadline = Date.now() + JOB_TIMEOUT_MS;
  const model = job.ai_model || defaults.ai_model || "meshy-6-lite";
  const prompt = `${job.style === false ? "" : config.style ? config.style + ", " : ""}${job.prompt}`.slice(0, 800);

  // 1. Preview (mesh). Low-poly, game-ready: remesh to the target face count.
  const preview = await call("POST", "/v2/text-to-3d", {
    mode: "preview",
    prompt,
    ai_model: model,
    should_remesh: true,
    topology: "triangle",
    target_polycount: job.target_polycount || defaults.target_polycount || 15000,
    ...(job.humanoid ? { pose_mode: "a-pose" } : {}),
  });
  say(job.id, "preview started");
  await waitFor(job, "preview", "/v2/text-to-3d", preview.result, deadline);

  // 2. Refine (texture).
  const refine = await call("POST", "/v2/text-to-3d", {
    mode: "refine",
    preview_task_id: preview.result,
    enable_pbr: false,
    ...(job.texture_prompt || config.texture_prompt ? { texture_prompt: (job.texture_prompt || config.texture_prompt).slice(0, 800) } : {}),
  });
  say(job.id, "texture started");
  const textured = await waitFor(job, "refine", "/v2/text-to-3d", refine.result, deadline);
  let finalUrl = textured.model_urls && textured.model_urls.glb;
  let kind = "textured";

  // 3. Rig + animations (humanoids only). A failure here keeps the textured model.
  if (job.humanoid) {
    try {
      const rig = await call("POST", "/v1/rigging", { input_task_id: refine.result, height_meters: job.height_meters || 1.9 });
      say(job.id, "rigging started");
      const rigged = await waitFor(job, "rig", "/v1/rigging", rig.result, deadline);
      const r = rigged.result || {};
      if (r.rigged_character_glb_url) {
        finalUrl = r.rigged_character_glb_url;
        kind = "rigged";
      }
      const actions = Object.values(job.animations || defaults.animations || {}).filter((n) => Number.isInteger(n));
      if (actions.length) {
        const anim = await call("POST", "/v1/animations", { rig_task_id: rig.result, action_ids: [...new Set(actions)].slice(0, 10) });
        say(job.id, `animations started (${actions.length} clips)`);
        const animated = await waitFor(job, "animate", "/v1/animations", anim.result, deadline);
        const a = animated.result || {};
        if (a.animation_glb_url) {
          finalUrl = a.animation_glb_url;
          kind = "rigged + animated";
        }
      }
    } catch (err) {
      say(job.id, `rig/animation skipped: ${err.message}`);
    }
  }

  if (!finalUrl) throw new Error("no GLB url in the result");
  const bytes = await download(finalUrl, out);
  say(job.id, `saved ${job.output} (${kind}, ${(bytes / 1048576).toFixed(1)} MB)${bytes > BIG_FILE ? "  ** over 5 MB **" : ""}`);
  return { bytes, kind };
}

// ---------- plan ----------
let jobs = config.jobs.filter((j) => (!GROUP || j.group === GROUP) && (!ONLY.size || ONLY.has(j.id)));
for (const id of FORCE) if (!config.jobs.some((j) => j.id === id)) console.log(`--force: no job called ${id}`);
if (FORCE.size && !ONLY.size && !GROUP) jobs = config.jobs.filter((j) => FORCE.has(j.id));
const todo = jobs.filter((j) => FORCE.has(j.id) || !existsSync(join(root, j.output)));
const skipped = jobs.length - todo.length;
const need = todo.reduce((n, j) => n + estimate(j), 0);
console.log(`jobs: ${todo.length} to run, ${skipped} already done. Estimated ${need} credits; ${spentBefore} used so far; budget ${BUDGET}.`);
if (DRY) {
  let running = spentBefore;
  for (const j of todo) {
    const e = estimate(j);
    const ok = running + e <= BUDGET;
    if (ok) running += e;
    console.log(`  ${ok ? "run " : "SKIP"}  ${j.id.padEnd(22)} ${String(e).padStart(3)} credits  -> ${j.output}`);
  }
  console.log(`dry run: nothing was sent. Would use ${running - spentBefore} credits (total ${running} of ${BUDGET}).`);
  process.exit(0);
}
if (!todo.length) process.exit(0);
if (!KEY) {
  console.error("MESHY_API_KEY is not set (environment variable, or MESHY_API_KEY=... in .env). Nothing was sent.");
  process.exit(1);
}

// ---------- run: up to PARALLEL jobs at once ----------
const queue = [...todo];
const results = [];
async function worker() {
  for (;;) {
    const job = queue.shift();
    if (!job) return;
    const cost = estimate(job);
    if (spent + reserved + cost > BUDGET) {
      say(job.id, `not started: ${spent} used + ${reserved} running + ${cost} would pass the ${BUDGET}-credit budget`);
      results.push({ id: job.id, ok: false, error: "budget" });
      continue;
    }
    reserved += cost;
    const before = spent;
    try {
      const r = await runJob(job);
      results.push({ id: job.id, ok: true, credits: spent - before, ...r });
    } catch (err) {
      say(job.id, `FAILED: ${err.message}`);
      results.push({ id: job.id, ok: false, error: err.message, credits: spent - before });
    } finally {
      reserved -= cost;
    }
  }
}
await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker));

console.log("\nsummary");
for (const r of results) console.log(`  ${r.ok ? "ok    " : "failed"}  ${r.id.padEnd(22)} ${r.ok ? `${r.kind}, ${(r.bytes / 1048576).toFixed(1)} MB, ${r.credits} credits` : r.error}`);
const big = results.filter((r) => r.ok && r.bytes > BIG_FILE).map((r) => r.id);
if (big.length) console.log(`over 5 MB: ${big.join(", ")}`);
console.log(`credits this run: ${spent - spentBefore}. Total used: ${spent} of ${BUDGET}.`);
console.log("Run `node tools/update-assets.js` so the game picks up the new files.");
for (const j of todo) if (existsSync(join(root, j.output)) && statSync(join(root, j.output)).size === 0) console.log(`empty file: ${j.output}`);
