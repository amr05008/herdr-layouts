// Shared drawing: the status block every row, tab and pane carries, and the
// moving bars that mean "working". Amber is waiting on you, teal is working;
// neither is used for anything else.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";

export const SECTION = "layout:signal";
export const WAITS = new Set(["asks", "turn"]);
const WORD = { asks: "ASKS", turn: "YOUR TURN", working: "WORKING" };

// Text on an amber or teal fill.
export const ink = (t) => t.accent_foreground ?? t.canvas;

// Three bars rising and falling out of step (loop() has no delay, so each
// has its own period).
export function bars(color) {
  const bar = (period) => div().w(2.5).h(10).flex_none().bg(color).loop("height", { from: 3.5, to: 10, period });
  return h_flex().h(10).gap(2).flex_none().items_end().child(bar(900)).child(bar(1150)).child(bar(1400));
}

// The status block. Quiet says "IDLE 5H" unfilled; no status draws nothing.
export function block(t, status, age = "") {
  if (!status) return null;
  const el = h_flex().h(20).flex_none().items_center().gap(5).rounded(4).text_size(10.5).whitespace_nowrap();
  if (WAITS.has(status)) return el.px(8).font_bold().bg(t.accent).text_color(ink(t)).child(WORD[status]);
  if (status === "working") return el.px(8).font_bold().bg(t.working).text_color(ink(t)).child(bars(ink(t))).child(WORD.working);
  return el.font_semibold().text_color(t.dim).child(age ? `IDLE ${age.toUpperCase()}` : "IDLE");
}
