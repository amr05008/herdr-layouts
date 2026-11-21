// The tab bar: every tab of the current space, numbered, each with its
// status block, then "+", then where you are. Clicks, rename, the menu,
// drag-to-reorder and the traffic-light padding follow Herdr's shipped
// `tabs` mod (Apache-2.0). model.js names each tab and works out its status.

import { div } from "gpui-kit";
import { h_flex, ScrollHandle } from "gpui-base";
import { spaces, agents, terminals, machines, run, openOverlay, theme, window, layout, settings } from "herdr";
import { buildGroups } from "./model.js";
import { observe } from "./turns.js";
import { wash } from "./colors.js";
import { block, WAITS } from "./ui.js";
import { find } from "./bar.js";

export function init(view) {
  view.pressed = null;
  view.scroll = ScrollHandle.new();
}

export function render(view) {
  const t = theme();
  const sp = spaces(), space = sp.find((s) => s.active);
  const list = agents(), now = Date.now();
  // Index's expanded view of the current space is exactly the tab list.
  const rows = buildGroups({ spaces: sp, agents: list, terminals: terminals(), machines: machines(), changed: observe(list, now), now })
    .flatMap((g) => g.rows).find((r) => r.current)?.tabs ?? [];
  const active = rows.findIndex((r) => r.active);
  // Keep the shown tab in view: when it changes, when it moves, and (below)
  // when it, an earlier tab or the bar itself changes width.
  if (rows[active]?.id !== view.selected || active !== view.selectedIndex) {
    view.selected = rows[active]?.id;
    view.selectedIndex = active;
    if (active >= 0) view.scroll.scroll_to_item(active);
  }
  const reveal = (_size, cx) => {
    if (active < 0) return;
    view.scroll.scroll_to_item(active);
    cx.notify();
  };

  const item = (r, i) => {
    const waits = WAITS.has(r.status);
    return h_flex().id(`tab-${r.id}`).relative().h(30).px(11).gap(8).flex_none().items_center().rounded(6).overflow_hidden().text_size(13)
      .bg(r.active ? t.canvas : waits ? wash(t) : t.raised)
      .text_color(r.active || waits ? t.foreground : t.muted)
      .when(r.active || waits, (el) => el.font_semibold())
      .when(!r.active && !waits, (el) => el.hover((s) => s.bg(t.hover)))
      .when(r.active, (el) => el.child(div().absolute().top(0).left(0).right(0).h(2).bg(t.foreground)))
      // A longer title or a new status block on this or an earlier tab can push the shown one out.
      .when(i <= active, (el) => el.on_size_change(reveal))
      .on_mouse_down("left", (e, cx) => {
        cx.stop_propagation();
        view.pressed = i;
        if (e.click_count === 2) run("tab.rename", { id: r.id });
      })
      .on_mouse_up("left", () => {
        const from = view.pressed;
        view.pressed = null;
        if (from !== null && from !== i && rows[from]) run("tab.move", { id: rows[from].id, index: i + 1 });
        else run("tab.select", { id: r.id });
      })
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: r.id, space: space.id } } });
      })
      .child(div().flex_none().font_family("Geist Mono").text_size(11).text_color(t.dim).child(String(i + 1).padStart(2, "0")))
      .child(div().max_w(220).truncate().child(r.name))
      .when(Boolean(r.status) && r.status !== "quiet", (el) => el.child(block(t, r.status)));
  };

  const root = layout(), sidebar = find(root, "sidebar"), w = window();
  // Clear the traffic lights when the sidebar is hidden or narrower than they are.
  const lights = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
    ? Math.max(8, (root.traffic_lights[0] + 64) / settings().zoom - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
    : 8;
  const where = space ? `${space.name} · ${space.machine ?? "this computer"}`.toUpperCase() : "";
  return h_flex().size_full().min_w(0).pl(lights).pr(14).gap(4).items_center().bg(t.chrome).border_b(1).border_color(t.border)
    .on_mouse_up("left", () => { view.pressed = null; })
    .child(h_flex().id("signal-tabs").flex_1().min_w(0).h_full().items_center().gap(4).overflow_x_scrollbar().track_scroll(view.scroll)
      .on_size_change(reveal)
      .children(rows.map(item))
      .child(h_flex().id("signal-tab-new").size(30).flex_none().items_center().justify_center().rounded(6).text_size(14).text_color(t.dim)
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click(() => run("tab.new", space ? { space: space.id } : {}))
        .child("+")))
    .child(div().flex_none().whitespace_nowrap().text_size(11).font_bold().text_color(t.muted).child(where));
}
