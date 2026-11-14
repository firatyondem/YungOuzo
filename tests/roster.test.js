import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readJson, content } from "./helpers.js";
import { loadRoster, validateRoster, LEAGUE_URL, REAL_URL } from "../src/roster.js";
import { normalizeLook, LOOK_DEFAULTS, HAIR, BEARD, BUILD, ACCESSORIES, isHexColor } from "../src/look.js";
import { generatePlayerAvatar, avatarHTML } from "../src/ui/avatar.js";
import { findPrivateFiles } from "../tools/check-private.js";

const league = readJson("content/players.league.json");
const example = readJson("content/players.real.example.json");
const realRoster = league.map((p, i) => ({ ...p, name: `Private Player ${i + 1}` }));

/** Fake fetch: `files` maps url -> data | Error | "raw:<text>". Records every requested URL. */
function mockFetch(files) {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    if (!(url in files)) return { ok: false, status: 404, json: async () => ({}) };
    const v = files[url];
    if (v instanceof Error) throw v;
    if (typeof v === "string" && v.startsWith("raw:")) {
      return { ok: true, status: 200, json: async () => JSON.parse(v.slice(4)) };
    }
    return { ok: true, status: 200, json: async () => v };
  };
  return { fetchFn, calls };
}

// ---------- Roster loader ----------

test("roster: no query parameter loads the league roster", async () => {
  const { fetchFn, calls } = mockFetch({ [LEAGUE_URL]: league, [REAL_URL]: realRoster });
  const r = await loadRoster({ search: "", fetchFn });
  assert.equal(r.source, "league");
  assert.equal(r.players, league);
  assert.equal(r.warning, undefined);
  assert.deepEqual(calls, [LEAGUE_URL]);
});

test("roster: ?roster=league loads the league roster", async () => {
  const { fetchFn, calls } = mockFetch({ [LEAGUE_URL]: league, [REAL_URL]: realRoster });
  const r = await loadRoster({ search: "?roster=league", fetchFn });
  assert.equal(r.source, "league");
  assert.deepEqual(calls, [LEAGUE_URL]);
});

test("roster: ?roster=real requests and loads the real roster", async () => {
  const { fetchFn, calls } = mockFetch({ [LEAGUE_URL]: league, [REAL_URL]: realRoster });
  const r = await loadRoster({ search: "?roster=real", fetchFn });
  assert.equal(r.source, "real");
  assert.equal(r.players, realRoster);
  assert.equal(r.warning, undefined);
  assert.deepEqual(calls, [REAL_URL], "league roster is not needed when the real one is valid");
  // Same schema regardless of source.
  assert.deepEqual(Object.keys(r.players[0]).sort(), Object.keys(league[0]).sort());
});

test("roster: missing real roster falls back to league with a warning", async () => {
  const { fetchFn, calls } = mockFetch({ [LEAGUE_URL]: league });
  const r = await loadRoster({ search: "?roster=real", fetchFn });
  assert.equal(r.source, "league");
  assert.equal(r.players, league);
  assert.match(r.warning, /not found/i);
  assert.deepEqual(calls, [REAL_URL, LEAGUE_URL]);

  // A network error behaves the same way.
  const net = mockFetch({ [LEAGUE_URL]: league, [REAL_URL]: new Error("offline") });
  const r2 = await loadRoster({ search: "?roster=real", fetchFn: net.fetchFn });
  assert.equal(r2.source, "league");
  assert.ok(r2.warning);
});

test("roster: invalid real roster falls back to league", async () => {
  const bad = [
    "raw:<!doctype html><html></html>", // a server answering 200 with an HTML page
    { not: "an array" },
    [],
    [{ id: "player_01" }],
    realRoster.map((p, i) => (i === 3 ? { ...p, ratings: { ...p.ratings, SHT: 9 } } : p)),
    realRoster.map((p, i) => (i === 0 ? { ...p, id: realRoster[1].id } : p)), // duplicate id
    example, // an unfilled copy of the example file (all names TODO)
  ];
  for (const data of bad) {
    const { fetchFn } = mockFetch({ [LEAGUE_URL]: league, [REAL_URL]: data });
    const r = await loadRoster({ search: "?roster=real", fetchFn });
    assert.equal(r.source, "league");
    assert.equal(r.players, league);
    assert.ok(r.warning, "a warning explains the fallback");
  }
  // A real roster that lacks a starting player is rejected too.
  const { fetchFn } = mockFetch({ [LEAGUE_URL]: league, [REAL_URL]: realRoster.slice(5) });
  const r = await loadRoster({ search: "?roster=real", fetchFn, requiredIds: ["player_01"] });
  assert.equal(r.source, "league");
});

