// The sidebar: one list of spaces, grouped by machine, in Herdr's order,
// where only "needs you" uses the accent (spec "Sidebar, top to bottom").
// model.js decides what each row says; this file only draws it.
// Drag-to-reorder follows Herdr's shipped `spaces` mod (Apache-2.0).

import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, agents, terminals, machines, keys, layout, window, theme, run, openOverlay, setAgentOrder } from "herdr";
import { buildGroups, targets, track, keyLabel, jumpCommand } from "./model.js";
import { mark } from "./ui.js";
import { find, jump } from "./strip.js";

const RAIL = 160; // narrower than this, the sidebar draws a rail of marks
const NEEDS = new Set(["blocked", "done"]);
const menu = (tab, target) => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab, target } });

export function init(view, _props, cx) {
  try {
    view.changed = JSON.parse(localStorage.getItem("changed") ?? "{}");
  } catch {
    view.changed = {};
  }
  view.pressed = null;
  view.over = null;
  cx.timer.every(30000, (cx) => cx.notify()); // ages
}

export function render(view) {
  const t = theme();
  const list = agents(), terms = terminals(), now = Date.now();
  if (track(view.changed, list, now)) localStorage.setItem("changed", JSON.stringify(view.changed));
  setAgentOrder(list.map((a) => a.address));
  const sp = spaces();
  const groups = buildGroups({ spaces: sp, agents: list, terminals: terms, machines: machines(), changed: view.changed, now });
  const count = targets({ agents: list, terminals: terms }).length;
  if ((find(layout(), "sidebar")?.size?.px ?? Infinity) < RAIL) return rail(groups, count, t);
  return v_flex().id("index-sidebar").size_full().bg(t.chrome).text_size(12.5)
    .on_mouse_up("left", (_e, cx) => {
      view.pressed = null;
      view.over = null;
      cx.notify();
    })
    .child(needsLine(view, count, t))
    .child(v_flex().id("index-list").flex_1().min_h(0).overflow_y_scrollbar().pb(8)
      .children(groups.map((g) => group(view, g, sp, t))))
    .child(footer(t));
}

// "2 need you" and the key that jumps there; empty (same height) at 0.
function needsLine(view, count, t) {
  const hint = keyLabel(keys(), "index.next-needs-you", window()?.platform === "macos");
  return h_flex().id("index-needs").h(28).flex_none().px(12).items_center().justify_between()
    .when(count > 0, (el) => el.cursor_pointer().on_click(() => { view.jumped = jump(view.jumped); })
      .child(div().text_size(12.5).font_semibold().text_color(t.accent).child(`${count} need you`))
      .when(Boolean(hint), (el) => el.child(div().text_size(11).text_color(t.dim).child(`${hint} next`))));
}

// Name colour and weight by status (spec "Status marks").
function named(el, status, t, rest = t.dim) {
  if (status === "blocked") return el.text_color(t.accent).font_semibold();
  if (status === "done") return el.text_color(t.foreground).font_semibold();
  if (status === "working") return el.text_color(t.foreground);
  return el.text_color(rest);
}

const detailLine = (text, t) => div().pl(20).min_w(0).truncate().text_size(11).text_color(t.muted).child(text);

function group(view, g, sp, t) {
  return v_flex().flex_none()
    .when(g.label !== null, (el) => el.child(div().px(12).pt(10).pb(4).text_size(11).text_color(t.dim).child(g.label)))
    .child(v_flex().when(g.offline, (el) => el.opacity(0.5))
      .children(g.rows.flatMap((r) => [spaceRow(view, r, g, sp, t), ...r.subs.map((s) => agentRow(s, 1, t)), ...tabRows(r, t)])));
}

function spaceRow(view, r, g, sp, t) {
  const index = sp.findIndex((s) => s.id === r.id);
  const from = sp.findIndex((s) => s.id === view.pressed);
  const dragging = view.pressed !== null && view.over === r.id && view.pressed !== r.id;
  return v_flex().id(`space-${r.id}`).relative().flex_none().mx(6).px(6).rounded(5).justify_center().h(r.detail ? 40 : 26)
    .when(r.current, (el) => el.bg(t.selected))
    .when(!r.current, (el) => el.hover((s) => s.bg(t.hover)))
    .when(view.pressed === r.id && view.over !== r.id, (el) => el.opacity(0.5))
    .when(dragging, (el) => el.child(div().absolute().left(0).right(0).h(2).bg(t.foreground)
      .when(from < index, (line) => line.bottom(0))
      .when(from > index, (line) => line.top(0))))
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
      .child(mark(t, r.status))
      .child(named(div().flex_1().min_w(0).truncate(), r.status, t).child(r.name))
      .child(div().w(56).flex_none().text_right().whitespace_nowrap().text_size(11).text_color(t.dim).child(r.right)))
    .when(Boolean(r.detail), (el) => el.child(detailLine(r.detail, t)));
}

