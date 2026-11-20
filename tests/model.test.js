import { test } from "node:test";
import assert from "node:assert/strict";
import { duration, telling, kidStatus, track, buildGroups } from "../index/mods/index/model.js";
import { sp, tb, ag, term, LOCAL } from "./fixtures.js";

const NOW = 1_800_000_000_000, M = 60_000;
const g = (o) => buildGroups({ spaces: [], agents: [], terminals: [], machines: LOCAL, changed: {}, now: NOW, ...o });

test("duration formats like stock", () => {
  assert.deepEqual([30e3, 5 * M, 90 * M, 50 * 60 * M].map(duration), ["<1m", "5m", "1h", "2d"]);
});

test("telling drops paths, user@host and the program name", () => {
  const p = { key: "claude", name: "Claude Code" };
  assert.equal(telling("Wants to run git push", p), "Wants to run git push");
  for (const bad of ["", "~/repos/x", "/tmp", "me@box", "Claude Code", "claude"]) assert.equal(telling(bad, p), null);
});

test("kidStatus: error and blocked ask, working works, anything else is quiet", () => {
  assert.equal(kidStatus(term("k", "a", "error"), new Map()), "asks");
  assert.equal(kidStatus(term("k", "a", "blocked"), new Map()), "asks");
  assert.equal(kidStatus(term("k", "a", "working"), new Map()), "working");
  assert.equal(kidStatus(term("k", "a", "done"), new Map()), "quiet");
});

test("track stamps changes, treats done as idle, prunes old gone entries", () => {
  const c = { gone: { s: "idle", at: NOW - 31 * 24 * 60 * M } };
  assert.equal(track(c, [ag("a", "s", "t", "done")], NOW), true);
  assert.deepEqual(c, { a: { s: "idle", at: NOW, turn: true, fresh: true } });
  assert.equal(track(c, [ag("a", "s", "t", "idle")], NOW + M), false);
});

test("one machine: one group, no label", () => {
  const r = g({ spaces: [sp("a"), sp("b")] });
  assert.equal(r.length, 1);
  assert.equal(r[0].label, null);
  assert.deepEqual(r[0].rows.map((x) => x.id), ["a", "b"]);
});

test("two machines: labelled groups in spaces() order", () => {
  const r = g({ spaces: [sp("a"), sp("c", { machine: "box" })], machines: [...LOCAL, { name: "box", layout: "ready" }] });
  assert.deepEqual(r.map((x) => x.label), ["This computer", "box"]);
});

test("offline machine without spaces still shows its label", () => {
  const r = g({ spaces: [sp("a")], machines: [...LOCAL, { name: "box", layout: "unavailable" }] });
  assert.deepEqual(r[1], { machine: "box", label: "box · offline", offline: true, rows: [] });
});

test("offline machine with spaces keeps its rows", () => {
  const r = g({ spaces: [sp("a"), sp("c", { machine: "box" })], machines: [...LOCAL, { name: "box", layout: "unavailable" }] });
  assert.equal(r[1].label, "box · offline");
  assert.equal(r[1].rows.length, 1);
});


const stamp = (s, ago, turn = false) => ({ s, at: NOW - ago, turn });
const pick = (row) => [row.status, row.lit, row.right, row.detail];

test("space with no agents: no status, no age, no detail, not lit", () => {
  const row = g({ spaces: [sp("a")] })[0].rows[0];
  assert.deepEqual(pick(row), [null, false, "", null]);
});

test("working agent: age from its stamp, not lit", () => {
  const row = g({
    spaces: [sp("a")],
    agents: [ag("t1", "a", "a-t1", "working", { title: "Refactoring" })],
    changed: { t1: stamp("working", 5 * M) },
  })[0].rows[0];
  assert.deepEqual(pick(row), ["working", false, "5m", null]);
});

test("asks row is lit, says asks, shows age and title", () => {
  const row = g({
    spaces: [sp("a")],
    agents: [ag("t1", "a", "a-t1", "blocked", { title: "Wants to run git push" })],
    changed: { t1: stamp("blocked", 2 * M) },
  })[0].rows[0];
  assert.deepEqual(pick(row), ["asks", true, "asks", "2m · Wants to run git push"]);
});