test("roster: the real roster is never requested without the explicit parameter", async () => {
  const searches = [
    "", "?", "?roster", "?roster=", "?roster=league", "?roster=REAL", "?roster=Real", "?roster=real2",
    "?roster=true", "?real", "?real=1", "?css=1", "?player=real", "?roster=1", "?ROSTER=real", "?roster=real%20",
  ];
  for (const search of searches) {
    const { fetchFn, calls } = mockFetch({ [LEAGUE_URL]: league, [REAL_URL]: realRoster });
    const r = await loadRoster({ search, fetchFn });
    assert.equal(r.source, "league", `search "${search}"`);
    assert.ok(!calls.includes(REAL_URL), `"${search}" must not request the real roster`);
    assert.ok(calls.every((u) => !/real/i.test(u)), `"${search}" requested ${calls.join(", ")}`);
  }
  // The example file is never requested, in any mode.
  for (const search of ["", "?roster=real"]) {
    const { fetchFn, calls } = mockFetch({ [LEAGUE_URL]: league });
    await loadRoster({ search, fetchFn });
    assert.ok(calls.every((u) => !u.includes("example")));
  }
  // Works combined with other parameters.
  const { fetchFn, calls } = mockFetch({ [LEAGUE_URL]: league, [REAL_URL]: realRoster });
  const r = await loadRoster({ search: "?css=1&roster=real", fetchFn });
  assert.equal(r.source, "real");
  assert.deepEqual(calls, [REAL_URL]);
});

test("roster: league file is valid, example mirrors it with TODO names", () => {
  assert.equal(validateRoster(league).ok, true);
  assert.equal(example.length, league.length);
  example.forEach((p, i) => {
    assert.equal(p.name, "TODO");
    assert.deepEqual({ ...p, name: league[i].name }, league[i], `${p.id} matches the league entry`);
  });
  assert.equal(validateRoster(example).ok, false, "the unfilled example is not a usable roster");
});

// ---------- Appearance ----------

test("look: normalizeLook fills defaults for missing or invalid data", () => {
  for (const input of [undefined, null, {}, 42, "x", [], { hair: 7, beard: {}, build: null }]) {
    assert.deepEqual(normalizeLook(input), { ...LOOK_DEFAULTS, accessories: [] });
  }
  const partial = normalizeLook({ skinTone: 5, hair: "afro" });
  assert.deepEqual(partial, { ...LOOK_DEFAULTS, accessories: [], skinTone: 5, hair: "afro" });

  const messy = normalizeLook({
    skinTone: 9, hair: "mohawk", beard: "FULL", build: "giant",
    accessories: ["headband", "cape", "headband", 3, "goggles"], shoes: "red",
  });
  assert.equal(messy.skinTone, LOOK_DEFAULTS.skinTone);
  assert.equal(messy.hair, LOOK_DEFAULTS.hair);
  assert.equal(messy.beard, LOOK_DEFAULTS.beard);
  assert.equal(messy.build, LOOK_DEFAULTS.build);
  assert.deepEqual(messy.accessories, ["headband", "goggles"]);
  assert.equal(messy.shoes, LOOK_DEFAULTS.shoes);

  assert.equal(normalizeLook({ skinTone: "4" }).skinTone, 4);
  assert.equal(normalizeLook({ skinTone: 2.5 }).skinTone, LOOK_DEFAULTS.skinTone);
  assert.equal(normalizeLook({ shoes: "#abc" }).shoes, "#abc");
  // Valid looks pass through unchanged, and the result is always a fresh object.
  const valid = { skinTone: 6, hair: "bun", beard: "full", build: "tall", accessories: ["sleeve"], shoes: "#ff8800" };
  assert.deepEqual(normalizeLook(valid), valid);
  assert.notEqual(normalizeLook(valid).accessories, valid.accessories);
});

test("look: every league and opponent player has a complete, valid look", () => {
  const all = [...league, ...content.teams.flatMap((t) => t.players)];
  assert.equal(content.teams.every((t) => t.players.length === 5), true);
  for (const p of all) {
    assert.ok(p.look, `${p.id} has a look`);
    assert.deepEqual(normalizeLook(p.look), p.look, `${p.id} look is already valid`);
    assert.ok(isHexColor(p.look.shoes));
  }
  // Varied: every option is used somewhere.
  const used = (key) => new Set(all.flatMap((p) => p.look[key]));
  assert.equal(used("skinTone").size, 6);
  assert.deepEqual([...used("hair")].sort(), [...HAIR].sort());
  assert.deepEqual([...used("beard")].sort(), [...BEARD].sort());
  assert.deepEqual([...used("build")].sort(), [...BUILD].sort());
  assert.deepEqual([...used("accessories")].sort(), [...ACCESSORIES].sort());
  // Bigs are tall or strong.
  for (const p of league.filter((x) => x.archetype === "Big")) assert.ok(["tall", "strong"].includes(p.look.build));
});

