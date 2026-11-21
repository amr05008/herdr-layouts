// The one-line label on each pane of a split tab: the program, its status
// block, then its folder. The focused pane's program is in full text, the
// rest faint; no buttons. Single panes stay bare (`lone: false` in the layout).

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, agents, terminals, props, theme } from "herdr";
import { agentStatus } from "./model.js";
import { observe } from "./turns.js";
import { tilde } from "./bar.js";
import { block } from "./ui.js";

export function render() {
  const t = theme();
  const p = panes().find((x) => x.pane === props()?.pane);
  if (!p) return div().size_full();
  const list = agents();
  const a = list.find((x) => x.pane === p.pane);
  // The same rule as the sidebar and ⌘J: a sub-agent's finish isn't a turn.
  const status = a ? agentStatus(a, terminals(), observe(list)) : null;
  return h_flex().size_full().px(10).gap(8).items_center().bg(t.background).text_size(11).whitespace_nowrap()
    .child(div().flex_none().font_semibold().text_color(p.focused ? t.foreground : t.dim).child(p.program?.name ?? p.title))
    .when(Boolean(status) && status !== "quiet", (el) => el.child(block(t, status)))
    .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(p.cwd ? tilde(p.cwd) : ""));
}
