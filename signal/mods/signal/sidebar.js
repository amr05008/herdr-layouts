// The sidebar: three counters, then one list of spaces grouped by machine,
// in Herdr's order. Every row says its status in a block; a row waiting on
// you is washed amber. model.js decides what each row says; this file only
// draws it. Drag-to-reorder follows Herdr's shipped `spaces` mod (Apache-2.0).

import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, agents, terminals, machines, layout, theme, run, openOverlay, setAgentOrder } from "herdr";
import { buildGroups, tally, jumpCommand } from "./model.js";
import { observe } from "./turns.js";
import { wash, CLEAR } from "./colors.js";
import { block, bars, ink, WAITS } from "./ui.js";
import { find, jump } from "./bar.js";

const RAIL = 160; // narrower than this, the sidebar draws a rail of marks
const menu = (tab, target) => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab, target } });

export function init(view, _props, cx) {
  view.pressed = null;
  view.over = null;
  view.jumped = null;
  cx.timer.every(30000, (cx) => cx.notify()); // ages
}

export function render(view) {
  const t = theme();
  const list = agents(), terms = terminals(), now = Date.now();
  const changed = observe(list, now);
  setAgentOrder(list.map((a) => a.address));
  const sp = spaces();
  const groups = buildGroups({ spaces: sp, agents: list, terminals: terms, machines: machines(), changed, now, flat: true });
  const counts = tally({ agents: list, terminals: terms, changed });
  if ((find(layout(), "sidebar")?.size?.px ?? Infinity) < RAIL) return rail(groups, counts.need, t);
  return v_flex().id("signal-sidebar").size_full().bg(t.chrome).text_size(12.5)
    .on_mouse_up("left", (_e, cx) => {
      view.pressed = null;
      view.over = null;
      cx.notify();
    })
    .child(counters(view, counts, t))
    .child(v_flex().id("signal-list").flex_1().min_h(0).overflow_y_scrollbar().pb(8)
      .children(groups.map((g) => group(view, g, sp, t))))
    .child(footer(t));
}

// Need you (amber, does what ⌘J does), working (teal), idle.
function counters(view, c, t) {
  const box = (id, n, label, bg, fg, sub) => v_flex().id(id).flex_1().min_w(0).rounded(7).px(9).pt(6).pb(7).bg(bg)
    .child(div().text_size(22).font_bold().text_color(fg).child(String(n)))
    .child(div().text_size(10).font_bold().whitespace_nowrap().text_color(sub).child(label));
  return h_flex().flex_none().px(10).pt(4).pb(8).gap(6)
    .child((c.need > 0 ? box("signal-count-need", c.need, "NEED YOU", t.accent, ink(t), ink(t)) : box("signal-count-need", 0, "NEED YOU", t.raised, t.muted, t.muted))
      .when(c.need > 0, (el) => el.cursor_pointer().on_click(() => { view.jumped = jump(view.jumped); })))
    .child(c.working > 0 ? box("signal-count-working", c.working, "WORKING", t.working, ink(t), ink(t)) : box("signal-count-working", 0, "WORKING", t.raised, t.muted, t.muted))
    .child(box("signal-count-idle", c.idle, "IDLE", t.raised, t.muted, t.muted));
}

function group(view, g, sp, t) {
  return v_flex().flex_none()
    .when(g.label !== null, (el) => el.child(h_flex().px(14).pt(10).pb(6).gap(8).items_center().text_size(11).font_bold()
      .child(div().flex_none().text_color(t.muted).child(g.label.toUpperCase()))
      .child(div().flex_none().text_color(t.dim).child(String(g.rows.length)))
      .child(div().flex_1().h(1).bg(t.border))))
    .child(v_flex().gap(2).when(g.offline, (el) => el.opacity(0.5))
      .children(g.rows.flatMap((r) => [spaceRow(view, r, g, sp, t), ...r.subs.map((s) => subRow(s, t))])));
}

