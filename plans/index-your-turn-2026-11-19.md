# Index: "your turn" and lit rows — design

Date: 2026-11-19 · Status: built 2026-11-19 · Builds on `plans/index-layout-2026-11-11.md`

## Decisions and toggles

Decided by Aaron:

- **New rule: an agent that finished needs you until you reply to it or dismiss it.** Looking at it no longer clears it. No time limit: Aaron sometimes takes more than a day to get back to a session.
- **Look: variation A, "lit rows".** Same single list in Herdr's order. A row that needs you is the only filled row in the list, and says why on the right.

Claude's calls (flippable):

| Toggle | Default | Alternative |
|---|---|---|
| Dismiss key | ⇧⌘J (free; sits next to ⌘J) | ⌘. |
| Dismiss also jumps to the next one | No, it only clears | Clear, then ⌘J |
| "Next up" line in the work-area strip | On | Off |
| Right slot on a lit row | The word: "asks" or "your turn" | The age, as today |
| Agents already idle when this version first runs | Quiet (Index doesn't know their history) | Your turn |
| ⌘J order within "your turn" | List order, as today | Oldest wait first |
| Sound when an agent asks | Not part of this change | `play("blocked")` |

## Why

A glance at Index should answer "which agent needs me?". It doesn't, mostly because the signal rarely fires:

- **Blocked** (a permission prompt or a question) is rare in Aaron's setup.
- **Done** (finished, not looked at) clears as soon as its tab is on screen, even when he's only passing through.
- After that, an agent that finished ten minutes ago and is waiting for a reply is drawn the same as one parked a week ago.

A check of Aaron's real window on 2026-11-19 found 15 agents: 3 working, 12 idle, none blocked or done. Nothing was lit. When the signal does fire it's small: a 6 px dot and a colored name. The current-space highlight is the biggest shape in the list, and it means "you are here", not "look here".

## Goals, non-goals, anti-goals

- **Goal:** every agent waiting on Aaron is lit until he deals with it, and lit rows are what the eye lands on first (the squint test).
- **Goal:** keep Index's rules: one list, Herdr's order, rows never move on their own, one accent color, nothing listed twice.
- **Non-goal:** reading the agent's last message. The detail line stays the terminal title (see Watch out).
- **Non-goal:** folding quiet spaces (variation C). Revisit if the list outgrows the window.
- **Anti-goal:** the lit count creeping up with agents Aaron is done with and can't clear. That's why dismiss ships in the same change.
- **Anti-goal:** looking at an agent clears it. That's the bug this fixes.

## Approaches considered

Mocked up side by side at real size from one staged moment. The mockups were private and are not in this repo.

- **A, lit rows (picked).** Smallest change. Keeps every Index rule, and the filled rows pass the squint test.
- **B, queue on top.** A to-do stack of waiting agents above the list. It lists waiting spaces twice (the stock-sidebar problem Index exists to fix), and the block grows when a lot is waiting.
- **C, quiet folds away.** Lit rows, plus parked spaces fold into one line per machine. Parked spaces take two clicks, and rows appear and disappear. Held for later.
- **D, status words.** No dots; a pill on the right edge of each row. The busiest of the four, and agent counts leave the right side.

## The rule

Statuses Index draws (replacing the "Agent statuses" table in `RECIPE.md`):

| Index status | Comes from | Mark | Row |
|---|---|---|---|
| **asks** | Herdr `blocked` on an agent, or a blocked sub-agent (as today) | 6 px filled accent dot | lit; right slot "asks" |
| **your turn** | the agent finished (Herdr `working` → `done` or `idle`) and hasn't worked or been dismissed since | 6 px accent ring | lit; right slot "your turn" |
| **working** | Herdr `working` | `muted` dot, pulsing (as today) | normal text |
| **quiet** | anything else: dismissed, never worked since Index first saw it, no agent | none | fainter than today's `dim` |

- **What ends "your turn":**
  - the agent works again (Aaron replied);
  - Aaron presses ⇧⌘J while it has focus;
  - the agent goes away.
  - Looking at it, focusing it and ⌘J landing on it don't end it.
- **Entering "your turn":** Index sees an agent go from `working` to `done` or `idle`. This includes a change that happened while the window was closed: Index stored "working", and the agent is idle now. An agent Index sees for the first time starts as **quiet**, unless Herdr reports it `done`, in which case it starts as **your turn**.
- **Sub-agents:** unchanged. A sub-agent's "done" is its parent's news, so sub-agents never get "your turn". A blocked sub-agent is "asks" and lifts its parent.
- **A row shows its most urgent agent:** asks > your turn > working > quiet.
- **"N need you"** counts asks and your turn. ⌘J goes through asks first (each followed by its blocked sub-agents), then your turn, in list order, wrapping around. ⌘J leaves "your turn" lit, so pressing it again moves on to the next one.
- **Dismiss (⇧⌘J)** acts on the focused agent when it's in "your turn". Otherwise it does nothing. "Asks" can't be dismissed: the agent is stuck until Aaron answers. A dismissal is tied to that one finish, so the agent's next finish lights it again.
- **Persistence:** "your turn" and dismissals live with the `changed` stamps in Herdr's shared store (`shared("index.turns")`). It survives restarts and is the same for the sidebar and the strip. `localStorage` is per mod copy, so it can't be shared. Prune entries for agents gone more than a month, as `track()` already does. (Changed from `localStorage` while writing the build plan.)

## What it looks like

Only what changes from `RECIPE.md`:

- **Lit row** (asks or your turn), on a space row, tab row or split-tab agent row:
  - background: the accent at about 15% (dark) or about 8% (light), radius 5;
  - name: full text, semibold;
  - right slot: "asks" or "your turn" in the accent, semibold, replacing the age or "N agents";
  - detail line: "<age> · <title>", 11 px, `muted`. The age is how long it has waited.
- **Current space:** its row background drops to about the hover color, so lit rows outrank it. When the waiting agent is in the current space, its tab row lights up and the space row doesn't, so nothing is lit twice. The space row still shows the mark.
- **Quiet:** names and ages one step fainter than today's `dim`: `dim` mixed 35% toward the sidebar color (`#404857` dark, `#bdc1ca` light). It's computed in the mod, not added to the themes, because Herdr may not pass unknown theme color names through.
- **Rail** (sidebar under 160 px): a lit space's cell gets the same wash. Marks are as above.
- **"Next up" line, in the work-area strip:** on the left, the mark, then "<space> asks" or "<space> · your turn" (full text, semibold), the title (`muted`, truncated) and the ⌘J label (faint). It names the agent ⌘J would go to next, and is empty when nothing is waiting or that agent already has focus. Folder · branch stays on the right. Clicking the line does what ⌘J does.
- **Key hint:** the needs-you line keeps "⌘J next". The README keys table and `RECIPE.md` gain ⇧⌘J "Dismiss: clear 'your turn' on this agent".

## Built from

- `model.js`:
  - `track()` grows into a state machine that also records the "your turn" flag and dismissals per agent address;
  - `buildGroups()` and `targets()` use the four Index statuses above;
  - new pure helpers for dismiss and "next up";
  - all of it tested with Node, as today.
- `sidebar.js` / `ui.js`: lit rows, the quiet color, the right-slot words, the detail age, the softer current row, the rail wash.
- `strip.js`:
  - the "next up" line;
  - a new `index.dismiss` command, run through `nextCommand()` like `index.next-needs-you`, so it works with the sidebar hidden;
  - the strip owns all key commands, as today.
- `index/keys.json`: `"cmd-shift-j": "index.dismiss"` in the `layout:index` section. `install.sh` merges it the way it merges ⌘J.
- Themes: unchanged. The wash (accent plus alpha) and the quiet color are derived from theme colors in `colors.js`.
- `RECIPE.md`, `README.md`, `preview.png` (reshot from a staged demo with made-up names, showing an asks row, a your-turn row, a working row and quiet rows).

## Left to the builder

- How a turn is identified in storage, e.g. the stamp time of the finish.
- Whether `AgentInfo.seq` survives a restart and can catch a reply-and-finish that happened entirely while the window was closed. If it can't, accept the gap (see Watch out).
- If `terminals()[i].report` carries a message from the agent, the detail line may prefer it to the title. Check, don't assume.
- Exact wash alpha and quiet color, within the values above.

## Watch out

- **The detail line is the terminal title** (for Claude Code, the session's name, e.g. "Weekly report command"), not the agent's last message. The mockups showed made-up messages.
- **A reply and a finish that both happen while this window is closed** (from another Herdr client) look like nothing changed: idle before, idle now. Index keeps whatever it had. Rare, and dismiss fixes it.
- **An agent someone else prompts** (a channel bot, a shared session) lights up after every turn it takes. Dismiss clears it. A per-space "never needs me" setting could come later.
- **No time limit means the count only drops when Aaron acts.** That's intended. Dismiss is the pressure valve.
- **Nothing real in the repo:** demo names only in `preview.png`, tests and this doc.

## Done when

- `npm test` passes, with new model tests:
  - working → idle is "your turn";
  - looking or focusing doesn't clear it;
  - working again clears it;
  - dismiss clears it, and the next finish lights it again;
  - first sight: idle is quiet, done is "your turn";
  - a sub-agent's done never lights;
  - ⌘J and the count include "your turn".
- `herdr-app check` passes. After switching to Index, `herdr-app status` shows no errors.
- **In the real window:**
  - an agent that finishes stays lit after you look at it, until you reply or press ⇧⌘J;
  - a blocked agent reads "asks" and can't be dismissed;
  - the current-space highlight is quieter than any lit row;
  - the strip names the next ⌘J target.
- `RECIPE.md`, `README.md` and `preview.png` match the build. A grep finds no real space names or hostnames.
