# Index "Your Turn" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A finished agent stays lit in Index until Aaron replies to it or dismisses it (⇧⌘J). Rows that need him are filled ("lit rows"), and the work-area strip names the next one.

**Architecture:**
- `model.js` stays pure and decides everything:
  - per-agent turn tracking (`track`, `dismiss`);
  - the four Index statuses (`asks`, `turn`, `working`, `quiet`);
  - what each row says (`lit`, `right`, `detail`);
  - the ⌘J list (`waiting`, `targets`, `nextUp`).
- A new pure `colors.js` derives the wash and quiet colors from the theme.
- A thin `turns.js` keeps the turn record in Herdr's shared store, `shared("index.turns")`. That store is saved, every copy of the mod can read it, and setting it redraws them all. The sidebar and the strip therefore always agree, and a dismiss in the strip redraws the sidebar at once.
- The sidebar and the strip only draw.

**Tech Stack:**
- Herdr app mods: gpui-kit JavaScript. The API is in `~/.config/herdr-app/herdr.d.ts`, `gpui-kit.d.ts` and `AGENTS.md`.
- Node `node:test`, Python 3 `unittest`, bash.

**Spec:** `plans/index-your-turn-2026-11-19.md` (approved 2026-11-19). It builds on `plans/index-layout-2026-11-11.md` and `index/RECIPE.md`. Read all three first.

## Decisions made in this plan (Claude's calls, flippable)

- **The turn record lives in `shared("index.turns")`, not `localStorage`.** `localStorage` is per mod copy (AGENTS.md: "Each copy still gets its own instance, tasks and localStorage"). The strip owns ⇧⌘J and ⌘J and works with the sidebar hidden, so it must read and write the same record as the sidebar.
- **Both the sidebar and the strip call `observe()` on every render.** `track()` is idempotent, so whichever copy draws first records a change, and the other sees nothing new. `setShared` is called only when `track()` reports a change, which prevents a redraw loop.
- **One-time migration.** If `shared("index.turns")` is empty, the sidebar seeds it from its old `localStorage` `changed` map. Those entries have no `turn` field, so they read as quiet and the ages carry over. It then deletes the old key.
- **The wash and quiet colors are computed from the theme, not added to the theme files.** Herdr's `colors` overrides known color names, and unknown names may not reach `theme()`.
  - wash = accent plus alpha `26` (dark) or `17` (light);
  - quiet = `dim` mixed 35% toward `chrome`.
- **The current space row uses `t.hover` as its background** instead of `t.selected`, so any lit row outranks it.
- **A row is lit only when it belongs to the waiting agent itself:**
  - a non-current space row with a waiting own agent;
  - a tab row with one waiting own agent;
  - an agent row in a split tab;
  - a blocked sub-agent row.
  - The current space row is never lit, and neither is a space row lifted only by a sub-agent. So nothing is lit twice.
- **Detail line:** "<age> · <title>". The title is dropped when it isn't telling, or when it's already the row's name (unnamed tabs take the agent's title), leaving just the age. Pane-less sub-agents have no stamp, so they show the title only.

## Global Constraints

- Use `hc` and `herdr-app`, never `herdr`. Never edit Herdr's shipped mods or layouts, `AGENTS.md`, or the `.d.ts` files.
- `model.js` and `colors.js` import nothing. Only the role files and `turns.js` import `herdr`, `gpui-kit` or `gpui-base`.
- One accent per scheme, used only for "needs you" (`tests/themes.test.js` must keep passing unchanged).
- Copy, exactly: the right-slot words are `asks` and `your turn`; the count is `N need you`; the key hint is `⌘J next`.
- Key: `"cmd-shift-j": "index.dismiss"` in the `layout:index` section.
- No time limit on "your turn". Nothing in the code expires a turn except the existing 30-day prune of agents that are gone.
- Never keep a `cx` for later. Native animation only. The only timer is the existing 30 s age refresh.
- Nothing real in the repo: no real space names, agent titles or hostnames. Shots of Aaron's window go to the session scratchpad.
- No commits or pushes unless Aaron says so. "Checkpoint" means commit if Aaron has okayed it, otherwise move on.
- Test spaces are named `zz-test-…` and closed afterwards. Never send key or pointer events to Aaron's display. Key presses are Aaron's (Task 6).