function spaceRow(view, r, g, sp, t) {
  const index = sp.findIndex((s) => s.id === r.id);
  const from = sp.findIndex((s) => s.id === view.pressed);
  const dragging = view.pressed !== null && view.over === r.id && view.pressed !== r.id;
  const quiet = !r.status || r.status === "quiet";
  const detail = r.detail || (r.lit ? "" : null);
  const line = detail === null ? null : [r.current && r.tabCount > 1 ? `${r.tabCount} tabs` : null, detail].filter(Boolean).join(" · ");
  return v_flex().id(`space-${r.id}`).relative().flex_none().mx(8).px(10).rounded(7).overflow_hidden().justify_center().gap(3)
    .h(line ? 54 : 36)
    .border(1.5).border_color(r.current ? t.foreground : CLEAR)
    .when(r.lit, (el) => el.bg(wash(t)).child(div().absolute().left(0).top(0).bottom(0).w(3).bg(t.accent)))
    .when(!r.lit, (el) => el.hover((s) => s.bg(t.hover)))
    .when(view.pressed === r.id && view.over !== r.id, (el) => el.opacity(0.5))
    .when(dragging, (el) => el.child(div().absolute().left(0).right(0).h(2).bg(t.foreground)
      .when(from < index, (l) => l.bottom(0))
      .when(from > index, (l) => l.top(0))))
    .on_mouse_down("left", () => {
      view.pressed = r.id;
      view.over = r.id;
    })
    .on_mouse_move((_e, cx) => {
      if (view.pressed === null) return;
      const source = sp.find((s) => s.id === view.pressed);
      const over = source && (source.machine ?? null) === g.machine ? r.id : null;
      if (view.over !== over) {
        view.over = over;
        cx.notify();
      }
    })
    .on_mouse_up("left", (_e, cx) => {
      const pressed = view.pressed, over = view.over;
      view.pressed = null;
      view.over = null;
      if (pressed !== null && over === r.id && pressed !== r.id) run("space.move", { id: pressed, index: index + 1 });
      else if (pressed === r.id) run("space.select", { id: r.id });
      cx.notify();
    })
    .on_click((e) => {
      if (e.click_count === 2) run("space.rename", { id: r.id });
    })
    .on_mouse_down("right", () => menu("space", { id: r.id }))
    .child(h_flex().items_center().gap(8)
      .child(div().flex_1().min_w(0).truncate().text_size(14.5)
        .when(quiet, (el) => el.font_medium().text_color(t.muted))
        .when(!quiet, (el) => el.font_semibold().text_color(t.foreground))
        .child(r.name))
      .when(!r.lit && r.agents >= 2, (el) => el.child(div().flex_none().whitespace_nowrap().text_size(11).text_color(t.dim).child(`${r.agents} agents`)))
      .when(Boolean(r.alsoWorking), (el) => el.child(bars(t.working)))
      .when(Boolean(r.status), (el) => el.child(block(t, r.status, r.age))))
    .when(Boolean(line), (el) => el.child(div().min_w(0).truncate().text_size(12).text_color(t.muted).child(line)));
}

// A sub-agent that asks, under its space.
function subRow(s, t) {
  return v_flex().id(`agent-${s.address}`).relative().flex_none().ml(22).mr(8).px(10).rounded(7).overflow_hidden().justify_center().gap(3)
    .h(s.detail ? 50 : 32)
    .when(s.lit, (el) => el.bg(wash(t)).child(div().absolute().left(0).top(0).bottom(0).w(3).bg(t.accent)))
    .when(!s.lit, (el) => el.hover((st) => st.bg(t.hover)))
    .on_click(() => run(...jumpCommand(s.address, agents())))
    .child(h_flex().items_center().gap(8)
      .child(div().flex_1().min_w(0).truncate().text_size(13).font_semibold().text_color(t.foreground).child(s.label))
      .child(block(t, s.status)))
    .when(Boolean(s.detail), (el) => el.child(div().min_w(0).truncate().text_size(12).text_color(t.muted).child(s.detail)));
}

function footer(t) {
  const link = (id, label, command) => div().id(id).cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click(() => run(command)).child(label);
  return h_flex().flex_none().h(32).px(12).items_center().justify_between().border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
    .child(link("signal-new-space", "+ New space", "space.new"))
    .child(link("signal-settings", "Settings", "app.settings"));
}

// Folded: the need-you count, then one mark per space, a hairline between
// machines. Amber waits, teal works, a faint dot is idle.
function rail(groups, need, t) {
  const dot = (r) => {
    if (WAITS.has(r.status)) return div().size(8).rounded(4).bg(t.accent);
    if (r.status === "working") return div().size(8).rounded(4).bg(t.working).loop("opacity", { from: 0.35, to: 1, period: 1400 });
    return div().size(5).rounded(2.5).bg(t.dim);
  };
  const cell = (r) => h_flex().id(`rail-${r.id}`).flex_none().w(28).h(26).rounded(5).items_center().justify_center()
    .border(1.5).border_color(r.current ? t.foreground : CLEAR)
    .when(r.lit, (el) => el.bg(wash(t)))
    .when(!r.lit, (el) => el.hover((s) => s.bg(t.hover)))
    .on_click(() => run("space.select", { id: r.id }))
    .child(dot(r));
  return v_flex().id("signal-rail").size_full().bg(t.chrome).items_center()
    .child(h_flex().h(28).flex_none().items_center().text_size(12).font_bold().text_color(t.accent).child(need > 0 ? String(need) : ""))
    .child(v_flex().id("signal-rail-list").flex_1().min_h(0).items_center().gap(2).overflow_y_scrollbar()
      .children(groups.flatMap((g, i) => [...(i > 0 ? [div().flex_none().w(20).h(1).my(4).bg(t.border)] : []), ...g.rows.map(cell)])));
}
