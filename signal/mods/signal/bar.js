// The status bar under the terminal: where you are, how much is going on,
// who ⌘J goes to next and how many wait. It is always on screen, so it owns
// Signal's key commands (`<mod>.<command>` keys reach only shown copies).
// The panel toggle follows Herdr's shipped `tabs` mod (Apache-2.0).

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, terminals, spaces, focused, panes, run, layout, nextCommand, theme, window, home, keys } from "herdr";
import { targets, waiting, tally, nextTarget, nextUp, jumpFrom, jumpCommand, focusedAddress, keyLabel } from "./model.js";
import { observe, dismissAgent } from "./turns.js";
import { bars, ink, SECTION } from "./ui.js";

export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// ⌘J: the next agent that needs you, after the one you're on. `memory`
// (the caller's { at, from, after } | null) lets presses step past peeked sub-agents.
export function jump(memory) {
  const list = agents();
  const current = focusedAddress(focused());
  const all = targets({ agents: list, terminals: terminals(), changed: observe(list) });
  const to = nextTarget(all, jumpFrom(memory, current), memory?.after);
  if (!to) return null;
  const [command, args] = jumpCommand(to, list);
  run(command, args);
  return { at: to, from: current, after: all.slice(all.indexOf(to) + 1) };
}

export const jumpKey = () => keyLabel(keys(), "signal.next-needs-you", window()?.platform === "macos", SECTION);

// Files / Changes: open the hidden right-hand panel on it, or close it if
// it's already showing.
function togglePanel(id) {
  const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
  if (panel && !panel.hidden && body?.active === id) run("layout.hide", { id: "panel" });
  else {
    run("layout.select", { stack: "panel-body", child: id });
    run("layout.show", { id: "panel" });
  }
}

export function init(view, _props, cx) {
  view.jumped = null;
  const commands = {
    "next-needs-you": () => { view.jumped = jump(view.jumped); },
    dismiss: () => dismissAgent(focusedAddress(focused())),
    files: () => togglePanel("files"),
    changes: () => togglePanel("changes"),
  };
  cx.spawn(async (cx) => {
    for (;;) {
      const c = (await nextCommand()).replace(/^signal[.:]/, "");
      try {
        commands[c]?.();
      } catch (e) {
        console.log(`signal bar: ${c} failed: ${e}`);
      }
      cx.notify();
    }
  });
}

export const tilde = (path) => {
  const h = home();
  return path === h ? "~" : path.startsWith(`${h}/`) ? `~${path.slice(h.length)}` : path;
};

export function render(view) {
  const t = theme();
  const list = agents(), terms = terminals();
  const x = { agents: list, terminals: terms, changed: observe(list) };
  const counts = tally(x);
  const f = focused();
  const p = panes().find((q) => q.focused) ?? panes().find((q) => q.tab === f?.tab && q.terminal);
  // The folder keeps its own case: paths are case-sensitive.
  const where = p?.cwd ? tilde(p.cwd) + (p.branch ? ` · ${p.branch}` : "") : "";
  const n = nextUp(waiting(x), focusedAddress(f), view.jumped);
  const next = n ? (n.status === "asks" ? `NEXT: ${n.space_name.toUpperCase()} ASKS` : `NEXT: ${n.space_name.toUpperCase()} · YOUR TURN`) : null;
  const hint = jumpKey();
  const cell = () => h_flex().h_full().flex_none().px(14).gap(6).items_center().whitespace_nowrap().border_r(1).border_color(t.border);
  const go = () => { view.jumped = jump(view.jumped); };
  return h_flex().size_full().bg(t.chrome).border_t(1).border_color(t.border).text_size(11).font_bold().text_color(t.muted)
    .when(Boolean(where), (el) => el.child(h_flex().h_full().flex_shrink_1().min_w(0).px(14).items_center().border_r(1).border_color(t.border).child(div().min_w(0).truncate().child(where))))
    .child(cell().child(`${spaces().length} SPACES`))
    .when(counts.working > 0, (el) => el.child(cell().text_color(t.working).child(bars(t.working)).child(`${counts.working} WORKING`)))
    .child(div().flex_1())
    .when(Boolean(next), (el) => el.child(cell().id("signal-next").border_r(0).border_l(1).cursor_pointer().on_click(go).child(next)))
    .when(counts.need > 0, (el) => el.child(h_flex().id("signal-need").h_full().flex_none().px(14).items_center().whitespace_nowrap()
      .bg(t.accent).text_color(ink(t)).cursor_pointer().on_click(go)
      .child(`${counts.need} NEED YOU${hint ? ` · ${hint}` : ""}`)));
}