test("asks row with a non-telling title shows just the age", () => {
  const row = g({
    spaces: [sp("a")],
    agents: [ag("t1", "a", "a-t1", "blocked", { title: "~/repos/x" })],
    changed: { t1: stamp("blocked", 2 * M) },
  })[0].rows[0];
  assert.equal(row.detail, "2m");
});

test("your-turn row is lit and shows how long it has waited", () => {
  const row = g({
    spaces: [sp("a")],
    agents: [ag("t1", "a", "a-t1", "idle", { title: "Release notes" })],
    changed: { t1: stamp("idle", 12 * M, true) },
  })[0].rows[0];
  assert.deepEqual(pick(row), ["turn", true, "your turn", "12m · Release notes"]);
});

test("your-turn row with a non-telling title shows just the age", () => {
  const row = g({
    spaces: [sp("a")],
    agents: [ag("t1", "a", "a-t1", "idle", { title: "~/repos/x" })],
    changed: { t1: stamp("idle", 12 * M, true) },
  })[0].rows[0];
  assert.equal(row.detail, "12m");
});

test("quiet agent: dim age, not lit", () => {
  const row = g({
    spaces: [sp("a")],
    agents: [ag("t1", "a", "a-t1", "idle")],
    changed: { t1: stamp("idle", 3 * 24 * 60 * M) },
  })[0].rows[0];
  assert.deepEqual(pick(row), ["quiet", false, "3d", null]);
});

test("two agents: 'N agents' replaces age, kept sub-agents not counted", () => {
  const agents = [ag("t1", "a", "a-t1", "idle"), ag("t2", "a", "a-t1", "working"), ag("t3", "a", "a-t1", "idle")];
  const terminals = [term("t1", null, "idle"), term("t2", null, "working"), term("t3", "t1", "idle")];
  const row = g({ spaces: [sp("a")], agents, terminals })[0].rows[0];
  assert.equal(row.right, "2 agents");
  assert.equal(row.status, "working");
});

test("lit space with two agents says the word, not the count", () => {
  const agents = [ag("t1", "a", "a-t1", "idle"), ag("t2", "a", "a-t1", "working")];
  const row = g({ spaces: [sp("a")], agents, changed: { t1: stamp("idle", M, true) } })[0].rows[0];
  assert.equal(row.right, "your turn");
});

test("blocked sub-agent lifts its space; the sub row is lit, the space row is not", () => {
  const terminals = [term("t1", null, "working"), term("k1", "t1", "blocked", { name: "review" })];
  const row = g({ spaces: [sp("a")], agents: [ag("t1", "a", "a-t1", "working")], terminals })[0].rows[0];
  assert.equal(row.status, "asks");
  assert.equal(row.lit, false);
  assert.equal(row.detail, null);
  const { address, label, status, lit, right } = row.subs[0];
  assert.deepEqual({ address, label, status, lit, right }, { address: "k1", label: "review", status: "asks", lit: true, right: "asks" });
});

test("done sub-agent does not lift its space", () => {
  const terminals = [term("t1", null, "idle"), term("k1", "t1", "done")];
  const row = g({ spaces: [sp("a")], agents: [ag("t1", "a", "a-t1", "idle")], terminals })[0].rows[0];
  assert.equal(row.status, "quiet");
  assert.deepEqual(row.subs, []);
});

test("space lifted only by a sub-agent: its text is on the sub row", () => {
  const terminals = [term("t1", null, "working"), term("k1", "t1", "blocked", { name: "review", title: "Review needs a decision" })];
  const row = g({ spaces: [sp("a")], agents: [ag("t1", "a", "a-t1", "working")], terminals })[0].rows[0];
  assert.equal(row.status, "asks");
  assert.equal(row.detail, null);
  assert.equal(row.subs[0].detail, "Review needs a decision");
});

