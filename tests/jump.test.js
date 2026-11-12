import { test } from "node:test";
import assert from "node:assert/strict";
import { targets, nextTarget, keyLabel, roleOf, jumpFrom, jumpCommand, focusedAddress } from "../index/mods/index/model.js";
import { ag, term } from "./fixtures.js";

test("targets: blocked (with blocked subs at their parent) first, then done, list order", () => {
  const agents = [ag("a1", "s", "t", "working"), ag("a2", "s", "t", "blocked"), ag("a3", "s", "t", "done"), ag("a4", "s", "t", "blocked")];
  const terminals = [term("a1", null, "working"), term("k1", "a1", "blocked")];
  assert.deepEqual(targets({ agents, terminals }), ["k1", "a2", "a4", "a3"]);
});

test("targets ignores idle, working, done subs; error sub counts", () => {
  const agents = [ag("a1", "s", "t", "idle")];
  const terminals = [term("a1", null, "idle"), term("k1", "a1", "done"), term("k2", "a1", "error")];
  assert.deepEqual(targets({ agents, terminals }), ["k2"]);
});

test("targets does not double-count a kept sub-agent that is also in agents()", () => {
  const agents = [ag("a1", "s", "t", "idle"), ag("k1", "s", "t", "blocked")];
  const terminals = [term("a1", null, "idle"), term("k1", "a1", "blocked")];
  assert.deepEqual(targets({ agents, terminals }), ["k1"]);
});

test("nextTarget: empty, unknown current, wrap, middle, remote address", () => {
  assert.equal(nextTarget([], "x"), null);
  assert.equal(nextTarget(["a", "b"], null), "a");
  assert.equal(nextTarget(["a", "b"], "zz"), "a");
  assert.equal(nextTarget(["a", "b"], "b"), "a");
  assert.equal(nextTarget(["a", "box/t7", "c"], "a"), "box/t7");
});

test("keyLabel prefers the layout section and formats like macOS", () => {
  const keys = [
    { section: "global", keys: "cmd-k", action: "index.next-needs-you" },
    { section: "layout:index", keys: "cmd-j", action: "index.next-needs-you" },
    { section: "layout:index", keys: "cmd-shift-e", action: "index.files" },
  ];
  assert.equal(keyLabel(keys, "index.next-needs-you", true), "⌘J");
  assert.equal(keyLabel(keys, "index.files", true), "⇧⌘E");
  assert.equal(keyLabel(keys, "index.files", false), "Cmd+Shift+E");
  assert.equal(keyLabel(keys, "nope", true), null);
});

test("roleOf picks the role from props", () => {
  assert.deepEqual(
    [{ pane: "p1" }, { role: "strip" }, { role: "top" }, {}, { role: "bogus" }, undefined].map(roleOf),
    ["pane", "strip", "top", "sidebar", "sidebar", "sidebar"],
  );
});

test("jumpFrom continues from the last jump while focus stayed put or landed there", () => {
  const memory = { at: "k1", from: "a2" };
  assert.equal(jumpFrom(memory, "a2"), "k1"); // a peek doesn't move focus
  assert.equal(jumpFrom(memory, "k1"), "k1"); // landed on it
  assert.equal(jumpFrom(memory, "zz"), "zz"); // the person moved elsewhere
  assert.equal(jumpFrom(null, "a2"), "a2");
});

test("jumpCommand focuses agents with a pane and peeks at pane-less sub-agents", () => {
  const agents = [ag("a1", "s", "t", "blocked")];
  assert.deepEqual(jumpCommand("a1", agents), ["agent.focus", { terminal: "a1" }]);
  assert.deepEqual(jumpCommand("k1", agents), ["terminal.peek", { terminal: "k1" }]);
});

test("nextTarget moves on to what came after a target that has since left the list", () => {
  assert.equal(nextTarget(["a", "c", "d"], "b", ["c", "d"]), "c"); // "b" was done, looking at it made it idle
  assert.equal(nextTarget(["a"], "b", ["c"]), "a"); // nothing after it is left: start over
  assert.equal(nextTarget(["a", "b"], "a", ["zz"]), "b"); // still listed: plain next
});

test("a kept sub-agent's done counts as idle; its blocked still counts", () => {
  const agents = [ag("a1", "s", "t", "idle"), ag("k1", "s", "t", "done"), ag("k2", "s", "t", "blocked")];
  const terminals = [term("a1", null, "idle"), term("k1", "a1", "done"), term("k2", "a1", "blocked")];
  assert.deepEqual(targets({ agents, terminals }), ["k2"]);
});

test("focusedAddress prefers the focused terminal over the agent-block choice", () => {
  assert.equal(focusedAddress({ terminal: "t1", agent: "t9" }), "t1");
  assert.equal(focusedAddress({ terminal: null, agent: "t9" }), "t9");
  assert.equal(focusedAddress(null), null);
});
