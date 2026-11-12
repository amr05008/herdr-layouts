// The one-line label on each pane of a split tab: the program, then its
// folder. The focused pane's program is in full text, the rest faint; no
// buttons. Single panes stay bare (`lone: false` in the layout).

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, theme } from "herdr";
import { tilde } from "./strip.js";

export function render() {
  const t = theme();
  const p = panes().find((x) => x.pane === props()?.pane);
  if (!p) return div().size_full();
  return h_flex().size_full().px(10).gap(6).items_center().bg(t.background).text_size(11).whitespace_nowrap()
    .child(div().flex_none().text_color(p.focused ? t.foreground : t.dim).child(p.program?.name ?? p.title))
    .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(p.cwd ? tilde(p.cwd) : ""));
}