test("current space lists its tabs; others do not; subs move under the tab", () => {
  const s = sp("a", { active: true, tabs: [tb("a-t1", { active: true }), tb("a-t2", { index: 2, name: "2", active: false })] });
  const terminals = [term("t1", null, "working"), term("k1", "t1", "blocked")];
  const r = g({ spaces: [s, sp("b")], agents: [ag("t1", "a", "a-t1", "working")], terminals })[0].rows;
  assert.deepEqual(r[0].tabs.map((t) => [t.id, t.active]), [["a-t1", true], ["a-t2", false]]);
  assert.deepEqual(r[0].subs, []);
  assert.equal(r[0].tabs[0].subs[0].address, "k1");
  assert.deepEqual(r[1].tabs, []);
});

test("current space is never lit; its waiting tab is", () => {
  const s = sp("a", { active: true, tabs: [tb("a-t1", { active: true })] });
  const row = g({
    spaces: [s],
    agents: [ag("t1", "a", "a-t1", "idle", { title: "Release notes" })],
    changed: { t1: stamp("idle", 12 * M, true) },
  })[0].rows[0];
  assert.equal(row.status, "turn");
  assert.equal(row.lit, false);
  assert.equal(row.detail, null);
  const tab = row.tabs[0];
  assert.deepEqual([tab.lit, tab.right, tab.name, tab.detail], [true, "your turn", "Release notes", "12m"]);
});

test("tab with two agents lists them by program key", () => {
  const s = sp("a", { active: true, tabs: [tb("a-t1", { active: true, panes: 2 })] });
  const agents = [ag("t1", "a", "a-t1", "idle"), ag("t2", "a", "a-t1", "idle", { program: { key: "codex", name: "Codex", agent: true } })];
  const tab = g({ spaces: [s], agents })[0].rows[0].tabs[0];
  assert.deepEqual(tab.agents.map((x) => x.label), ["claude", "codex"]);
});

test("split tab: agent rows lit, tab row not", () => {
  const s = sp("a", { active: true, tabs: [tb("a-t1", { active: true, panes: 2 })] });
  const agents = [ag("t1", "a", "a-t1", "idle"), ag("t2", "a", "a-t1", "idle")];
  const tab = g({ spaces: [s], agents, changed: { t1: stamp("idle", M, true) } })[0].rows[0].tabs[0];
  assert.equal(tab.lit, false);
  assert.deepEqual(tab.agents.map((a) => a.lit), [true, false]);
  assert.equal(tab.agents[0].right, "your turn");
});

test("tab detail only when lit", () => {
  const s = sp("a", { active: true, tabs: [tb("a-t1", { active: true, named: true, name: "fix" })] });
  const tab = g({ spaces: [s], agents: [ag("t1", "a", "a-t1", "working", { title: "Refactoring" })] })[0].rows[0].tabs[0];
  assert.deepEqual([tab.lit, tab.detail], [false, null]);
});

test("a kept sub-agent's finish never lights its space", () => {
  const agents = [ag("t1", "a", "a-t1", "idle"), ag("k1", "a", "a-t1", "idle")];
  const terminals = [term("t1", null, "idle"), term("k1", "t1", "idle")];
  const row = g({ spaces: [sp("a")], agents, terminals, changed: { k1: stamp("idle", M, true) } })[0].rows[0];
  assert.equal(row.status, "quiet");
  assert.equal(row.lit, false);
});

test("split tab: a kept sub-agent that asks gets its own lit row", () => {
  const s = sp("a", { active: true, tabs: [tb("a-t1", { active: true, named: true, name: "fix", panes: 3 })] });
  const agents = [ag("p", "a", "a-t1", "working"), ag("q", "a", "a-t1", "idle"), ag("k", "a", "a-t1", "blocked", { title: "Review needs approval" })];
  const terminals = [term("p", null, "working"), term("q", null, "idle"), term("k", "p", "blocked", { name: "review" })];
  const tab = g({ spaces: [s], agents, terminals })[0].rows[0].tabs[0];
  const lit = tab.agents.filter((x) => x.lit);
  assert.deepEqual(lit.map((x) => [x.address, x.label, x.right, x.detail]), [["k", "review", "asks", "Review needs approval"]]);
  assert.equal(tab.lit, false);
});
