# Index Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Index layout (a quiet one-list sidebar where only "needs you" uses the accent color) as an installable folder in this repo, then install it into Aaron's Herdr.

**Architecture:** One Herdr mod, `index`, plays four roles chosen by its block's props: `sidebar` (the list), `top` (the empty drag strip above it), `strip` (the work area's top strip, which owns ⌘J and the Files/Changes keys), and `pane` (the label on split panes). All decisions about what to show live in `model.js`. It is pure JavaScript that imports nothing, so Node can unit-test it. The role files only draw what the model returns. `install.sh` copies the folder into `~/.config/herdr-app` and merges the keys with `tools/merge_keys.py`.

**Tech Stack:** Herdr app 0.1.14 mods (gpui-kit JavaScript; API in `~/.config/herdr-app/herdr.d.ts` and `gpui-kit.d.ts`), Node 25 `node:test`, Python 3 `unittest`, bash.

**Spec:** `plans/index-layout-2026-11-11.md` (approved 2026-11-11). Read it before starting. It holds the visual rules this plan does not repeat.

## Decisions made in this plan (Claude's calls, flippable)

- **One mod with roles instead of three mods.** Herdr refuses imports from outside a mod's folder: `herdr-app check` fails with "resolves outside the application directory" (verified 2026-11-11). ⌘J has to use the same logic as the sidebar, so all roles share one folder and one `model.js`. The shipped `win98` mod uses the same pattern.
- Keys live in a `layout:index` section, so they only apply while Index is showing: ⌘J goes to the next agent that needs you, ⌘⇧E shows or hides Files, ⌘⇧G shows or hides Changes.
- Machine labels are hidden when there is only one group. A lone "This computer" label carries no information.
- A detail line with no useful title is dropped. If a blocked or done agent's title is a path, a `user@host` string or the program name, the row stays one line.
- Tab rows reuse stock's tab label rule: the agent's title for unnamed tabs, otherwise the tab's name.
- Testing uses fake agents. A test terminal reports its status by printing `ESC ] 7501 ; state=<word> BEL` and sets its title with `ESC ] 0 ; <title> BEL`. The OSC 7501 form was verified 2026-11-11.

## Global Constraints

- Use `hc` and `herdr-app`, never `herdr`. Never edit Herdr's shipped layouts or mods, `AGENTS.md`, the `.d.ts` files, or `layouts/.state/`.
- Everything the repo installs is named with the `index` prefix: `layouts/index.json`, `layouts/index.svg`, `mods/index/`, `themes/index-dark.json`, `themes/index-light.json`. The installer writes nothing else except the keys merge.
- `model.js` imports nothing. The role files import `gpui-kit`, `gpui-base`, `herdr` and `./model.js`.
- Exactly one accent per scheme, used only for "needs you". No icons, letter tiles or program glyphs anywhere.
- Animation must be native: `.loop("opacity", { from: 0.25, to: 1, period: 1400 })`. The only timer is the 30 s age refresh.
- Never keep a `cx` for later use. Each callback gets its own (AGENTS.md "A mod").
- Aaron's `settings.json` is never touched; its `"appearance": "dark"` pin stays. `keys.json` is backed up before any write.
- Nothing real goes into the repo: none of Aaron's space names, agent titles, terminal output or machine hostnames. Shots of the live window go to the session scratchpad, never into the repo.
- No git commits or pushes unless Aaron says to. Each "Checkpoint" step means "commit here if Aaron has okayed commits; otherwise move on".
- If the window gets stuck, `ctrl-alt-shift-escape` puts Herdr back on `main`.
- Test spaces made during the build are named `zz-test…` and are closed afterwards.

## Review Focus

1. **A remote machine goes offline.** Its label reads "<name> · offline" and nothing throws, whether or not its spaces are still listed. Pinned in Task 1 (`offline machine …` tests).
2. **An agent's title is useless** (a path, `user@host`, or the program's name). There is no detail line and the row stays one line. Pinned in Task 1 (`blocked row with non-telling title …`).
3. **Spaces with no agents** (plain shells). They get no mark, a dim name and no age, and they never count as needing you. Pinned in Task 1 (`space with no agents`) and Task 2 (`targets ignores …`).
4. **⌘J with nothing to do, or while focused on something that isn't a target.** With no targets it does nothing; otherwise it goes to the first target. It never throws, including for remote `machine/t7` addresses. Pinned in Task 2 (`nextTarget …`).
5. **Aaron already uses a key Index wants**, in any section, or `keys.json` doesn't exist. Index asks or skips, and never clobbers. Pinned in Task 4 (`merge …` and `install …` tests).

---

### Task 1: Repo scaffold and the sidebar model

