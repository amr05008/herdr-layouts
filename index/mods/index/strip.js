// The work area's top strip: who ⌘J goes to next, where you are (folder ·
// branch), somewhere to drag the window by, and the owner of Index's key
// commands (⌘J, ⇧⌘J, Files, Changes). `<mod>.<command>` keys reach only
// copies on screen; this one always is, even with the sidebar hidden.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, terminals, focused, panes, run, layout, nextCommand, theme, window, settings, home, keys } from "herdr";
import { targets, waiting, nextTarget, nextUp, jumpFrom, jumpCommand, focusedAddress, keyLabel, telling, WORDS } from "./model.js";
import { observe, dismissAgent } from "./turns.js";
import { mark } from "./ui.js";

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

// Files / Changes: open the hidden right-hand panel on it, or close it if
// it's already showing (as stock's tab-bar buttons do).
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
      const c = (await nextCommand()).replace(/^index[.:]/, "");
      try {
        commands[c]?.();
      } catch (e) {
        console.log(`index strip: ${c} failed: ${e}`);
      }
      cx.notify();
    }
  });
}

export const tilde = (path) => {
  const h = home();
  return path === h ? "~" : path.startsWith(`${h}/`) ? `~${path.slice(h.length)}` : path;
};

// "zz asks · Wants to run git push · ⌘J": the one ⌘J would go to next.
function next(view, t) {
  const list = agents();
  const n = nextUp(waiting({ agents: list, terminals: terminals(), changed: observe(list) }), focusedAddress(focused()), view.jumped);
  if (!n) return null;
  const hint = keyLabel(keys(), "index.next-needs-you", window()?.platform === "macos");
  const title = telling(n.title, n.program);
  const who = n.status === "asks" ? `${n.space_name} ${WORDS.asks}` : `${n.space_name} · ${WORDS.turn}`;
  return h_flex().id("index-next").flex_none().items_center().gap(8).cursor_pointer().text_size(11)
    .on_click(() => { view.jumped = jump(view.jumped); })
    .child(mark(t, n.status))
    .child(div().flex_none().whitespace_nowrap().font_semibold().text_color(t.foreground).child(who))
    .when(Boolean(title), (el) => el.child(div().max_w(360).min_w(0).truncate().text_color(t.muted).child(title)))
    .when(Boolean(hint), (el) => el.child(div().flex_none().whitespace_nowrap().text_color(t.dim).child(hint)));
}

export function render(view) {
  const t = theme();
  const root = layout(), sidebar = find(root, "sidebar"), w = window();
  // Clear the traffic lights when the sidebar is hidden or narrower than they are (as stock's tab bar does).
  const lights = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
    ? Math.max(12, (root.traffic_lights[0] + 64) / settings().zoom - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
    : 12;
  const f = focused();
  const p = panes().find((x) => x.focused) ?? panes().find((x) => x.tab === f?.tab && x.terminal);
  const where = p?.cwd ? tilde(p.cwd) + (p.branch ? ` · ${p.branch}` : "") : "";
  const up = next(view, t);
  return h_flex().size_full().pl(lights).pr(12).items_center().gap(12).bg(t.canvas)
    .when(Boolean(up), (el) => el.child(up))
    .child(div().flex_1().min_w(0).whitespace_nowrap().text_right().truncate().text_size(11).text_color(t.dim).child(where));
}
