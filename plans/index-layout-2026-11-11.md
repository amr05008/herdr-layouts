# Index: a quiet Herdr layout — design

Date: 2026-11-11 · Status: approved by Aaron 2026-11-11 · Herdr app 0.1.14

## Decisions and toggles

Decided by Aaron:

- **Direction: Index.** One merged sidebar list of spaces (with their agents), in a fixed order, grouped by machine. Chosen over an urgency-sorted "Inbox" and a sidebar-less "Bare" top bar.
- **Palette: Slate**, sky-blue accent. Dark first, with a light twin.
- **Tabs live in the sidebar**, under the space you're in. No tab bar.
- **Files and Changes panels are not visible in the layout.** Aaron rarely opens them. (Aaron agreed to "open from the palette", but the palette has no Files/Changes entry and can't be edited, so: see Claude's call below.)
- **Multi-agent spaces** (occasional, 2–3 agents) are handled per mockup "d" below.
- **Nothing real in the public repo.** `preview.png` is shot from a staged demo window with made-up spaces (e.g. api, docs, site), not Aaron's real window. No real space names, agent titles, terminal output or machine hostnames anywhere in the repo, this doc included.

- **Aaron's `"appearance": "dark"` pin in `settings.json` stays.** The light twin still ships and works for anyone on `system` or `light`; the installer never touches `settings.json`.

Claude's calls after the builder check (flippable):

- Files / Changes: keep a **hidden** right-hand `panel` stack (as stock does) and bind two keys to show/hide each; no button anywhere.
- Detail lines appear only for rows that **need you** (blocked, done), not for working rows. Working rows show the pulsing dot only. Keeps row heights stable while ~9 agents flip between working and idle; the list only grows when something needs you. (The mockup showed a detail line on the working row; this supersedes it.)
- Sub-agents (terminals an agent starts with `hc run`, e.g. a reviewer) follow stock Herdr: a blocked sub-agent lifts its parent's space and tab to blocked, counts in "N need you", and is a ⌘J target (`agent.focus` the sub-agent itself); it appears as an agent sub-row under its parent **only while blocked**. Sub-agents don't count toward "N agents", and a sub-agent's "done" counts as idle.
- ⌘J is owned by the always-visible work-area strip mod, not the sidebar, so it still works with the sidebar hidden.
- "Back to stock" is `layout.switch {"name":"main"}`, not ⌘⇧L (which cycles to the next layout).