**Files:**
- Create: `package.json`, `tests/fixtures.js`, `tests/model.test.js`, `index/mods/index/model.js`
- Modify: `.gitignore` (add `gpui-kit.d.ts`, `jsconfig.json`, `node_modules/`). Herdr writes the first two into any folder it checks.

**Interfaces:**
- Produces, in `index/mods/index/model.js`:
  - `RANK = { blocked: 4, done: 3, working: 2, idle: 1 }`
  - `duration(ms: number): string`: a copy of stock `agents/main.js` `duration()`, returning `"<1m"`, `"5m"`, `"1h"` or `"2d"`.
  - `telling(title: string, program: {key,name}): string | null`: stock's `title()` filter (`agents/main.js` lines 42–47). Returns the trimmed title, or null if it is empty, starts with `~` or `/`, contains `@`, or equals the program's name or key.
  - `kidStatus(term, listed: Map<string,Status>): Status`: the listed status if any, else `term.status`. `"error"` maps to `"blocked"` and `"done"` maps to `"idle"`.
  - `track(changed: Record<string,{s,at}>, agents, now): boolean`: a pure copy of stock `track()`. It stores `done` as `idle`, returns whether anything changed, and drops unlisted entries older than 30 days.
  - `buildGroups({ spaces, agents, terminals, machines, changed, now }): Group[]`
  - Shapes:
    - `Group = { machine: string|null, label: string|null, offline: boolean, rows: SpaceRow[] }`
    - `SpaceRow = { id, name, current, status: Status|null, detail: string|null, right: string, subs: Sub[], tabs: TabRow[] }`
    - `TabRow = { id, name, active, status, detail, agents: Sub[], subs: Sub[] }`
    - `Sub = { address, label, status, detail }`

Rules `buildGroups` must follow (copied from the spec):
- **Groups:** one group per machine, in `spaces()` order. Add a group for any machine in `machines()` whose `layout === "unavailable"` and which has no spaces.
- **Labels:** "This computer" for `null`, otherwise the machine's name. Add `" · offline"` (and set `offline: true`) when that machine is unavailable. Every label is null when there is exactly one group.
- **Agent count:** a space's agents are the `agents()` entries with that `space`, minus kept sub-agents (agents whose terminal in `terminals()` has a `parent`).
- **Space status:** the highest of `space.status` and `"blocked"` if any live sub-agent below one of its agents has `kidStatus === "blocked"`.
- **`right`:** `"N agents"` when N ≥ 2. Otherwise it is the age of the lead agent (rank first, then list order): `duration(now - changed[addr].at)`. It is `""` when there is no agent or no stamp.
- **`detail`:** only when the status is blocked or done. It is `telling(...)` of the space's first target, in `targets()` order from Task 2. Implement a private `spaceTargets` helper here, and Task 2 exports the general one.
- **`subs` on a space row:** the blocked sub-agents, but only when the space is not current. Label: `term.name ?? term.program?.name ?? term.address`.
- **Tabs:** only for the current space. For each tab, in order:
  - `name`: stock `title(tab, lead)`
  - `active`: `tab.active`
  - `status`: `tab.status`, lifted by blocked sub-agents
  - `detail`: blocked or done only, and omitted when it equals `name`
  - `agents`: one `Sub` per agent (label `program.key`) when the tab has 2 or more agents, otherwise `[]`
  - `subs`: that tab's blocked sub-agents

- [ ] **Step 1: Add `package.json`, `.gitignore` lines and `tests/fixtures.js`**

`package.json`: `{ "private": true, "type": "module", "scripts": { "test": "node --test 'tests/*.test.js' && python3 -m unittest discover -s tests -p 'test_*.py' && bash tests/install.test.sh" } }`.

`tests/fixtures.js` exports these builders. Each one fills every field from `herdr.d.ts`, and `o` overrides them:
- `sp(id, o)` → SpaceInfo, defaulting to one tab `${id}-t1`
- `tb(id, o)` → TabInfo
- `ag(address, space, tab, status, o)` → AgentInfo, with `program: { key: "claude", name: "Claude Code", agent: true }` and `title: ""`
- `term(address, parent, status, o)` → `{ address, parent, state: "live", status, name: null, title: "", program }`
- `LOCAL = [{ name: null, layout: "ready" }]`

