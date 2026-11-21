import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildGroups, tally, targets, keyLabel, roleOf, agentStatus } from "../signal/mods/signal/model.js";
import { wash } from "../signal/mods/signal/colors.js";
import { sp, tb, ag, term, LOCAL } from "./fixtures.js";

const NOW = 1_800_000_000_000, M = 60_000;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const rows = (o) => buildGroups({ terminals: [], machines: LOCAL, now: NOW, ...o }).flatMap((g) => g.rows);

// Herdr refuses imports across mod folders, so Signal carries copies. They
// must not drift: both layouts read one record of who waits on you.
for (const f of ["model.js", "turns.js"]) {
  test(`signal's ${f} is Index's, byte for byte`, () => {
    assert.equal(read(`signal/mods/signal/${f}`), read(`index/mods/index/${f}`));
  });
}

// site (current): tab 1 working, tab 2 finished. api asks. docs parked.
const world = () => {
  const spaces = [
    sp("site", { active: true, tabs: [tb("site-t1"), tb("site-t2", { active: false })] }),
    sp("api"),
    sp("docs"),
  ];
  const agents = [
    ag("a1", "site", "site-t1", "working"),
    ag("a2", "site", "site-t2", "idle", { title: "Added tests" }),
    ag("a3", "api", "api-t1", "blocked"),
    ag("a4", "docs", "docs-t1", "idle"),
  ];
  const changed = {
    a1: { s: "working", at: NOW - M },
    a2: { s: "idle", at: NOW - 4 * M, turn: true },
    a3: { s: "blocked", at: NOW - 2 * M },
    a4: { s: "idle", at: NOW - 300 * M },
  };
  return { spaces, agents, changed };
};

test("flat: the current space's row is lit and lists no tabs; Index's isn't", () => {
  const [site] = rows({ ...world(), flat: true });
  assert.equal(site.lit, true);
  assert.equal(site.status, "turn");
  assert.deepEqual(site.tabs, []);
  assert.match(site.detail, /^4m · Added tests$/);
  const [plain] = rows(world());
  assert.equal(plain.lit, false);
  assert.equal(plain.tabs.length, 2);
  assert.equal("agents" in plain, false);
});

test("flat: rows say their agent count, tabs, age, and a worker behind a waiting agent", () => {
  const [site, api, docs] = rows({ ...world(), flat: true });
  assert.deepEqual([site.agents, site.tabCount, site.alsoWorking], [2, 2, true]);
  assert.deepEqual([api.agents, api.alsoWorking, api.status], [1, false, "asks"]);
  assert.deepEqual([docs.status, docs.age, docs.lit], ["quiet", "5h", false]);
});

test("flat: a sub-agent that asks in the current space gets its own row", () => {
  const w = world();
  const terminals = [term("k1", "a1", "blocked", { name: "review" })];
  const [site] = rows({ ...w, terminals, flat: true });
  assert.deepEqual(site.subs.map((s) => [s.label, s.status, s.lit]), [["review", "asks", true]]);
});

test("tally: need is the ⌘J count; working and idle are the rest", () => {
  const w = world();
  const x = { agents: w.agents, terminals: [], changed: w.changed };
  assert.deepEqual(tally(x), { need: 2, working: 1, idle: 1 });
  assert.equal(tally(x).need, targets(x).length);
  // A sub-agent that asks adds to need without leaving working.
  const y = { ...x, terminals: [term("k1", "a1", "blocked")] };
  assert.deepEqual(tally(y), { need: 3, working: 1, idle: 1 });
  assert.equal(tally(y).need, targets(y).length);
});

// A pane label draws agentStatus: it must agree with the sidebar and ⌘J.
test("agentStatus: a kept sub-agent's finish is never a turn; its question still asks", () => {
  const parent = ag("a1", "site", "site-t1", "working");
  const kid = (status) => ag("k1", "site", "site-t1", status);
  const terminals = [term("a1", null, "working"), term("k1", "a1", "idle")];
  const changed = { a1: { s: "working", at: NOW }, k1: { s: "idle", at: NOW, turn: true } };
  assert.equal(agentStatus(kid("done"), terminals, changed), "quiet");
  assert.equal(agentStatus(kid("idle"), terminals, changed), "quiet");
  assert.equal(agentStatus(kid("working"), terminals, changed), "working");
  assert.equal(agentStatus(kid("blocked"), terminals, changed), "asks");
  assert.equal(agentStatus(parent, terminals, changed), "working");
  // The same stamp on an agent with no parent is a turn.
  assert.equal(agentStatus(kid("idle"), [term("k1", null, "idle")], changed), "turn");
  // And nothing else says the kept child waits.
  const x = { agents: [parent, kid("done")], terminals, changed };
  assert.deepEqual([tally(x).need, targets(x)], [0, []]);
});

test("keyLabel reads the section it's given; roleOf knows Signal's roles", () => {
  const keys = [
    { section: "layout:index", action: "x.go", keys: "cmd-k" },
    { section: "layout:signal", action: "x.go", keys: "cmd-j" },
  ];
  assert.equal(keyLabel(keys, "x.go", true), "⌘K");
  assert.equal(keyLabel(keys, "x.go", true, "layout:signal"), "⌘J");
  assert.deepEqual(["tabs", "bar", "top", "nope"].map((role) => roleOf({ role })), ["tabs", "bar", "top", "sidebar"]);
  assert.equal(roleOf({ pane: "p1" }), "pane");
});

// Two colors, one job each: the accent only for waiting, `working` only for working.
for (const name of ["signal-dark", "signal-light"]) {
  test(`${name}: amber only waits, teal only works`, () => {
    const theme = JSON.parse(read(`signal/themes/${name}.json`));
    const c = theme.colors;
    const named = (v) => [
      ...Object.entries(theme).filter(([, x]) => x === v).map(([k]) => k),
      ...(theme.ansi.includes(v) ? ["ansi"] : []),
      ...Object.entries(c).filter(([, x]) => x === v).map(([k]) => `colors.${k}`),
    ].sort();
    assert.deepEqual(named(c.accent), ["colors.accent", "colors.blocked", "colors.done"]);
    assert.deepEqual(named(c.working), ["colors.working"]);
    assert.notEqual(c.accent, c.working);
  });
}

test("wash is the accent at 18% on dark, 10% on light", () => {
  assert.equal(wash({ accent: "#fbbf24", chrome: "#0d1320" }), "#fbbf242e");
  assert.equal(wash({ accent: "#b45309", chrome: "#f9fafb" }), "#b453091a");
});

test("signal's keys are its own section and its own commands", () => {
  const keys = JSON.parse(read("signal/keys.json"));
  assert.deepEqual(Object.keys(keys), ["layout:signal"]);
  assert.ok(Object.values(keys["layout:signal"]).every((v) => v.startsWith("signal.")));
});