// The current space's tabs, then "+ tab".
function tabRows(r, t) {
  if (!r.current) return [];
  return [
    ...r.tabs.flatMap((tab) => [tabRow(r, tab, t), ...tab.agents.map((a) => agentRow(a, 2, t)), ...tab.subs.map((s) => agentRow(s, 2, t))]),
    h_flex().id(`newtab-${r.id}`).flex_none().mx(6).pl(32).h(24).items_center().rounded(5).text_size(12).text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click(() => run("tab.new", { space: r.id }))
      .child("+ tab"),
  ];
}

function tabRow(r, tab, t) {
  return v_flex().id(`tab-${tab.id}`).flex_none().mx(6).pl(12).pr(6).rounded(5).justify_center().h(tab.detail ? 38 : 24)
    .hover((s) => s.bg(t.hover))
    .on_click((e) => run(e.click_count === 2 ? "tab.rename" : "tab.select", { id: tab.id }))
    .on_mouse_down("right", () => menu("tab", { id: tab.id, space: r.id }))
    .child(h_flex().items_center().gap(6)
      .child(div().w(1.5).h(12).flex_none().when(tab.active, (el) => el.bg(t.foreground)))
      .child(mark(t, tab.status))
      .child(named(div().flex_1().min_w(0).truncate().text_size(12), tab.status, t, tab.active ? t.foreground : t.dim).child(tab.name)))
    .when(Boolean(tab.detail), (el) => el.child(detailLine(tab.detail, t).pl(32)));
}

// An agent in a split tab, or a blocked sub-agent.
function agentRow(s, depth, t) {
  return v_flex().id(`agent-${s.address}`).flex_none().mx(6).pl(6 + depth * 12).pr(6).rounded(5).justify_center()
    .h(s.detail && NEEDS.has(s.status) ? 38 : 24)
    .hover((st) => st.bg(t.hover))
    .on_click(() => run(...jumpCommand(s.address, agents())))
    .child(h_flex().items_center().gap(8)
      .child(mark(t, s.status))
      .child(named(div().flex_1().min_w(0).truncate().text_size(12), s.status, t).child(s.label)))
    .when(Boolean(s.detail) && NEEDS.has(s.status), (el) => el.child(detailLine(s.detail, t)));
}

function footer(t) {
  const link = (id, label, command) => div().id(id).cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click(() => run(command)).child(label);
  return h_flex().flex_none().h(32).px(12).items_center().justify_between().border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
    .child(link("index-new-space", "+ New space", "space.new"))
    .child(link("index-settings", "Settings", "app.settings"));
}

// Folded: the count, then one mark per space, a hairline between machines.
// An idle space gets a faint dot so every space has something to click.
function rail(groups, count, t) {
  const cell = (r) => h_flex().id(`rail-${r.id}`).flex_none().w(28).h(26).rounded(5).items_center().justify_center()
    .when(r.current, (el) => el.bg(t.selected))
    .when(!r.current, (el) => el.hover((s) => s.bg(t.hover)))
    .on_click(() => run("space.select", { id: r.id }))
    .child(r.status && r.status !== "idle" ? mark(t, r.status) : div().size(4).rounded(2).bg(t.dim));
  return v_flex().id("index-rail").size_full().bg(t.chrome).items_center()
    .child(h_flex().h(28).flex_none().items_center().text_size(11).font_semibold().text_color(t.accent).child(count > 0 ? String(count) : ""))
    .child(v_flex().id("index-rail-list").flex_1().min_h(0).items_center().overflow_y_scrollbar()
      .children(groups.flatMap((g, i) => [...(i > 0 ? [div().flex_none().w(20).h(1).my(4).bg(t.border)] : []), ...g.rows.map(cell)])));
}