- [ ] **Step 2: Write the failing tests in `tests/model.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { duration, telling, kidStatus, track, buildGroups } from "../index/mods/index/model.js";
import { sp, tb, ag, term, LOCAL } from "./fixtures.js";
const NOW = 1_800_000_000_000, M = 60_000;
const g = (o) => buildGroups({ spaces: [], agents: [], terminals: [], machines: LOCAL, changed: {}, now: NOW, ...o });

test("duration formats like stock", () => {
  assert.deepEqual([30e3, 5*M, 90*M, 50*60*M].map(duration), ["<1m", "5m", "1h", "2d"]);
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
  assert.equal(r.length, 1); assert.equal(r[0].label, null);
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
  assert.equal(r[1].label, "box · offline"); assert.equal(r[1].rows.length, 1);
});
test("space with no agents: no status, no age, no detail", () => {
  const row = g({ spaces: [sp("a")] })[0].rows[0];
  assert.deepEqual([row.status, row.right, row.detail], [null, "", null]);
});
test("working agent: age from its stamp, no detail", () => {
  const row = g({ spaces: [sp("a", { status: "working" })], agents: [ag("t1", "a", "a-t1", "working", { title: "Refactoring" })],
                  changed: { t1: { s: "working", at: NOW - 5 * M } } })[0].rows[0];
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
  assert.equal(row.right, "2 agents"); assert.equal(row.status, "working");
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
  assert.equal(row.status, "idle"); assert.deepEqual(row.subs, []);
});
test("current space lists its tabs; others do not; subs move under the tab", () => {
  const s = sp("a", { active: true, tabs: [tb("a-t1", { active: true }), tb("a-t2", { index: 2, name: "2", active: false })] });
  const terminals = [term("t1", null, "working"), term("k1", "t1", "blocked")];
  const r = g({ spaces: [s, sp("b")], agents: [ag("t1", "a", "a-t1", "working")], terminals })[0].rows;
  assert.deepEqual(r[0].tabs.map((t) => [t.id, t.active]), [["a-t1", true], ["a-t2", false]]);
  assert.deepEqual(r[0].subs, []); assert.equal(r[0].tabs[0].subs[0].address, "k1");
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
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `node --test 'tests/*.test.js'`
Expected: FAIL, because `index/mods/index/model.js` doesn't exist yet.

- [ ] **Step 4: Implement the exports listed under Interfaces in `index/mods/index/model.js`**

Copy `duration`, `telling` and `track` from stock `~/.config/herdr-app/mods/agents/main.js`, with a one-line Apache-2.0 attribution comment. Find sub-agents by walking `terminals()` from each agent: `parent === address && state === "live"`, depth first, skipping any address that is itself in `agents()`.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `node --test 'tests/*.test.js'`
Expected: PASS, every test.

- [ ] **Step 6: Checkpoint**

---

### Task 2: The jump model (⌘J order, key hint, role choice)

**Files:**
- Modify: `index/mods/index/model.js`
- Test: `tests/jump.test.js`

**Interfaces:**
- Consumes: `kidStatus`, plus the fixtures from Task 1.
- Produces:
  - `targets({ agents, terminals }): string[]`. Walk `agents()` in order:
    - a blocked agent goes into B;
    - then each of its live, unlisted sub-agents (depth first) whose `kidStatus` is blocked goes into B;
    - a done agent goes into D.
    - Return `[...B, ...D]`.
    - "N need you" is `targets(...).length`. Task 1's `spaceTargets` becomes a filter of this.
  - `nextTarget(list: string[], current: string|null): string|null`. Returns null if the list is empty, otherwise `list[(list.indexOf(current) + 1) % list.length]`.
  - `keyLabel(keys: {section,keys,action}[], action: string, mac: boolean): string|null`. Prefers section `layout:index` over `global`. On a Mac it shows modifiers in the order ⌃⌥⇧⌘ followed by the key in upper case (`"⇧⌘E"`). Elsewhere it uses `"Ctrl+Shift+J"`.
  - `roleOf(p): "pane"|"strip"|"top"|"sidebar"`. Returns `"pane"` when `p?.pane` is set, otherwise `p.role` if it is one of `strip` or `top`, otherwise `"sidebar"`.

- [ ] **Step 1: Write the failing tests in `tests/jump.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { targets, nextTarget, keyLabel, roleOf } from "../index/mods/index/model.js";
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
  const keys = [{ section: "global", keys: "cmd-k", action: "index.next-needs-you" },
                { section: "layout:index", keys: "cmd-j", action: "index.next-needs-you" },
                { section: "layout:index", keys: "cmd-shift-e", action: "index.files" }];
  assert.equal(keyLabel(keys, "index.next-needs-you", true), "⌘J");
  assert.equal(keyLabel(keys, "index.files", true), "⇧⌘E");
  assert.equal(keyLabel(keys, "index.files", false), "Cmd+Shift+E");
  assert.equal(keyLabel(keys, "nope", true), null);
});
test("roleOf picks the role from props", () => {
  assert.deepEqual([{ pane: "p1" }, { role: "strip" }, { role: "top" }, {}, { role: "bogus" }, undefined].map(roleOf),
                   ["pane", "strip", "top", "sidebar", "sidebar", "sidebar"]);
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `node --test 'tests/*.test.js'`
Expected: FAIL on the missing exports in `jump.test.js`. `model.test.js` still passes.

- [ ] **Step 3: Implement `targets`, `nextTarget`, `keyLabel` and `roleOf`, then rebase `spaceTargets` on `targets`**

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `node --test 'tests/*.test.js'`
Expected: PASS, both files.

- [ ] **Step 5: Checkpoint**

---

### Task 3: Layout, themes, keys and the mod skeleton

**Files:**
- Create: `index/layouts/index.json`, `index/themes/index-dark.json`, `index/themes/index-light.json`, `index/keys.json`, `index/mods/index/mod.json`, `index/mods/index/main.js`, `index/mods/index/ui.js`, and placeholder `sidebar.js`, `strip.js`, `pane.js`

**Interfaces:**
- Consumes: `roleOf` (Task 2).
- Produces:
  - `main.js` default-exports `class Index extends View`. `init(p, cx)` sets `this.role = ROLES[roleOf(p)]` and calls `this.role.init?.(this, p, cx)`. `render(cx)` returns `this.role.render(this, cx)`. `ROLES = { sidebar, strip, pane, top: { render: () => div().size_full() } }`.
  - Each role module exports `init?(view, props, cx)` and `render(view, cx)`.
  - `ui.js` exports `mark(t, status: Status|null): Element`. It is a 12 px-wide box holding:
    - blocked: a 6 px filled `t.accent` dot
    - done: a 6 px ring, 1.5 px `t.accent` border
    - working: a 6 px `t.muted` dot with `.loop("opacity", {from: 0.25, to: 1, period: 1400})`
    - idle or null: empty

`index/layouts/index.json`, exactly this tree:

```json
{ "id": "root", "type": "row", "titlebar": "none", "traffic_lights": [14, 10], "preview": "layouts/index.svg",
  "theme": { "dark": "index-dark", "light": "index-light" }, "ui_font": "Geist", "background": "canvas",
  "terminal_padding": [14, 12], "divider": { "width": 1, "color": "border" },
  "children": [
    { "id": "sidebar", "type": "column", "size": { "px": 232 }, "min": 44, "max": 480, "background": "chrome", "children": [
      { "id": "sidebar-top", "type": "block", "size": { "px": 32 }, "window_drag": true, "content": { "mod": "index", "props": { "role": "top" } } },
      { "id": "sidebar-list", "type": "block", "content": { "mod": "index", "props": { "role": "sidebar" } } } ] },
    { "id": "work", "type": "column", "resizable": false, "children": [
      { "id": "strip", "type": "block", "size": { "px": 32 }, "window_drag": true, "content": { "mod": "index", "props": { "role": "strip" } } },
      { "id": "work-body", "type": "row", "divider": { "width": 1, "color": "border" }, "children": [
        { "id": "main", "type": "block", "background": "border", "content": { "tab": "active",
          "pane": { "gap": 1, "radius": 0, "background": "background", "lone": false,
                    "header": { "content": { "mod": "index", "props": { "role": "pane" } }, "height": 22, "position": "top", "reveal": "always" } } } },
        { "id": "panel", "type": "column", "hidden": true, "size": { "px": 368 }, "min": 280, "max": 900, "children": [
          { "id": "panel-body", "type": "stack", "active": "files", "children": [
            { "id": "files", "type": "block", "content": { "mod": "files" } },
            { "id": "changes", "type": "block", "content": { "mod": "changes" } } ] } ] } ] } ] } ] }
```

Themes (`themes/<name>.json` format, AGENTS.md "The look"). Every value is `#rrggbb`.

| Key | index-dark | index-light |
|---|---|---|
| `background` | `#0b1019` | `#ffffff` |
| `foreground` (terminal text) | `#d1d5db` | `#1f2937` |
| `selection` | `#1e3a5f` | `#dbeafe` |
| `cursor` | `#60a5fa` | `#2563eb` |
| `colors.canvas` | `#0b1019` | `#ffffff` |
| `colors.chrome`, `colors.surface`, `colors.popover` | `#0d1320` | `#f9fafb` |
| `colors.border` | `#1c2433` | `#e5e7eb` |
| `colors.foreground` | `#f3f4f6` | `#111827` |
| `colors.muted`, `colors.working` | `#9ca3af` | `#4b5563` |
| `colors.dim`, `colors.idle` | `#5b6475` | `#9ca3af` |
| `colors.selected`, `colors.raised` | `#172033` | `#f3f4f6` |
| `colors.hover` | `#121a29` | `#f3f4f6` |
| `colors.accent`, `colors.blocked`, `colors.done` | `#60a5fa` | `#2563eb` |
| `ansi` 0–15 | `#1c2433 #f87171 #4ade80 #facc15 #60a5fa #c084fc #22d3ee #d1d5db #5b6475 #fca5a5 #86efac #fde047 #93c5fd #d8b4fe #67e8f9 #f3f4f6` | `#1f2937 #dc2626 #16a34a #ca8a04 #2563eb #9333ea #0891b2 #6b7280 #9ca3af #ef4444 #22c55e #eab308 #3b82f6 #a855f7 #06b6d4 #374151` |

`index/keys.json`: `{ "layout:index": { "cmd-j": "index.next-needs-you", "cmd-shift-e": "index.files", "cmd-shift-g": "index.changes" } }`. `mod.json`: `{ "place": "none" }`.

- [ ] **Step 1: Write the files above. Each placeholder role renders `div().size_full()`**
- [ ] **Step 2: Validate**

Run: `for f in index/layouts/index.json index/themes/*.json index/keys.json; do python3 -m json.tool "$f" >/dev/null || echo "BAD $f"; done; herdr-app check index/mods/index`
Expected: no `BAD` lines, and `check passed: …/index/mods/index`.

- [ ] **Step 3: Checkpoint**

---

### Task 4: Installer and keys merge, then first install

**Files:**
- Create: `install.sh` (executable), `tools/merge_keys.py`, `tests/test_merge_keys.py`, `tests/install.test.sh`

**Interfaces:**
- `tools/merge_keys.py`:
  - `merge(ours: dict, theirs: dict, ask: Callable[[str], bool]) -> tuple[dict, list[str]]` is pure and returns `(new_theirs, messages)`. For each `section → key → action` in `ours`:
    - The key is already bound to the same action in that section: skip it.
    - The key is in their `terminal` section with a different action: skip it with a message, because the terminal section beats layout sections.
    - The key is in the same section, or in `global`, with a different action: call `ask("<key> is <action> in <section>. Use it for <our action> while Index shows?")`. If the answer is yes, set it in our section. Otherwise skip it with a message.
    - Otherwise add it.
  - `main(argv)`: `merge_keys.py <ours.json> <keys.json>`. Interactive only when `sys.stdin.isatty()`, otherwise every answer is no. If anything changed, it copies `keys.json` to `keys.json.bak-<epoch>`, then writes with `json.dump(..., indent=2, ensure_ascii=False)` plus a newline, keeping key order. Prints the messages and exits 0.
- `install.sh [layout]`:
  - No argument: lists the folders that contain `layouts/<folder>.json`.
  - Unknown name: exits 2.
  - Home is `${HERDR_APP_HOME:-$HOME/.config/herdr-app}`. If it is missing, print "Open Herdr once first" and exit 1.
  - Before copying anything, every entry in `<layout>/{layouts,mods,themes}` must start with `<layout>`. If one doesn't, abort with exit 1.
  - Copy the files in `layouts/` and `themes/` (with `mkdir -p`). Replace each `mods/<name>/` whole: `rm -rf` then `cp -R`.
  - Keys: if `keys.json` is missing, print "Open Herdr once so it writes keys.json, then re-run". If `python3 -c pass` works, run the merge. Otherwise print the bindings to add.
  - Run `herdr-app check` on each installed mod if `herdr-app` is on PATH. A failure exits 1.
  - Finally print: `herdr-app do layout.switch '{"name":"index"}'` to switch, and `… '{"name":"main"}'` to go back.

- [ ] **Step 1: Write the failing tests**

`tests/test_merge_keys.py` (unittest, loads `tools/merge_keys.py` via `importlib`):
- `test_adds_section_when_absent`: the result has `layout:index.cmd-j`, every other section is unchanged, and there are no messages.
- `test_idempotent`: merging the result again changes nothing.
- `test_global_conflict_asks`: their `global.cmd-j = "x"`. With `ask → False`: not added, and a message contains `cmd-j`. With `ask → True`: added to `layout:index`, and `global.cmd-j` is still `"x"`.
- `test_terminal_conflict_skips_even_if_yes`: their `terminal.cmd-j = "x"` with `ask → True`: not added, and a message names `terminal`.
- `test_same_section_conflict_replaces_on_yes`.

`tests/install.test.sh` (bash, `set -euo pipefail`, temp homes via `mktemp -d`, prints `ok <name>` per case):
- `install_lists`: no argument prints `index`.
- `install_unknown`: `./install.sh nope` exits 2.
- `install_fresh`: the home is seeded with `keys.json` (copied from `tests/fixtures/keys.json`, a trimmed stock file), `layouts/main.json` and `mods/other/main.js`. After running with `</dev/null`:
  - these all exist: `layouts/index.json`, `mods/index/main.js`, `themes/index-dark.json`, `themes/index-light.json`
  - `keys.json` has `layout:index`
  - `mods/other` and `layouts/main.json` are unchanged (`cmp`)
- `install_rerun`: a second run leaves `keys.json` byte-identical and creates no new `.bak-*`.
- `install_no_home`: exits 1.
- `install_no_keys`: layouts are installed, the output contains "Open Herdr once", and it exits 0.
- `install_refuses_foreign`: in a temp copy of the repo with an extra `index/mods/other/`, it exits 1 and the home is untouched.

- [ ] **Step 2: Run them and confirm they fail**

Run: `python3 -m unittest discover -s tests -p 'test_*.py'; bash tests/install.test.sh`
Expected: FAIL, because the module and the script don't exist yet.

- [ ] **Step 3: Implement `tools/merge_keys.py` and `install.sh` as specified under Interfaces**
- [ ] **Step 4: Run the full suite and confirm it passes**

Run: `npm test`
Expected: every node, unittest and `ok …` line passes, exit 0.

- [ ] **Step 5: Install for real and switch.** Tell Aaron first, in one line, that his window will switch to Index.

Run: `./install.sh index && herdr-app do layout.switch '{"name":"index"}' && herdr-app status`
Expected: the merge prints no conflicts (⌘J, ⌘⇧E and ⌘⇧G are free in Aaron's file), `status` shows `"layout": "index"` and `"errors": []`, and there is no `~/.config/herdr-app/keys.error`.

- [ ] **Step 6: Look at it.** Run `herdr-app shot <scratchpad>/t4.png` and read the PNG.

Expected: the empty sidebar and strip in Slate dark, the terminal on `#0b1019`, and the traffic lights centred in the 32 px top strip. Adjust `traffic_lights` until they are, then re-install.

- [ ] **Step 7: Checkpoint**

---

### Task 5: The strip role (folder · branch, ⌘J, Files/Changes)

**Files:**
- Modify: `index/mods/index/strip.js`
- Create: `tests/fake-agent.sh`. It prints `\033]0;$2\007` and `\033]7501;state=$1\007`, then `exec cat`.

**Interfaces:**
- Consumes: `targets`, `nextTarget` (Task 2).
- `init`: `cx.spawn` loop on `nextCommand()`. Strip any `index.` or `index:` prefix, then:
  - `next-needs-you` → `run("agent.focus", { terminal: nextTarget(targets({agents: agents(), terminals: terminals()}), focused()?.agent ?? focused()?.terminal) })`, but only when the target is not null.
  - `files` or `changes` → stock's toggle (`tabs/main.js` lines 84–90). If the panel is visible and `panel-body.active` is that id, run `layout.hide {id:"panel"}`. Otherwise run `layout.select {stack:"panel-body", child}` and then `layout.show {id:"panel"}`. Read the state with a `find(layout(), id)` copied from stock.
  - Wrap each command in try/catch with `console.log`, as `win98/taskbar.js` does.
- `render`: an `h_flex` with full height and `t.canvas` background:
  - Left padding comes from stock `tabs/main.js` `lightsPadding` (lines 75–77), so the strip clears the traffic lights when the sidebar is hidden or narrow.
  - Right-aligned, 11 px, `t.dim` text: the focused pane's `cwd`, with `home()` shown as `~`, then `" · " + branch` when there is a branch.

- [ ] **Step 1: Implement `strip.js` and `tests/fake-agent.sh`, then re-install**

Run: `herdr-app check index/mods/index && ./install.sh index`
Expected: check passes.

- [ ] **Step 2: Verify ⌘J against real states**

Make two test spaces: `herdr-app do space.new '{"name":"zz-test-a","argv":["sh","<repo>/tests/fake-agent.sh","blocked","Wants to run git push"]}'` and the same for `zz-test-b` with `done`. Press ⌘J from Aaron's own space.
Expected: focus goes to zz-test-a, then zz-test-b, then back to zz-test-a. It moves exactly one target per press, which proves only the strip copy acts.

Hide the sidebar (⌘B) and press again. Expected: it still works. Then show the sidebar again.

- [ ] **Step 3: Verify Files and Changes**

Press ⌘⇧E. Expected: the Files panel opens on the right. Press ⌘⇧G: it switches to Changes. Press ⌘⇧G again: the panel closes.

- [ ] **Step 4: Clean up.** Close the zz-test spaces with `tab.close` on each one's only tab (ids from `herdr-app ls`).
- [ ] **Step 5: Checkpoint**

---

### Task 6: The sidebar role (the list)

**Files:**
- Modify: `index/mods/index/sidebar.js`

**Interfaces:**
- Consumes: `buildGroups`, `targets`, `nextTarget`, `track`, `keyLabel` (Tasks 1–2), and `mark` (Task 3).
- `init`: `this.changed = JSON.parse(localStorage.getItem("changed") ?? "{}")` and `cx.timer.every(30000, (cx) => cx.notify())`.
- `render`, every time:
  - call `track(this.changed, agents(), Date.now())`; if it returns true, save `this.changed` to `localStorage`;
  - call `setAgentOrder(agents().map((a) => a.address))`;
  - build the groups;
  - when the sidebar is under 160 px, delegate to `rail()` (Task 7).

Drawing (spec "Sidebar, top to bottom" and "Status marks"). The sizes:
- **Needs-you line:** 28 px tall, 12 px side padding.
  - Left: `"N need you"`, 12.5 px, semibold, `t.accent`.
  - Right: `keyLabel(keys(), "index.next-needs-you", window()?.platform === "macos")` followed by `" next"`, 11 px, `t.dim`.
  - When the count is 0 the line is empty but keeps its height.
  - Clicking it runs the same `nextTarget` → `agent.focus` as ⌘J.
- **Group label:** 11 px, `t.dim`, 12 px side padding, 10 px gap above.
- **Space row:**
  - Height 26 px, or 40 px with a detail line.
  - Name 12.5 px.
  - `right` slot is 56 px wide, right-aligned, 11 px, `t.dim`.
  - Background is `t.selected` when the space is current, `t.hover` on hover.
  - Name colour and weight follow the status table: blocked is accent and semibold; done is foreground and semibold; working is foreground; idle or none is `t.dim`.
  - Detail line: 11 px, `t.muted`, truncated.
- **Tab rows** (current space only): indented 12 px, 24 px tall, 12 px, `t.dim`.
  - The active tab is `t.foreground`, with a 1.5 × 12 px `t.foreground` tick at its left.
  - Agent sub-rows sit one more indent deeper.
  - A final `"+ tab"` row in `t.dim` runs `tab.new`.
- **Footer:** separated by a `t.border` line, 32 px tall, 11 px, `t.dim`. `"+ New space"` runs `space.new`; `"Settings"` runs `app.settings`.
- **Clicks:**
  - space row → `space.select {id}`; tab row → `tab.select {id}`; agent or sub row → `agent.focus {terminal}`
  - right-click on a space → stock's menu: `openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id } } })`. On a tab, the same with `tab: "tab", target: { id, space }`.
  - double-click (`event.click_count === 2`) → `space.rename {id}` or `tab.rename {id}`
  - dragging a space row reorders it within its machine with `space.move`. Copy this from stock `spaces/main.js` (around lines 280–300 and 410–425), keeping only same-machine drops.
- The list scrolls with `.overflow_y_scrollbar()`. The needs-you line and the footer stay fixed.

- [ ] **Step 1: Implement `sidebar.js`, check it, install**

Run: `herdr-app check index/mods/index && ./install.sh index && herdr-app status`
Expected: check passes, `"errors": []`.

- [ ] **Step 2: Verify against real states**

Make these test spaces with `tests/fake-agent.sh`:
- `zz-test-blocked`: blocked, title "Wants to run git push"
- `zz-test-done`: done
- `zz-test-working`: working
- `zz-test-path`: blocked, title "~/x"
- `zz-test-two`: two agents, made with `space.new` and then `pane.split {direction:"right", argv:[…]}`
- one `hc run` sub-agent reporting blocked, started from inside `zz-test-working`'s terminal

Shot to the scratchpad and read it. Expected:
- each zz space appears exactly once
- blocked: filled accent dot, accent name, detail "Wants to run git push"
- `zz-test-path`: blocked styling with no detail line
- done: ring, semibold name
- working: a dim pulsing dot, one line tall
- `zz-test-two` shows "2 agents"
- the sub-agent lifts `zz-test-working` to blocked and appears as a sub-row
- the count reads correctly and the hint reads "⌘J next"
- clicking a done row clears its ring, and the count drops

- [ ] **Step 3: Verify interactions**

Clicking a space selects it. Clicking a tab row switches tabs, and the window has no tab bar. Double-clicking renames. Right-clicking opens the menu. Dragging moves a space within its machine.

- [ ] **Step 4: Verify Aaron's real spaces**

Expected: every one of Aaron's spaces appears exactly once, grouped by machine, in Herdr's order, with no icons or letter tiles.

- [ ] **Step 5: Close the zz-test spaces, then Checkpoint**

---

### Task 7: Narrow rail and hidden sidebar

**Files:**
- Modify: `index/mods/index/sidebar.js`

**Interfaces:**
- `rail(view, groups, count, t)`: used when `find(layout(), "sidebar")?.size?.px < 160`.
  - A centred column: the count in accent at 11 px (empty when 0).
  - Then one 26 px row per space holding only `mark(...)`. The current space gets the `t.selected` background.
  - A 1 px `t.border` line between groups. Clicking a mark runs `space.select`.

- [ ] **Step 1: Implement it, check it, install**
- [ ] **Step 2: Verify**

Run `herdr-app do layout.resize '{"id":"sidebar","px":76}'`, then take a shot. Expected: the rail draws with one mark per space and nothing overlaps the traffic lights.

Run `layout.resize` back to 232. Then press ⌘B to hide the sidebar and take a shot. Expected: the strip's text clears the traffic lights.

- [ ] **Step 3: Checkpoint**

---

### Task 8: Pane label and split hairlines

**Files:**
- Modify: `index/mods/index/pane.js`

**Interfaces:**
- `render`: `const p = panes().find((x) => x.pane === props().pane)`. An `h_flex` 22 px tall, `px(10)`, `t.background` background, 11 px text:
  - `p.program.name`: `t.foreground` when `p.focused`, otherwise `t.dim`
  - then a 6 px gap and the `cwd` (with `~`), in `t.dim`
  - no buttons
  - render an empty div when `p` is missing (a mod pane before its data arrives)

- [ ] **Step 1: Implement it, check it, install**
- [ ] **Step 2: Verify**

In a zz-test space, run `pane.split {direction:"right"}` and take a shot. Expected:
- one 1 px `#1c2433` line between the panes, with no rounded cards
- a 22 px label on each pane, the focused pane's program name brighter

Close the split and take a shot. Expected: the single pane has no label and no border line at any edge. If the `border` background shows around a lone pane, set `main`'s background back to `canvas`, use `gap: 0` with a 1 px `border` per pane, and write the change up under Watch out in `RECIPE.md`.

- [ ] **Step 3: Verify the light palette**

Temporarily set `"appearance": "light"` in `~/.config/herdr-app/settings.json` and take a shot. Expected: the light palette with a `#2563eb` accent. Then restore `"dark"` exactly.

Also check in the dark shot that terminal text is `#d1d5db`, not `#f3f4f6`. If `colors.foreground` recolors terminals too, keep it as is and note that in Watch out.

- [ ] **Step 4: Close the zz-test spaces, then Checkpoint**

---

### Task 9: Recipe, README, previews and the privacy pass

**Files:**
- Create: `index/RECIPE.md`, `index/layouts/index.svg`, `index/preview.png`, `README.md`

**Interfaces:**
- `RECIPE.md` follows Herdr's order exactly (AGENTS.md "Layouts and mods other people made"): title paragraph and `![Index](preview.png)`, What you see, How it behaves, Built from, Watch out, Done when.
  - It is written from the real files, with exact values: hex colours, px sizes, command names.
  - Watch out must include:
    - the gallery install skips `themes/`, so use `install.sh`
    - the one-mod-with-roles reason
    - the `layout:index` keys
    - anything Tasks 4–8 tripped over
- `layouts/index.svg`: a hand-drawn 320×200 sketch. A sidebar with 5 bars, one accent dot and one ring; a hairline; a work area. Slate dark colours, no text.
- `README.md` has:
  - one paragraph on what the repo is
  - a table of layouts (Index, its one-line description, link to its RECIPE)
  - install steps (`git clone`, `./install.sh index`, the switch command, the way back)
  - Apache-2.0 attribution: parts of `index/mods/index/model.js` derive from Herdr's shipped `agents` and `spaces` mods
  - credit to `eiwe/herdr-layouts` for the format

- [ ] **Step 1: Write `RECIPE.md`, `index.svg` and `README.md`**

Then run: `./install.sh index`
Expected: the settings screen shows the svg for Index.

- [ ] **Step 2: Stage the preview**

First try an isolated window: run `HERDR_APP_HOME=<scratchpad>/demo-home herdr-app` after installing into that home. If it lists Aaron's real spaces (they live in herdr-core, so it probably will), **stop and ask Aaron** how he wants the preview staged. Don't hide or settle his spaces.

If it is isolated, make demo spaces named api, docs and site plus one remote-looking group, using `fake-agent.sh` states: one blocked, one done, one working, and the current space with 2 tabs. Then shoot `index/preview.png` and close the demo.

- [ ] **Step 3: Privacy pass**

Grep the repo for the names Aaron's real window shows: `herdr-app ls` lists his space names, and `hc machine ls` lists his machines. Run it so that only the hit count prints, never the names themselves, to keep them out of logs.

Run: `herdr-app ls | python3 -c '…extract names…' > <scratchpad>/real-names.txt; grep -rniF -f <scratchpad>/real-names.txt --exclude-dir=.superpowers --exclude-dir=.git . | wc -l`
Expected: `0`. Then open `index/preview.png` and confirm by eye that it shows only demo names.

- [ ] **Step 4: Run every "Done when" line from the spec**

Run `npm test`, `herdr-app check`, and `status` with no errors. Then repeat the Task 5–8 scenarios once more, end to end. Expected: every line holds. Report any that don't, with what was seen. The "on a second machine" line can't be tested here. List it for Aaron to try on his next machine.

- [ ] **Step 5: Checkpoint.** Publishing (making the repo public and adding the `herdr-layout` topic) stays Aaron's call.