## Review Focus

1. **Redraw loop.** `observe()` writes only when `track()` changes something, and a second render with the same agents writes nothing. Pinned in Task 1 (`track is idempotent`).
2. **An agent finished while the window was closed** (stored `working`, now `idle`). It lights as "your turn". Pinned in Task 1 (`working then idle is your turn`, which uses stored state).
3. **Upgrading from today's stamps,** which have no `turn` field. Idle agents read as quiet, and a working one lights when it finishes. Pinned in Task 1 (`a stamp from before this change reads as quiet`).
4. **⇧⌘J on something that isn't "your turn"** (an asking agent, a working one, an unknown or remote address, nothing focused). Nothing happens. Pinned in Task 1 (`dismiss clears a turn and only a turn`).
5. **An agent closes while it's "your turn".** It leaves the list, the count and ⌘J at once, even though its stamp remains. Pinned in Task 2 (`an agent that has gone is not waiting`).

---

### Task 1: Turn tracking and dismiss in the model

**Files:**
- Modify: `index/mods/index/model.js` (`track()`; new `dismiss()`, `ownStatus()`)
- Test: `tests/turns.test.js` (new). Also update `tests/model.test.js` `track stamps changes…` to expect `{ a: { s: "idle", at: NOW, turn: true } }`.

**Interfaces:**
- Produces:
  - `type Stamp = { s: "working" | "blocked" | "idle", at: number, turn: boolean }` (`turn` may be missing on old stamps; read it as false).
  - `track(changed: Record<string, Stamp>, agents: AgentInfo[], now: number): boolean`: mutates `changed`, returns whether anything changed. Same signature and same 30-day prune as today.
  - `dismiss(changed: Record<string, Stamp>, address: string | null): boolean`: clears `turn` and leaves `s` and `at` alone. Returns whether it did anything.
  - `ownStatus(agent: AgentInfo, changed): "asks" | "turn" | "working" | "quiet"`: `blocked` → asks; `working` → working; otherwise `changed[address]?.turn` → turn, else quiet.

`track()` rules, with `s` = Herdr's status, `done` stored as `idle`:

| Before | Now | Result |
|---|---|---|
| no stamp | any | `{ s, at: now, turn: status === "done" }` |
| `s` differs | `idle` | `{ s: "idle", at: now, turn: true }` (a finish) |
| `s` differs | `working` / `blocked` | `{ s, at: now, turn: false }` (a reply, or it's asking) |
| same `s`, `turn` false | `done` | `turn: true, at: now` (a finish the stamps missed) |
| anything else | | unchanged |

- [ ] **Step 1: Write the failing tests** in `tests/turns.test.js` (import `track`, `dismiss`, `ownStatus` from the model and `ag` from `./fixtures.js`; `NOW = 1_800_000_000_000`, `M = 60_000`):
  - `working then idle is your turn`: `c = { a: { s: "working", at: NOW, turn: false } }`; `track(c, [ag("a","s","t","idle")], NOW + M)` is `true`, and `c.a` deep-equals `{ s: "idle", at: NOW + M, turn: true }`.
  - `looking does not end a turn`: `c = { a: { s: "working", at: NOW, turn: false } }`; track `done` at `NOW + M`, then `idle` at `NOW + 2*M`. The second call returns `false`, and `c.a` deep-equals `{ s: "idle", at: NOW + M, turn: true }`.
  - `working again ends the turn`: from `{ s: "idle", at: NOW, turn: true }`, track `working` at `NOW + M` → `{ s: "working", at: NOW + M, turn: false }`.
  - `asking ends the turn, and idle after asking is a turn`: from a turn, track `blocked` gives `turn: false`; then `idle` gives `turn: true`.
  - `first sight: idle is quiet, done is your turn`: `c = {}`; track agents `i` idle, `d` done, `w` working at `NOW` → `[c.i.turn, c.d.turn, c.w.turn]` deep-equals `[false, true, false]`.
  - `a done the stamps missed lights a quiet agent`: from `{ s: "idle", at: NOW, turn: false }`, track `done` at `NOW + M` → `true`, and `{ s: "idle", at: NOW + M, turn: true }`.
  - `track is idempotent`: the same agents twice. The second call returns `false`.
  - `a stamp from before this change reads as quiet`: `c = { a: { s: "idle", at: NOW } }`; `track(c, [ag a idle], NOW + M)` is `false`; `ownStatus(ag("a","s","t","idle"), c)` is `"quiet"`.
  - `dismiss clears a turn and only a turn`: `c = { a: { s: "idle", at: NOW, turn: true }, b: { s: "working", at: NOW, turn: false } }`; `dismiss(c, "a")` is `true`, and `c.a` deep-equals `{ s: "idle", at: NOW, turn: false }`. `dismiss(c, "a")`, `dismiss(c, "b")`, `dismiss(c, "box/t7")` and `dismiss(c, null)` are all `false`.
  - `the next finish after a dismiss lights again`: after the dismiss above, track `a` working, then idle → `c.a.turn === true`.
  - `ownStatus`: `blocked` with `turn: true` → `"asks"`; `working` → `"working"`; idle with a turn → `"turn"`; idle with no stamp → `"quiet"`.

- [ ] **Step 2: Run** `node --test tests/turns.test.js`. Expected: FAIL (`dismiss` / `ownStatus` not exported, and the `turn` fields are missing).
- [ ] **Step 3: Implement** `track`, `dismiss` and `ownStatus` in `model.js` per the table. Update the header comment.
- [ ] **Step 4: Run** `node --test tests/turns.test.js tests/model.test.js`. Expected: the turns tests pass. In `model.test.js` only the updated `track stamps…` test is touched here. Other status tests may fail until Task 2; note which.
- [ ] **Step 5: Checkpoint.**

### Task 2: Index statuses in rows and in the ⌘J list

**Files:**
- Modify: `index/mods/index/model.js` (`RANK`, `NEEDS`, `kidStatus`, `entries`, `needs` → `waiting`, `buildGroups`, `targets`; new `nextUp`)
- Test: `tests/model.test.js`, `tests/jump.test.js` (rewrite the status assertions to the new words; keep every other test)

**Interfaces:**
- Consumes: `ownStatus`, `Stamp` (Task 1).
- Produces:
  - `RANK = { asks: 4, turn: 3, working: 2, quiet: 1 }`; `WORDS = { asks: "asks", turn: "your turn" }`.
  - `kidStatus(term, listed): "asks" | "working" | "quiet"`: `error` or `blocked` → asks; `working` → working; anything else → quiet. A sub-agent is never `turn`. Kept sub-agents (in `agents()` with a parent) go through `kidStatus`, never `ownStatus`.
  - `buildGroups({ spaces, agents, terminals, machines, changed, now })`. The groups are as today. Shapes:
    - row: `{ id, name, current, status, lit, right, detail, subs: Line[], tabs: Tab[] }`
    - Tab: `{ id, name, active, status, lit, right, detail, agents: Line[], subs: Line[] }`
    - Line: `{ address, label, status, lit, right, detail }`
    - `status` is an Index status or `null` (no agents). `right` on a lit row is `WORDS[status]`. Otherwise a space row's `right` is `"N agents"` or the lead's age, as today, and a tab or line `right` is `""`. `detail` is non-null only on lit rows.
  - `waiting({ agents, terminals, changed }): Waiting[]`, in ⌘J order: asks (each own agent followed by its blocked sub-agents, list order), then turn (list order). `Waiting = { address, status, title, program, space, space_name, tab, sub?: true }`.
  - `targets({ agents, terminals, changed }): string[]` = `waiting(...).map(w => w.address)`.
  - `nextUp(all: Waiting[], current: string | null, memory: { at, from, after } | null): Waiting | null`: the entry for `nextTarget(addresses, jumpFrom(memory, current), memory?.after)`. Returns null when there are no entries or when that entry's address is `current`.

- [ ] **Step 1: Rewrite and add tests.** In `tests/model.test.js` (`g()` keeps passing `changed`):
  - `working agent: age from its stamp, not lit`: `[status, lit, right, detail]` deep-equals `["working", false, "5m", null]`.
  - `asks row is lit, says asks, shows age and title`: a `blocked` agent with title `"Wants to run git push"` and stamp `{ s: "blocked", at: NOW - 2*M, turn: false }` → `["asks", true, "asks", "2m · Wants to run git push"]`.
  - `your-turn row is lit and shows how long it has waited`: an `idle` agent with title `"Release notes"` and stamp `{ s: "idle", at: NOW - 12*M, turn: true }` → `["turn", true, "your turn", "12m · Release notes"]`.
  - `your-turn row with a non-telling title shows just the age`: title `"~/repos/x"` → detail `"12m"`.
  - `quiet agent: dim age, not lit`: idle with stamp `{ s: "idle", at: NOW - 3*24*60*M, turn: false }` → `["quiet", false, "3d", null]`.
  - `lit space with two agents says the word, not the count`: agents `t1` with a turn and `t2` working → `right === "your turn"`.
  - Rename `blocked row…` / `non-telling title…` to the asks wording. Expect detail `"2m · Wants to run git push"` and `"2m"` respectively (give them a stamp).
  - `blocked sub-agent lifts its space; the sub row is lit, the space row is not`: `row.status === "asks"`, `row.lit === false`, `row.detail === null`, and `row.subs[0]` matches `{ address: "k1", label: "review", status: "asks", lit: true, right: "asks" }`.
  - `done sub-agent does not lift its space` → `row.status === "quiet"`.
  - `current space is never lit; its waiting tab is`: an active space with one active unnamed tab and an idle agent with a turn, title `"Release notes"` → `row.lit === false`, `row.detail === null`, `tab.lit === true`, `tab.right === "your turn"`, `tab.name === "Release notes"`, `tab.detail === "12m"` (the title is already the tab name).
  - `split tab: agent rows lit, tab row not`: two agents in one tab, one with a turn → `tab.lit === false`, and `tab.agents.map(a => a.lit)` deep-equals `[true, false]`.
  - `a kept sub-agent's finish never lights its space`: agents `t1` idle and `k1` idle, `k1`'s terminal parent is `t1`, stamp `k1: { turn: true }` → `row.status === "quiet"`.

  In `tests/jump.test.js`:
  - `targets: asks (with blocked subs at their parent) first, then your turn, list order`: agents `a1` working, `a2` blocked, `a3` idle with a turn, `a4` blocked, `a5` idle without one; terminals `a1` and `k1` (parent `a1`, blocked) → `["k1", "a2", "a4", "a3"]`.
  - Keep `targets ignores…`, `does not double-count…` and `a kept sub-agent's done…`, passing `changed: {}`.
  - `an agent that has gone is not waiting`: `changed = { gone: { s: "idle", at: 0, turn: true } }`, `agents: []` → `targets` deep-equals `[]`.
  - `waiting carries status and space name`: `waiting(...)[0]` includes `{ address: "a2", status: "asks", space_name: "s" }`.
  - `nextUp`: with `all = waiting(...)` = `[a2 (asks), a3 (turn)]`: `nextUp(all, "a2", null).address === "a3"`; `nextUp(all, "zz", null).address === "a2"`; `nextUp([all[0]], "a2", null) === null`; `nextUp([], "x", null) === null`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL on the rewritten tests.
- [ ] **Step 3: Implement it in `model.js`.** `entries()` takes `changed` and uses `ownStatus` / `kidStatus`. `needs()` becomes the exported `waiting()`. `detailOf` builds `[age, title]` and drops a title that isn't telling or equals the row's name. `lit` follows the rule in "Decisions". Remove the now-unused `NEEDS = blocked/done`.
- [ ] **Step 4: Run** `npm test`. Expected: every test passes.
- [ ] **Step 5: Checkpoint.**

### Task 3: Wash and quiet colors

**Files:**
- Create: `index/mods/index/colors.js`
- Test: `tests/colors.test.js`

**Interfaces:**
- Produces: `isLight(hex: string): boolean` (relative luminance above 0.5), `mix(a: string, b: string, f: number): string` (`#rrggbb`, channels rounded), `wash(t): string`, `quiet(t): string`. `t` is a `theme()` record.

- [ ] **Step 1: Write the failing tests.** Read both theme files' `colors`, and use `chrome: colors.chrome`, `dim: colors.dim`, `accent: colors.accent`:
  - `wash(dark) === "#60a5fa26"`; `wash(light) === "#2563eb17"`;
  - `quiet(dark) === "#404857"`; `quiet(light) === "#bdc1ca"`;
  - `isLight("#0d1320") === false`; `isLight("#f9fafb") === true`.
- [ ] **Step 2: Run** `node --test tests/colors.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `colors.js`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Checkpoint.**

### Task 4: Shared record and lit rows in the sidebar

**Files:**
- Create: `index/mods/index/turns.js`
- Modify: `index/mods/index/ui.js`, `index/mods/index/sidebar.js`

**Interfaces:**
- Consumes: `track`, `dismiss`, `buildGroups`, `targets` (Tasks 1–2); `wash`, `quiet` (Task 3).
- Produces, in `turns.js` (imports `shared`, `setShared` and `agents` from `herdr`):
  - `KEY = "index.turns"`
  - `observe(list = agents(), now = Date.now()): Record<string, Stamp>`: clones `shared(KEY) ?? {}` with JSON, runs `track`, calls `setShared(KEY, …)` only when it returns true, and returns the record.
  - `dismissAgent(address: string | null): boolean`: clones the record, runs `dismiss`, and calls `setShared` only on true.
  - `adopt(legacy: Record<string, Stamp>): void`: `setShared(KEY, legacy)` only when `shared(KEY)` is null or undefined.
- `ui.js` `mark(t, status)`: `asks` → 6 px filled `t.accent` dot; `turn` → 6 px `t.accent` ring, 1.5 px; `working` → the current pulsing `t.muted` dot; `quiet` / `null` → empty 12 px box.

- [ ] **Step 1: Write `turns.js` and `ui.js`.**
- [ ] **Step 2: Change `sidebar.js`:**
  - `init` reads the old `localStorage` `"changed"` (in try/catch), calls `adopt()` with it if present, then removes the key. It drops `view.changed`.
  - `render` uses `observe(list, now)` for `changed`, and `targets({ agents, terminals, changed })` for the count.
  - `named()` is by Index status: asks/turn → `t.foreground` semibold; working → `t.foreground`; quiet → `quiet(t)` (tab rows: the active tab stays `t.foreground`).
  - Lit space, tab and agent rows: `.bg(wash(t))`. The right slot on a lit row is `t.accent`, semibold. A quiet row's age is `quiet(t)`.
  - The current space row uses `t.hover` instead of `t.selected`, and only when it isn't lit.
  - Rail: a lit space's cell gets `.bg(wash(t))` (the current one keeps `t.hover`). A quiet space keeps the faint 4 px dot, now in `quiet(t)`.
  - Detail lines and heights are as today: 40 px for a space row with a detail, 38 px for a tab or agent row.
- [ ] **Step 3: Run** `npm test`. Expected: PASS. Then `./install.sh index`, `herdr-app check ~/.config/herdr-app/mods/index` (expected exit 0) and `herdr-app status` (expected: no mod errors).
- [ ] **Step 4: Live check.** Make two test spaces, without focus:
  ```sh
  herdr-app do space.new '{"name":"zz-test-turn","folder":"/tmp","argv":["sh","<repo>/tests/fake-agent.sh","working,done","Finished the refactor"],"focus":false}'
  herdr-app do space.new '{"name":"zz-test-asks","folder":"/tmp","argv":["sh","<repo>/tests/fake-agent.sh","working,blocked","Wants to run git push"],"focus":false}'
  ```
  After 5 s, run `herdr-app shot <scratchpad>/turn-1.png` and read it. Expected:
  - the count includes both;
  - zz-test-turn has a filled wash, a ring, "your turn" and "<1m · Finished the refactor";
  - zz-test-asks has a wash, a dot and "asks";
  - every other idle space is fainter than before;
  - no row other than lit ones has a fill brighter than the current-space row.

  Then run `herdr-app do space.select '{"id":"<zz-test-turn id from herdr-app ls>"}'` and shoot `turn-2.png`. Expected: its tab row is lit with "your turn", the space row isn't, and the count hasn't dropped. Go back to the space Aaron was on.
- [ ] **Step 5: Checkpoint.**

### Task 5: The strip: next up, ⇧⌘J and ⌘J

**Files:**
- Modify: `index/mods/index/strip.js`, `index/keys.json`, `tests/install.test.sh` (line 39: also assert `k["layout:index"]["cmd-shift-j"]=="index.dismiss"`)

**Interfaces:**
- Consumes: `observe`, `dismissAgent` (Task 4); `waiting`, `nextUp`, `WORDS`, `keyLabel`, `focusedAddress` (Task 2 and existing).
- Produces: the mod command `index.dismiss`; `jump(memory)` with the same signature, now built from `targets({ agents, terminals, changed: observe() })`.

- [ ] **Step 1: Run** `npm test` after adding the `install.test.sh` assertion. Expected: FAIL (the key is missing).
- [ ] **Step 2: Implement it.**
  - `keys.json` gains `"cmd-shift-j": "index.dismiss"`.
  - The strip's command table gains `dismiss: () => dismissAgent(focusedAddress(focused()))`.
  - `render` calls `observe()` and computes `nextUp(waiting(...), focusedAddress(focused()), view.jumped)`. When it isn't null, it draws on the left, after the traffic-light padding:
    - `mark(t, status)`;
    - `"<space_name> asks"` or `"<space_name> · your turn"`, in `t.foreground` semibold, 11 px;
    - the telling title in `t.muted`, `flex_1`, truncated;
    - `keyLabel(keys(), "index.next-needs-you", mac)` in `t.dim`.
    - The whole left group has `cursor_pointer` and `on_click` → `view.jumped = jump(view.jumped)`.
  - The folder · branch text stays right-aligned and gives way first: it's the one that truncates, with `flex_shrink`.
- [ ] **Step 3: Run** `npm test`. Expected: PASS. Then reinstall, `herdr-app check` and `herdr-app status` as in Task 4.
- [ ] **Step 4: Live check.** With the Task 4 test spaces still up (re-create them if closed), shoot `turn-3.png`. Expected:
  - the strip reads "zz-test-asks asks · Wants to run git push · ⌘J" (asks comes first);
  - folder · branch is still on the right;
  - nothing overlaps the traffic lights.
- [ ] **Step 5: Checkpoint.**

### Task 6: Docs, preview and Aaron's check

**Files:**
- Modify:
  - `index/RECIPE.md`: the status table; "What you see" (lit rows, quieter current row, the strip's next-up line); "How it behaves" (the turn rule, ⇧⌘J, ⌘J order); "Built from" (`turns.js`, `colors.js`, `shared("index.turns")`); Watch out (per-copy `localStorage`, the title-not-message detail, the closed-window gap, the one-time migration); "Done when".
  - `README.md`: the keys table gains ⇧⌘J "Clear 'your turn' on the agent you're on". The opening paragraph's "the only color on screen means this agent needs you" still holds.
  - `index/preview.png`.
  - `plans/index-your-turn-2026-11-19.md`: set Status to built.

- [ ] **Step 1: Update `RECIPE.md` and `README.md`** to match the build, and only the build.
- [ ] **Step 2: Reshoot `preview.png`** with the staged-demo recipe in `RECIPE.md` Watch out (separate `HC_SESSION=demo` core and `HERDR_APP_HOME`). Show:
  - one asks row;
  - two your-turn rows, one of them a tab in the current space;
  - one working row and quiet rows;
  - made-up names only (api, docs, site, …).
  - Stop and delete the demo afterwards.
- [ ] **Step 3: Close the test spaces** (`zz-test-*`) and check that `herdr-app ls` shows none.
- [ ] **Step 4: Privacy check.** Run `git grep -n -i -E "<each of Aaron's space names and machine names, from herdr-app ls>"` over the repo, and look at `preview.png`. Expected: no hits.
- [ ] **Step 5: Aaron's check (he presses the keys).** Ask him to:
  1. Reply to a lit agent: it goes back to working and unlights.
  2. Look at a lit agent without replying: it stays lit.
  3. Press ⇧⌘J on a lit agent: it unlights, and the count drops at once in both the sidebar and the strip.
  4. Press ⇧⌘J on an asking agent: nothing happens.
  5. Press ⌘B and then ⌘J: it still jumps, and the strip still names the next one.
- [ ] **Step 6: Run** `npm test`. Expected: PASS. Then checkpoint.
