# Signal: a loud, labelled Herdr layout — design

Date: 2026-11-20 · Status: approved by Aaron and built 2026-11-20 · Herdr app as installed 2026-11-20 · Builds on `plans/index-layout-2026-11-11.md` and `plans/index-your-turn-2026-11-19.md`

## Decisions and toggles

Decided by Aaron (2026-11-20, from mockups):

- **Direction: "Framed".** Index's single list of spaces, redrawn large and heavy with a status word in a filled block on every row, plus a frame around the terminal: a numbered tab bar on top and a status bar at the bottom. Chosen over "Louder" (the bigger sidebar alone) and "Board" (sidebar sorted by status).
- **Two colors, each with one job.** One color means "waiting on you" (asks and your turn alike). A second means "an agent is working". Chosen over orange-for-working and over splitting asks from your turn by color.
- **Palette: amber and teal on Slate.** Waiting on you is amber `#fbbf24`; working is teal `#2dd4bf`; the background stays Index's blue-black. Chosen over pink/cyan on ink and lime/violet on graphite.

Claude's calls (flippable):

| Toggle | Default | Alternative |
|---|---|---|
| Ships as | A second layout beside Index; Index is untouched | Replace Index |
| Name | `signal` | anything; it's a folder name and a display name |
| Light twin | Yes: amber `#b45309` and teal `#0f766e` on Index's light grays | Dark only |
| Current space's tabs | In the tab bar only; the sidebar no longer expands the current space | Also listed in the sidebar, as Index does |
| Counters when nothing waits | "0 need you" in the neutral block color, not amber | Hide the counter |
| Status bar's right end | "next: <space> asks" then an amber "N need you · ⌘J" block | Stock's palette hint |
| Pane labels on split tabs | Index's one-line label, plus the pane's status block | No status block |
| Files / Changes | Hidden right-hand panel on keys, as in Index | Buttons in the tab bar |
| Keys | Same four as Index (⌘J, ⇧⌘J, ⌘⇧E, ⌘⇧G), bound while Signal shows | — |
| Sidebar width | 280 px | 232 px, as Index |
| Folder in the status bar | Its own case (paths are case-sensitive), not capitals as first drawn | Capitals |
| Bold type | The mod bundles Geist SemiBold and Bold: Herdr's Geist has one weight, so nothing was bold without them. Needs one Herdr restart after install, and makes Index's semibold heavier too | A system font |
| "Need you" counter when a sub-agent asks | Same number as ⌘J visits and the status bar shows (asking sub-agents included), so the three counters may then add up to more than the listed agents | Count listed agents only |
| A space with a waiting agent and another still working | The amber block, with the teal bars (no word) just left of it | The most urgent block only |
| A space with two or more agents | Faint "2 agents" before the block on rows that aren't lit | No count |
| "+" in the tab bar | Runs `tab.new` directly | Stock's new-tab menu |
| Close button on the shown tab | None (close stays on keys and the menu) | Stock's × |

## Intent

Aaron's friend's Herdr layout is far easier to read than Index. It isn't the colors. It's that status is a word in a filled block on every row, everything is labelled and counted, the type is big and heavy, and the terminal sits in a frame that says which tab you're in and what it's doing.

Index answers "which agent needs me?" and deliberately says nothing else. In daily use that turned out too quiet. Working is a 6 px gray dot. Parked spaces are nearly the background color. Nothing says how many agents are working. The tabs of any space other than the current one are invisible, and even the current tab has no label by the terminal.

Signal keeps Index's rules for what waits on you (asks, your turn, dismiss) and its single ordered list. It changes how loudly everything is drawn, and adds the tab bar and status bar back.

The mockups Aaron chose from are private (`.superpowers/brainstorm/`, git-ignored): `bold-directions.html`, `framed-orange.html`, `framed-palettes.html`. The one to build from is window 1 of `framed-palettes.html`.

## Goals

1. At a glance, from the sidebar alone: how many agents wait on you, how many are working, how many are idle, and which is which.
2. Every space row states its status in words.
3. The tab bar shows every tab of the current space with its status. The status bar always says where you are and what's waiting.
4. Parked rows are readable, not near-invisible.
5. Same behavior as Index wherever this doc doesn't say otherwise: the waiting rules, ⌘J order, dismiss, drag-to-reorder, rename, menus, the narrow rail, the hidden-sidebar case.
6. Installs the same way: `./install.sh signal`.