Still-flippable (Claude's calls, cheap to change later):

| Toggle | Default | Alternative |
|---|---|---|
| Herdr's bottom status bar (stock `workspace-status`: machine · branch · palette hint) | None (sidebar and top strip already show it) | Keep stock's bar |
| UI font | Geist (ships with Herdr, same on every machine) | SF Pro (Mac only) |
| Terminal font / size | Untouched: Aaron's `settings.json` (SF Mono) | Layout sets its own |
| Terminal colors | Layout's Slate theme recolors terminals too (bg, fg, ANSI) | Leave terminals on Aaron's theme |
| "Needs you" key | ⌘J (free in Aaron's `keys.json`) | Reuse ⌘] (`agent.next`) |
| Narrow sidebar (<160 px) | Rail of status dots only | Hide entirely |
| Layout name | `index` | — |

Not affected by this layout: Claude Code's own status line (model, context %, cost, usage limits). Claude Code draws it inside the terminal, so it shows up in every Herdr layout, including this one. Aaron likes it, and the layout must leave terminal content alone.

## Intent

Aaron runs ~9 spaces across two machines (this computer and a second Mac), usually one Claude agent per space. A glance at Herdr is trying to answer one question: **which agent needs me?** The stock sidebar makes that slow: it lists the same nine names twice (Spaces, then Agents), puts an identical Claude icon on every agent row, gives every space a rainbow letter tile that competes with the one color that matters, repeats the machine name, and tucks the "needs you" signal into a small dot at the far right.

Aaron likes minimal, highly organized setups. Their website, aaronroy.com, is the reference: one column, system sans-serif, near-black text with gray-600 secondary text, hairline dividers, generous whitespace, no accent color. This layout carries that into Herdr, dark first.

Second purpose: this repo (`herdr-layouts`) will be **public** so Aaron can install these layouts on any machine. Index is its first layout; more will follow, so the repo is built to hold several.

Mockups from the session live in `.superpowers/brainstorm/` (git-ignored): `sidebar-directions.html` (the three directions) and `index-variations.html` (palettes and tweaks). Note the mockups show an invented detail line ("Wants to run git push"); the real one is the agent's title (see Sidebar).

## Goals

1. One glance answers "who needs me": the count at the top, and the rows themselves, without scanning.
2. Nothing on screen that doesn't carry information. One accent color, used only for "needs you".
3. Rows never move on their own. Order is Herdr's space order, which Aaron controls (drag to reorder).
4. Works the same on any machine: one command installs it, one command (`layout.switch main`) goes back to stock.
5. Dark and light, following Herdr's `appearance` setting (and macOS when that's `system`). Aaron's is pinned to dark.

## Non-goals

- Themed novelty chrome (LCARS, bunker, Alien console — Aaron's friend's repo `eiwe/herdr-layouts` does that well; not this).
- Restyling Herdr's own screens (Settings, palette, dialogs). They take the font and colors only; that's fine.
- Files / Changes panels, search button, sidebar-toggle button, Add machine button in the chrome (all remain reachable from the palette and keys).
- A tab bar, a status bar, pane buttons (split / zoom / close stay on keys and the palette).
- Editing Herdr's shipped layouts or mods in place.

## Anti-goals (would make this a failure even if it works)

- "Needs you" is harder to spot than in stock Herdr.
- The list reorders itself as statuses change.
- Color used decoratively (tiles, icons, per-space colors).
- A broken or half-drawn look on a machine that lacks Aaron's fonts.
- Installing clobbers anything Aaron set himself (keys, settings, other layouts/mods).

## What it looks like

Window: no system title bar; macOS traffic lights sit top-left over the sidebar. Two columns: the sidebar (~232 px, resizable) and the work area. Hairline (1 px `line` color) between them. Nothing else.

### Sidebar, top to bottom

1. **Top strip** (~32 px, window-drag): only the traffic lights.
2. **Needs-you line:** "2 need you" in the accent color, semibold, with the key hint ("⌘J next") right-aligned in faint text. Count = agents whose status is `blocked` or `done`. Clicking it does what the key does. When the count is 0 the line is empty (no "all clear" text).
3. **Machine groups,** in Herdr's order (this computer first, then machines by name). Label: small faint text ("This computer", then the machine's name). An unavailable machine's label reads "<name> · offline" and its rows dim. Unverified whether `spaces()` keeps an offline machine's spaces; test with the machine offline. If they vanish, show the "· offline" label alone.
4. **Space rows.** One line each: status mark (12 px column), name, age (right, tabular figures, faint). Machine name is *not* repeated on rows.
   - Detail line (second line, dim, ellipsized): shown **only** for rows that need you (blocked, done). Text is the agent's terminal title (what stock Herdr shows after the "·"). If the agent's status report carries a message, the builder may prefer it — check `terminals()[i].report`.
   - Space with 2+ agents (sub-agents excluded): right column reads "2 agents" instead of the age; the row's status is the most urgent agent's, sub-agents included.
   - Ages: gpui-kit has no tabular-figures switch, so give ages a fixed-width right-aligned slot (or Geist Mono for the digits).
5. **The current space expands** (this is "tabs live in the list"): beneath it, one indented row per tab — tab name, faint; the shown tab in normal text with a 1.5 px vertical tick at its left. A final faint "+ tab" row runs `tab.new`. Each tab row carries its own status mark and, only if blocked/done, the agent's title as detail (same rule as space rows). A tab split between 2+ agents lists those agents one indent deeper (program name, e.g. "claude", "codex", plus detail).
6. **Footer** (hairline above): "+ New space" left, "Settings" right, faint text. New space behaves like stock's (`space.new`, folder/machine choice as stock offers).

Row interactions: click a space row → `space.select`; click a tab row → `tab.select`; click an agent sub-row → `agent.focus`. Keep stock's affordances where cheap: drag space rows to reorder within a machine (`space.move`), double-click to rename (space/tab), right-click for stock's menu. Hover: faint background. Current space row: `cur` background.

### Status marks (the whole visual language)