/** Cheap well-formedness check: tags balance and nothing leaked into the markup. */
function assertValidSvg(svg) {
  assert.equal(typeof svg, "string");
  assert.ok(svg.startsWith("<svg ") && svg.endsWith("</svg>"));
  assert.ok(!/undefined|NaN|null|\[object/.test(svg), "no leaked values: " + svg.match(/undefined|NaN|null|\[object/));
  const stack = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)((?:"[^"]*"|[^>"])*?)(\/?)>/g)) {
    const [, close, name, , selfClose] = m;
    if (selfClose) continue;
    if (close) assert.equal(stack.pop(), name, `unbalanced </${name}>`);
    else stack.push(name);
  }
  assert.deepEqual(stack, []);
  assert.ok(!/https?:\/\/(?!www\.w3\.org\/2000\/svg)/.test(svg), "no external references");
}

test("avatar: every player produces a valid, distinct SVG portrait", () => {
  const seen = new Set();
  for (const p of league) {
    const svg = generatePlayerAvatar(p);
    assertValidSvg(svg);
    assert.ok(svg.includes(`>${p.jersey}</text>`), "jersey number is drawn");
    assert.ok(svg.includes(p.color), "jersey colour is used");
    seen.add(svg);
  }
  assert.equal(seen.size, league.length);
  for (const team of content.teams) {
    for (const p of team.players) assertValidSvg(generatePlayerAvatar(p, { color: team.color }));
  }
  // Each option changes the picture.
  const base = { name: "X", jersey: 1, color: "#ff8800", look: { ...LOOK_DEFAULTS, hair: "bald" } };
  const draw = (look) => generatePlayerAvatar({ ...base, look: { ...base.look, ...look } });
  const variants = [
    draw({}), ...HAIR.filter((h) => h !== "bald").map((hair) => draw({ hair })),
    draw({ beard: "stubble" }), draw({ beard: "full" }),
    ...BUILD.filter((b) => b !== "average").map((build) => draw({ build })),
    ...ACCESSORIES.map((a) => draw({ accessories: [a] })), draw({ skinTone: 6 }),
  ];
  assert.equal(new Set(variants).size, variants.length);
});

test("avatar: invalid or missing data never crashes and still returns valid SVG", () => {
  const weird = [
    undefined, null, {}, 42, "player", [],
    { name: null, jersey: null, color: null, look: null },
    { name: "<script>alert(1)</script>", jersey: "<b>", color: "javascript:alert(1)", look: "nope" },
    { jersey: 123456, color: "#12", look: { skinTone: -1, hair: [], beard: 5, build: {}, accessories: "all", shoes: 7 } },
    { jersey: NaN, look: { skinTone: Infinity, accessories: [null, undefined, {}, "sleeve"] } },
    { name: 'A "quoted" name', jersey: "07", color: "#FFF", look: { accessories: ACCESSORIES } },
  ];
  for (const p of weird) {
    assertValidSvg(generatePlayerAvatar(p));
    assertValidSvg(generatePlayerAvatar(p, { color: "not-a-colour", number: {}, className: '"><x' }));
    const html = avatarHTML(p, { badge: true });
    assert.ok(html.startsWith("<span ") && html.endsWith("</span>"));
    assert.ok(!html.includes("<script>") && !html.includes("javascript:"));
  }
  assert.ok(!generatePlayerAvatar(weird[7]).includes("<script>"));
  assertValidSvg(generatePlayerAvatar({ jersey: 5 }, null));
});

// ---------- Private-file check ----------

test("check-private: fails when the private roster is tracked or staged", () => {
  assert.deepEqual(findPrivateFiles({ tracked: "", staged: "" }), []);
  assert.deepEqual(findPrivateFiles(), []);
  assert.deepEqual(
    findPrivateFiles({ tracked: "content/players.league.json\ncontent/players.real.example.json\n", staged: "README.md\n" }),
    [],
    "the example and league files are fine"
  );
  const tracked = findPrivateFiles({ tracked: "content/players.real.json\n", staged: "" });
  assert.equal(tracked.length, 1);
  assert.match(tracked[0], /tracked/);
  const staged = findPrivateFiles({ tracked: "", staged: "src/main.js\r\ncontent/players.real.json\r\n" });
  assert.equal(staged.length, 1);
  assert.match(staged[0], /staged/);
  assert.equal(findPrivateFiles({ tracked: "", staged: "content\\players.real.json" }).length, 1, "Windows paths");
});

test("check-private: the repository itself is clean and ignores the private roster", () => {
  const run = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  let inRepo = true;
  try {
    run("git rev-parse --is-inside-work-tree");
  } catch {
    inRepo = false; // e.g. a zip download without .git: nothing to check
  }
  if (!inRepo) return;
  assert.equal(run("git ls-files -- content/players.real.json").trim(), "", "private roster must not be tracked");
  assert.ok(run("git check-ignore content/players.real.json").includes("players.real.json"), ".gitignore covers it");
  assert.match(run("node tools/check-private.js"), /ok/);
});
