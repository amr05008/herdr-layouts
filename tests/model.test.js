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

test("kidStatus: error counts as blocked, done as idle", () => {
  assert.equal(kidStatus(term("k", "a", "error"), new Map()), "blocked");
  assert.equal(kidStatus(term("k", "a", "done"), new Map()), "idle");
});

test("track stamps changes, treats done as idle, prunes old gone entries", () => {
  const c = { gone: { s: "idle", at: NOW - 31 * 24 * 60 * M } };
  assert.equal(track(c, [ag("a", "s", "t", "done")], NOW), true);
  assert.deepEqual(c, { a: { s: "idle", at: NOW } });
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

test("space with no agents: no status, no age, no detail", () => {
  const row = g({ spaces: [sp("a")] })[0].rows[0];
  assert.deepEqual([row.status, row.right, row.detail], [null, "", null]);
});

test("working agent: age from its stamp, no detail", () => {
  const row = g({
    spaces: [sp("a", { status: "working" })],
    agents: [ag("t1", "a", "a-t1", "working", { title: "Refactoring" })],
    changed: { t1: { s: "working", at: NOW - 5 * M } },
  })[0].rows[0];
  assert.deepEqual([row.status, row.right, row.detail], ["working", "5m", null]);
});

test("blocked row shows the agent's title as detail", () => {
  const row = g({ spaces: [sp("a", { status: "blocked" })], agents: [ag("t1", "a", "a-t1", "blocked", { title: "Wants to run git push" })] })[0].rows[0];
  assert.equal(row.detail, "Wants to run git push");
});

test("blocked row with non-telling title has no detail", () => {
  const row = g({ spaces: [sp("a", { status: "blocked" })], agents: [ag("t1", "a", "a-t1", "blocked", { title: "~/repos/x" })] })[0].rows[0];
  assert.equal(row.detail, null);
});

test("two agents: 'N agents' replaces age, kept sub-agents not counted", () => {
  const agents = [ag("t1", "a", "a-t1", "idle"), ag("t2", "a", "a-t1", "working"), ag("t3", "a", "a-t1", "idle")];
  const terminals = [term("t1", null, "idle"), term("t2", null, "working"), term("t3", "t1", "idle")];
  const row = g({ spaces: [sp("a", { status: "working" })], agents, terminals })[0].rows[0];
  assert.equal(row.right, "2 agents");
  assert.equal(row.status, "working");
});

test("blocked sub-agent lifts its space and shows as a sub row", () => {
  const terminals = [term("t1", null, "working"), term("k1", "t1", "blocked", { name: "review" })];
  const row = g({ spaces: [sp("a", { status: "working" })], agents: [ag("t1", "a", "a-t1", "working")], terminals })[0].rows[0];
  assert.equal(row.status, "blocked");
  assert.deepEqual(row.subs.map((s) => [s.address, s.label, s.status]), [["k1", "review", "blocked"]]);
});

test("done sub-agent does not lift its space", () => {
  const terminals = [term("t1", null, "idle"), term("k1", "t1", "done")];
  const row = g({ spaces: [sp("a", { status: "idle" })], agents: [ag("t1", "a", "a-t1", "idle")], terminals })[0].rows[0];
  assert.equal(row.status, "idle");
  assert.deepEqual(row.subs, []);
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

test("tab with two agents lists them by program key", () => {
  const s = sp("a", { active: true, tabs: [tb("a-t1", { active: true, panes: 2 })] });
  const agents = [ag("t1", "a", "a-t1", "idle"), ag("t2", "a", "a-t1", "idle", { program: { key: "codex", name: "Codex", agent: true } })];
  const tab = g({ spaces: [s], agents })[0].rows[0].tabs[0];
  assert.deepEqual(tab.agents.map((x) => x.label), ["claude", "codex"]);
});

test("tab detail only when blocked or done", () => {
  const s = sp("a", { active: true, tabs: [tb("a-t1", { active: true, named: true, name: "fix", status: "working" })] });
  const tab = g({ spaces: [s], agents: [ag("t1", "a", "a-t1", "working", { title: "Refactoring" })] })[0].rows[0].tabs[0];
  assert.equal(tab.detail, null);
});

test("space lifted only by a sub-agent: its text is on the sub row, not repeated on the space row", () => {
  const terminals = [term("t1", null, "working"), term("k1", "t1", "blocked", { name: "review", title: "Review needs a decision" })];
  const row = g({ spaces: [sp("a", { status: "working" })], agents: [ag("t1", "a", "a-t1", "working")], terminals })[0].rows[0];
  assert.equal(row.status, "blocked");
  assert.equal(row.detail, null);
  assert.equal(row.subs[0].detail, "Review needs a decision");
});

test("current space drops its detail when a tab row already says it", () => {
  const s = sp("a", { active: true, status: "blocked", tabs: [tb("a-t1", { active: true, status: "blocked" })] });
  const row = g({ spaces: [s], agents: [ag("t1", "a", "a-t1", "blocked", { title: "Wants to run git push" })] })[0].rows[0];
  assert.equal(row.tabs[0].name, "Wants to run git push");
  assert.equal(row.detail, null);
});

test("a kept sub-agent's done does not ring its space", () => {
  const agents = [ag("t1", "a", "a-t1", "idle"), ag("k1", "a", "a-t1", "done")];
  const terminals = [term("t1", null, "idle"), term("k1", "t1", "done")];
  const row = g({ spaces: [sp("a", { status: "done" })], agents, terminals })[0].rows[0];
  assert.equal(row.status, "idle");
});