| Status | Mark | Name text |
|---|---|---|
| blocked (waiting on you) | filled dot, accent | accent, semibold |
| done (finished, unseen) | ring, accent, 1.5 px | normal text color, semibold |
| working | dot in `dim`, pulsing opacity 0.25↔1, ~1.4 s, native animation (no timers) | normal text color |
| idle / no agent | none | dim |

Exactly one accent per scheme. No icons, no letter tiles, no program glyphs.

### Work area

- **No tab bar.** A ~32 px window-drag strip at the top, empty except the shown terminal's folder and branch right-aligned in faint text ("~/repos/herdr-layouts · main").
- **Single pane:** bare terminal, no card, no border, no header.
- **Split panes:** separated by a 1 px `line` hairline (no gaps, no rounded cards). Each pane gets a one-line label at its top (~22 px): program name, then folder in faint text. The focused pane's program name is in normal text; others faint. No buttons.
- No status bar. Files/Changes exist only as a hidden right-hand `panel` stack (like stock's), shown by key.

### Narrow and hidden sidebar

- Under 160 px (folded): a rail showing the needs-you count and one status mark per space, grouped with a hairline between machines; current space gets the `cur` background. Click a mark → select that space.
- Hidden (⌘B, stock binding `layout.toggle:sidebar`): the work area's top strip must leave room for the traffic lights.

## Palettes

Slate dark (from the mockup; map onto Herdr's theme color names — `chrome`, `canvas`, `border`, `accent`, `foreground`, `muted`, `dim`, `selected`, `hover`, `surface`, etc. — as the builder sees fit):

| Role | Dark | Light (aaronroy.com) |
|---|---|---|
| window / terminal background | `#0b1019` | `#ffffff` |
| sidebar background | `#0d1320` | `#f9fafb` |
| hairlines | `#1c2433` | `#e5e7eb` |
| primary text | `#f3f4f6` | `#111827` |
| secondary text (detail) | `#9ca3af` | `#4b5563` |
| faint text (labels, ages) | `#5b6475` | `#9ca3af` |
| current-row background | `#172033` | `#f3f4f6` |
| accent ("needs you") | `#60a5fa` | `#2563eb` |
| terminal text | `#d1d5db` | `#1f2937` |

The layout root sets `"theme": { "dark": "<slate-dark>", "light": "<slate-light>" }` so it follows Herdr's appearance setting. Terminal ANSI colors: a calm set derived from Tailwind's palette that reads on both backgrounds; builder's choice, keep red/green/yellow distinguishable for diffs and test output. (The light-twin mockup used an amber accent; ignore that — the light accent is blue.)

UI font: Geist (ships with Herdr). Sizes from the mockup: list text ~12.5 px, labels/ages ~11 px.

## Keys

- **⌘J → jump to the next agent that needs you** (blocked first, then done, in list order; wraps; blocked sub-agents included). Implement as a mod command (`"cmd-j": "<strip-mod>.next-needs-you"`, delivered to the mod's `nextCommand()`), which runs `agent.focus`. It must live in the work-area strip mod: `<mod>.<command>` only reaches copies on screen, and the sidebar can be hidden. The sidebar calls `setAgentOrder` with its displayed order so stock ⌘] / ⌘[ (`agent.next` / `agent.prev`) follow the list too.
- **Files / Changes:** ⌘⇧E shows/hides Files, ⌘⇧G shows/hides Changes (the hidden `panel` stack). Both free in Aaron's `keys.json`.
- The hint shown in the sidebar reads the real binding from `keys()` rather than hard-coding "⌘J".
- Ship the bindings as `index/keys.json`, in a `layout:index` section so they only apply while Index shows. The installer **merges** it into the user's `keys.json`: adds the key if unbound, and asks before replacing a key the user already uses. Never rewrites the rest of the file. (Note: any edit to `keys.json` makes the whole file the user's; that's already true for Aaron.)

## Repository

Public repo, same shape as `eiwe/herdr-layouts` (which follows Herdr's gallery format):

```
README.md          what the repo is, table of layouts, install, licences
install.sh         ./install.sh <layout>  (no arg: list layouts)
.gitignore         .superpowers/, .playwright-mcp/, .DS_Store
plans/             design docs (this file)
index/
  RECIPE.md        Herdr's recipe format: what you see, how it behaves, built from, watch out, done when
  preview.png      herdr-app shot of a staged demo window (made-up names)
  layouts/index.json
  layouts/index.svg   settings-screen preview (root "preview")
  mods/index/         the layout's one mod, three roles (sidebar, strip, pane label) chosen by props;
                      one folder because Herdr refuses imports across mod folders and ⌘J must use the sidebar's logic
  themes/             the dark and light Slate themes
  keys.json           the ⌘J binding
```

`install.sh <layout>` copies that folder's `layouts/`, `mods/`, `themes/` into `$HERDR_APP_HOME` or `~/.config/herdr-app`, merges `keys.json` as above, runs `herdr-app check` on each mod, and prints how to switch (`herdr-app do layout.switch '{"name":"index"}'`) and back (`layout.switch {"name":"main"}`; ⌘⇧L only cycles). Re-running updates in place: it may overwrite files it owns (names prefixed `index`), never anything else. It must work on a fresh Mac with nothing but Herdr installed (no `jq`); if merging keys needs a tool that isn't there, print the line to add instead.

Herdr's own gallery install (herdr.dev) copies only `layouts/`, `mods/` and a mod's `keys.json`, not `themes/`. `install.sh` is the supported path; `RECIPE.md` says so.

Licensing: mods derived from Herdr's shipped mods carry Apache-2.0 attribution in the README (Herdr is Apache-2.0), as the friend's repo does. Geist ships with Herdr, so no font files are bundled.

Publishing (making the repo public, adding the `herdr-layout` topic so it appears on herdr.dev/layouts) is Aaron's call at the end, not part of the build.

## Built from (decided parts only)

- A new layout file, not a clone edited in place. Root `row`, `titlebar: none`, traffic lights placed over the sidebar's top strip.
- Sidebar: **one** new mod (`index`, sidebar role) that draws the needs-you line, machine groups, space/tab/agent rows, footer and the narrow rail, using `spaces()` (with `tabs`), `agents()`, `panes()`, `machines()`, `keys()`, `setAgentOrder`, `run(...)`. It may start from copies of the shipped `spaces` and `agents` mods (drag-reorder, rename, menus, age tracking already live there); the visual rules above win over theirs.
- Pane label: the same mod in its pane role as the tab block's header, `lone: false` so single panes stay bare.
- Work-area top strip: the same mod in its strip role, always shown: folder · branch text, window drag, and the owner of the ⌘J command.
- A hidden `panel` stack with the shipped `files` and `changes` mods.

## Left to the builder

- Mod boundaries beyond the above, file layout inside each mod, how age is computed (reuse stock's).
- Exact pixel sizes, paddings and theme-name mapping, within the mockup's proportions.
- ANSI palette.
- What "+ New space" opens (match stock).
- How `install.sh` merges JSON (Python if present, else print).
- How to stage the demo for `preview.png`: throwaway spaces with made-up names, showing at least one blocked row, one done row, a working row and the current space's tabs; removed afterwards. States are real: a test terminal reports a status by printing `ESC ] 7501 ; state=blocked BEL` (verified 2026-11-11). If a demo window can't be kept apart from Aaron's real spaces, stop and ask Aaron.

## Done when

- `herdr-app check` passes for every `index/mods/*` folder; after `layout.switch {"name":"index"}`, `herdr-app status` shows no errors.
- With Aaron's real spaces: every space appears exactly once, grouped by machine, in Herdr's order; no icons or letter tiles anywhere.
- A blocked agent shows a filled accent dot and accent name, the count reads "1 need you", and ⌘J focuses it, including with the sidebar hidden. A done agent shows a ring; after looking at it, the ring goes and the count drops. A blocked `hc run` sub-agent marks its parent's space and is reachable by ⌘J.
- A working agent's row stays one line tall.
- The Files and Changes keys show and hide those panels.
- The current space shows its tabs beneath it; clicking a tab row switches tabs; there is no tab bar.
- A split tab shows a hairline between panes and a one-line label per pane; a single pane shows no frame.
- With `appearance` temporarily set to `light`, the layout shows the light palette; Aaron's `dark` pin is restored afterwards.
- On a second machine: `git clone` + `./install.sh index` + `layout.switch` gives the same window, and Aaron's own `keys.json` entries are intact.
- `RECIPE.md` and `preview.png` exist and match the build.
- Before anything is pushed: a grep of the repo (and a look at `preview.png`) finds none of Aaron's real space names, agent titles, terminal output or machine hostnames.
