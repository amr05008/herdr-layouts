import { test } from "node:test";
import assert from "node:assert/strict";
import { track, dismiss, ownStatus } from "../index/mods/index/model.js";
import { ag } from "./fixtures.js";

const NOW = 1_800_000_000_000, M = 60_000;
const a = (status) => ag("a", "s", "t", status);

test("working then idle is your turn", () => {
  const c = { a: { s: "working", at: NOW, turn: false } };
  assert.equal(track(c, [a("idle")], NOW + M), true);
  assert.deepEqual(c.a, { s: "idle", at: NOW + M, turn: true });
});

test("looking does not end a turn", () => {
  const c = { a: { s: "working", at: NOW, turn: false } };
  track(c, [a("done")], NOW + M);
  assert.equal(track(c, [a("idle")], NOW + 2 * M), false);
  assert.deepEqual(c.a, { s: "idle", at: NOW + M, turn: true });
});

test("working again ends the turn", () => {
  const c = { a: { s: "idle", at: NOW, turn: true } };
  track(c, [a("working")], NOW + M);
  assert.deepEqual(c.a, { s: "working", at: NOW + M, turn: false });
});

test("asking ends the turn, and idle after asking is a turn", () => {
  const c = { a: { s: "idle", at: NOW, turn: true } };
  track(c, [a("blocked")], NOW + M);
  assert.equal(c.a.turn, false);
  track(c, [a("idle")], NOW + 2 * M);
  assert.equal(c.a.turn, true);
});

test("first sight: idle is quiet, done is your turn", () => {
  const c = {};
  track(c, [ag("i", "s", "t", "idle"), ag("d", "s", "t", "done"), ag("w", "s", "t", "working")], NOW);
  assert.deepEqual([c.i.turn, c.d.turn, c.w.turn], [false, true, false]);
});

test("a done the stamps missed lights a quiet agent", () => {
  const c = { a: { s: "idle", at: NOW, turn: false } };
  assert.equal(track(c, [a("done")], NOW + M), true);
  assert.deepEqual(c.a, { s: "idle", at: NOW + M, turn: true });
});

test("track is idempotent", () => {
  const c = {};
  const list = [ag("i", "s", "t", "idle"), ag("d", "s", "t", "done"), ag("w", "s", "t", "working")];
  track(c, list, NOW);
  assert.equal(track(c, list, NOW + M), false);
});

test("a stamp from before this change reads as quiet", () => {
  const c = { a: { s: "idle", at: NOW } };
  assert.equal(track(c, [a("idle")], NOW + M), false);
  assert.equal(ownStatus(a("idle"), c), "quiet");
});

test("dismiss clears a turn and only a turn", () => {
  const c = { a: { s: "idle", at: NOW, turn: true }, b: { s: "working", at: NOW, turn: false } };
  assert.equal(dismiss(c, "a"), true);
  assert.deepEqual(c.a, { s: "idle", at: NOW, turn: false, dismissed: true });
  for (const addr of ["a", "b", "box/t7", null]) assert.equal(dismiss(c, addr), false);
});

test("the next finish after a dismiss lights again", () => {
  const c = { a: { s: "idle", at: NOW, turn: true } };
  dismiss(c, "a");
  track(c, [a("working")], NOW + M);
  track(c, [a("idle")], NOW + 2 * M);
  assert.equal(c.a.turn, true);
});

test("ownStatus maps Herdr's status and the stamp", () => {
  const turn = { a: { s: "idle", at: NOW, turn: true } };
  assert.equal(ownStatus(a("blocked"), turn), "asks");
  assert.equal(ownStatus(a("working"), turn), "working");
  assert.equal(ownStatus(a("idle"), turn), "turn");
  assert.equal(ownStatus(a("idle"), {}), "quiet");
});

// Final-review fixes (Pi, /tmp/review-t3q.md).
import { asRecord, mergeLegacy } from "../index/mods/index/model.js";

test("dismissing a done finish survives the same done", () => {
  const c = {};
  track(c, [a("done")], NOW);
  dismiss(c, "a");
  assert.equal(track(c, [a("done")], NOW + M), false);
  assert.equal(c.a.turn, false);
  assert.equal(c.a.at, NOW);
});

test("strip-first startup: an old working stamp still lights its finish", () => {
  const r = {};
  track(r, [a("idle")], NOW); // the strip saw it first: a fresh, quiet stamp
  const { record, changed } = mergeLegacy(r, { a: { s: "working", at: NOW - 60 * M } });
  assert.equal(changed, true);
  track(record, [a("idle")], NOW + M);
  assert.deepEqual([record.a.turn, record.a.at], [true, NOW + M]);
});

test("mergeLegacy keeps stamps that carry real history", () => {
  const r = { a: { s: "idle", at: NOW, turn: false, dismissed: true }, b: { s: "idle", at: NOW, turn: true } };
  const { record, changed } = mergeLegacy(r, { a: { s: "working", at: 1 }, b: { s: "working", at: 1 }, c: { s: "idle", at: 5 } });
  assert.equal(changed, true);
  assert.deepEqual(record.a, r.a);
  assert.deepEqual(record.b, r.b);
  assert.deepEqual(record.c, { s: "idle", at: 5 });
});

test("asRecord turns anything that isn't a record of stamps into one", () => {
  for (const bad of [[], "x", 7, null, undefined]) assert.deepEqual(asRecord(bad), {});
  assert.deepEqual(asRecord({ a: null, b: { s: "idle", at: 1 }, c: { s: 3, at: "x" }, d: [] }), { b: { s: "idle", at: 1 } });
});

test("a malformed saved record settles after one write (no redraw loop)", () => {
  const list = [a("idle")];
  const first = asRecord([]);
  assert.equal(track(first, list, NOW), true);
  const saved = asRecord(JSON.parse(JSON.stringify(first)));
  assert.equal(track(saved, list, NOW + M), false);
});
