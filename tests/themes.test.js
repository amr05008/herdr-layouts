import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Spec goal 2: one accent, used only for "needs you".
for (const name of ["index-dark", "index-light"]) {
  test(`${name} uses its accent only for needs-you colours`, () => {
    const theme = JSON.parse(readFileSync(new URL(`../index/themes/${name}.json`, import.meta.url)));
    const accent = theme.colors.accent;
    const uses = [
      ...Object.entries(theme).filter(([k, v]) => typeof v === "string" && v === accent).map(([k]) => k),
      ...Object.entries(theme.colors).filter(([, v]) => v === accent).map(([k]) => `colors.${k}`),
    ];
    assert.deepEqual(uses.sort(), ["colors.accent", "colors.blocked", "colors.done"]);
  });
}