## Non-goals

- Changing Index. It stays as it is and stays installable.
- Sorting or grouping by status. One list, Herdr's order, grouped by machine. Rows never move on their own.
- A separate Agents list. Nothing is listed twice.
- Letter tiles, program icons, per-space colors, a brand strip.
- Split / zoom / close buttons on panes.
- Reading the agent's last message. Detail lines are still the terminal title.

## Anti-goals

- A third status color, or amber or teal used for anything but their one job.
- Working rows drawing the eye harder than waiting rows.
- The two layouts disagreeing about who waits on you. They share one record.
- Anything real in the repo: demo names only in the preview, tests and docs.

## Approaches

What to build, mocked up at real size from one staged moment:

- **A, Louder.** Index's sidebar set bigger with status blocks and counters; no new bars. Keeps every Index rule. Tab names get cut short beside a status block, and a space's other tabs are still hidden.
- **B, Framed (picked).** A's sidebar plus the tab bar and status bar. Costs about 70 px of height and brings back two bars Index removed on purpose. Aaron picked it because it's the one that makes a tab's state clear.
- **C, Board.** Sidebar sorted under "Needs you / Working / Idle" bands. Fastest to read, but rows move and waiting spaces would sit apart from their machine.

How to build it (Claude's call):

- **Its own folder and mod (picked):** `signal/` beside `index/`, in Herdr's gallery shape (`layouts/signal.json`, `mods/signal/`). Herdr refuses imports across mod folders, so Signal's mod carries its own copy of Index's `model.js` and `turns.js`. A test keeps the copies from drifting (see Built from).
- **A second layout file inside `index/`, reusing the `index` mod with new roles:** no copied code, but Index's mod grows a second skin, and the gallery expects one layout per folder.
- **Restyle Index in place:** rejected with "Ships as" above; Aaron may still want the quiet one.

## What it looks like

Dark values given; the light twin maps the same roles. All text is Geist unless noted. "Caps" means the mod upper-cases the string.

Window: no system title bar, one row: sidebar (280 px, min 44, max 480), 1 px line, work area. Traffic lights over the sidebar's top strip, as in Index.

### Sidebar, top to bottom

1. **Top strip, 32 px.** Empty, window-drag.
2. **Counters.** Three equal blocks in a row, 6 px apart, radius 7. Each has a number (22 px, bold) over a caps label (10 px, bold):
   - **N need you:** amber fill, ink text (ink = the window background color). Counts asks and your turn, as Index does. Clicking it does what ⌘J does. At 0 it takes the neutral block color.
   - **N working:** teal fill, ink text. Agents whose Index status is working.
   - **N idle:** neutral block fill (`#1f2a3d`), number in secondary gray. Every other listed agent.
   - "Need you" is exactly the number of ⌘J targets (`targets()`), so it always matches the status bar and what ⌘J visits. That includes asking sub-agents.
   - Working and idle count listed agents (sub-agents excluded, as in Index's "N agents") that aren't waiting. With no sub-agent asking, the three add up to the listed agents; when one asks, they add up to one more per asking sub-agent.
3. **Machine sections,** Herdr's order. Label in caps, 11 px bold, secondary gray, then the number of spaces in it (faint), then a hairline filling the rest of the line. Offline machines as in Index ("· OFFLINE", rows at 50%). With one machine there's no label, as in Index.
4. **Space rows.** 36 px, radius 7, 8 px side margin. Name on the left at 14.5 px semibold; a status block on the right.
   - **Status block:** 20 px tall, radius 4, 10.5 px bold caps.
     - asks: "ASKS", amber fill, ink text.
     - your turn: "YOUR TURN", amber fill, ink text.
     - working: three small animated bars then "WORKING", teal fill, ink text.
     - quiet: "IDLE 5H" (the age), no fill, faint text. A space with no agent shows no block (Index keeps ages per agent, so there's none to show).
   - **Second cue:** when the row's block is amber and another agent in that space is working, the teal bars (no word) sit just left of the block. A space with two or more agents shows a faint "2 agents" before the block when the row isn't lit.
   - **Lit row** (asks or your turn): amber at 18% as the background, a 3 px amber bar down its left edge, and a detail line under the name (12 px, secondary gray, truncated): "<age> · <title>", by Index's rules. The row grows to fit (about 56 px).
   - **A row shows its most urgent agent** (asks > your turn > working > quiet), as Index does. Unlike Index, the **current space's row is lit** when one of its agents waits, because its tabs are no longer listed beneath it. When the current space has two or more tabs, its detail line starts "2 tabs · ".
   - **Current space:** a 1.5 px outline in the primary text color. No fill of its own, so a lit current row keeps its amber.
   - **Quiet rows:** name in secondary gray (`#9ca3af`), weight 500.
   - Hover: Index's hover color on rows that aren't lit.
   - Sub-agents that ask: an indented lit row under their space, as in Index. Then the space row shows the block but isn't lit, so nothing is lit twice.
5. **Footer, 32 px,** as Index: "+ New space", "Settings".

Under 160 px the sidebar is Index's rail with the new colors: the need-you count in amber, one mark per space, lit cells washed amber, working marks teal.

### Tab bar (40 px, top of the work area, window-drag)

- Sidebar-colored background, hairline below.
- One tab per tab of the current space, in order: a two-digit number ("01", Geist Mono 11 px, faint), the tab's name (13 px), then its status block (same four as the sidebar; a quiet tab has none).
- The tab's name follows stock's rule: a name the person gave stays; otherwise the agent's live title.
- Shown tab: window-background fill, primary text, semibold, a 2 px primary-text line across its top.
- A waiting tab that isn't shown: amber 18% fill, primary text, semibold.
- Other tabs: neutral block fill, secondary text.
- A "+" tab at the end runs `tab.new`.
- Right end, caps 11 px bold, secondary gray: "<space> · <machine>" ("SITE · THIS COMPUTER").
- Clicks, double-click to rename, right-click menu, drag to reorder and overflow scrolling follow the shipped `tabs` mod.
- With the sidebar hidden or narrower than the traffic lights, the bar leaves room for them, as Index's strip does.

### Terminal area

- A single pane is bare, as in Index.
- Split panes: Index's hairlines and 22 px label, with the pane's status block after the program name.
- Files and Changes: Index's hidden 368 px panel.

### Status bar (30 px, bottom of the work area)

Sidebar-colored, hairline above, caps 11 px bold, secondary gray, cells separated by hairlines. Left to right:

- the focused terminal's folder and branch ("~/CODE/SITE · MAIN");
- "N SPACES";
- the animated bars and "N WORKING", in teal text (omitted at 0);
- (gap)
- "NEXT: <space> ASKS" or "NEXT: <space> · YOUR TURN": the agent ⌘J would go to, by Index's "next up" rule (empty when none, or when it already has focus);
- an amber block, ink text: "N NEED YOU · ⌘J" (the key read from `keys()`). Clicking it does what ⌘J does. Absent at 0.

### Colors

Themes `signal-dark` and `signal-light`. Index's themes are the starting point; only these differ:

| Role | Theme names | Dark | Light |
|---|---|---|---|
| Waiting on you | `accent`, `blocked`, `done` | `#fbbf24` | `#b45309` |
| Working | `working` | `#2dd4bf` | `#0f766e` |
| Neutral block (idle counter, plain tabs) | `raised`, `selected` | `#1f2a3d` | `#e5e7eb` |

Text on an amber or teal fill is the window background color in dark and white in light. `accent_foreground` is a known theme color name and can carry it. The amber wash is the accent at 18% (dark) or about 10% (light), computed in the mod as Index's `wash()` does.

## Behavior

Everything in "The rule" of `plans/index-your-turn-2026-11-19.md` holds unchanged: what asks and your turn mean, what ends a turn, sub-agents, ⌘J order, dismiss, persistence.

- **One record for both layouts.** Signal reads and writes the same shared store key as Index (`index.turns`), so switching layouts never loses or resurrects a waiting agent.
- **Keys:** `signal/keys.json` binds ⌘J → `signal.next-needs-you`, ⇧⌘J → `signal.dismiss`, ⌘⇧E → `signal.files`, ⌘⇧G → `signal.changes` in a `layout:signal` section. A copy of the mod that is always on screen owns them (the tab bar or the status bar), so they work with the sidebar hidden.
- `setAgentOrder` is called with the sidebar's order, as in Index.

## Built from

- `signal/layouts/signal.json`: root row; sidebar column (top strip, list); work column (tab bar 40 px, the body row with the tab block and the hidden panel stack, status bar 30 px). Themes by appearance, `ui_font` Geist.
- `signal/mods/signal/`: one mod, roles by props, as Index: `top`, `sidebar`, `tabs`, `pane`, `bar`.
  - `model.js` and `turns.js` start as copies of Index's. Signal needs these model changes, each as a parameter so Index passes the old behavior and the two files stay byte-identical:
    - `buildGroups`: the current space's row may be lit, and its asking sub-agents become space-level rows (Index drops those and builds tab rows instead);
    - `keyLabel`: the keys section to read (it hardcodes `layout:index` today, which would leave Signal with no "⌘J" label);
    - `roleOf`: Signal's `tabs` and `bar` roles (it knows only `strip`, `top` and `pane` today), or a Signal-side helper outside the shared files;
    - new pure helpers for the three counters and the second cue.
  - `colors.js` is Signal's own (its wash is 18% / 10%; Index's is fixed at 15% / 9%), and sits outside the identity test. Add a test that fails when they differ. If keeping them identical turns out to fight the code, the fallback is a `signal`-only model file beside an untouched copy; say so in the build notes.
  - The tab bar starts from the shipped `tabs` mod (Apache-2.0; credit it in the README as Index's credits are).
- `signal/themes/signal-dark.json`, `signal-light.json`.
- `signal/keys.json`, `signal/RECIPE.md`, `signal/preview.png`, `signal/layouts/signal.svg`.
- `install.sh` and `tools/merge_keys.py` are generic and need no change. `tests/install.test.sh` and `tests/themes.test.js` hardcode `index` and gain Signal cases.
- README: add Signal to the table of layouts.

## Left to the builder

- Exact paddings and sizes within the mockup's proportions.
- The "working" bars: `.loop()` can drive height, so animate three bars' heights as mocked. It has no delay, so stagger them with slightly different periods.
- Caps labels aren't letter-spaced (gpui-kit has no such call).
- Which always-visible role owns the key commands. Only one role may await `nextCommand()`, as Index's strip does.
- ANSI colors for the light and dark themes (Index's are fine).
- How to stage `preview.png`: as Index did, in a throwaway window with made-up spaces showing an asks row, a your-turn row, a working row, idle rows, and two tabs.

## Watch out

- **Imports can't cross mod folders.** That's why the model is copied, and why the copies need the identity test.
- **`<mod>.<command>` keys only reach copies on screen.** Don't let the sidebar own them.
- **Unknown theme color names may not reach `theme()`.** Use the known names in the table; compute washes in the mod.
- **Amber on white fails contrast.** The light twin uses the darker amber with white text; check both blocks read at 10.5 px.
- **A long tab name plus a status block** can eat the bar. Cap tab width and truncate the name, never the block.
- **The current space's lit row is new behavior** against Index's "never lit" rule. The sub-agent rule (nothing lit twice) still applies.

## Done when

- `npm test` passes, including: the model-identity test; the new current-space option (lit in Signal, not in Index); "need you" equals the ⌘J target count; working plus idle plus waiting listed agents equals the listed agents.
- `herdr-app check signal/mods/signal` passes. After `layout.switch {"name":"signal"}`, `herdr-app status` shows no errors.
- In a staged window:
  - the three counters equal the model's counts, and "need you" matches the status bar;
  - a space with one agent waiting and another working shows the amber block with teal bars beside it;
  - an asking agent's row and tab are amber and say ASKS; a finished one says YOUR TURN until replied to or dismissed with ⇧⌘J; a working one is teal with moving bars; a parked one reads "IDLE <age>" in readable gray;
  - the tab bar lists the current space's tabs, numbered, each with its status; clicking switches tabs; "+" adds one;
  - the status bar names the folder and branch, the space count, the working count, the next ⌘J target and the need-you count;
  - ⌘J and ⇧⌘J work with the sidebar hidden;
  - switching to Index and back shows the same agents waiting.
- With `appearance` temporarily `light`, the light twin shows and both status blocks are readable; Aaron's `dark` pin is restored afterwards.
- `./install.sh signal` on a clean Herdr home installs it without touching Index's files or the person's own keys.
- `RECIPE.md` and `preview.png` match the build. A grep of the repo and a look at the preview find no real space names, agent titles or hostnames.
