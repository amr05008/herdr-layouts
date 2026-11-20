import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isLight, mix, wash, quiet } from "../index/mods/index/colors.js";

const colors = (name) => JSON.parse(readFileSync(new URL(`../index/themes/${name}.json`, import.meta.url))).colors;
const dark = colors("index-dark"), light = colors("index-light");

test("wash is the accent with a little alpha, more on dark", () => {
  assert.equal(wash(dark), "#60a5fa26");
  assert.equal(wash(light), "#2563eb17");
});

test("quiet is dim mixed 35% toward the sidebar", () => {
  assert.equal(quiet(dark), "#404857");
  assert.equal(quiet(light), "#bdc1ca");
});

test("isLight tells the two sidebars apart", () => {
  assert.equal(isLight("#0d1320"), false);
  assert.equal(isLight("#f9fafb"), true);
});

test("mix returns #rrggbb", () => {
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
});
