// Shared drawing: the status marks, the whole visual language (spec "Status marks").

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";

// A 12 px column holding one mark: asks is a filled accent dot, your turn an
// accent ring, working a muted dot that pulses; quiet or no agent draws nothing.
export function mark(t, status) {
  const box = h_flex().w(12).flex_none().items_center().justify_center();
  if (status === "asks") return box.child(div().size(6).rounded(3).bg(t.accent));
  if (status === "turn") return box.child(div().size(6).rounded(3).border(1.5).border_color(t.accent));
  if (status === "working") return box.child(div().size(6).rounded(3).bg(t.muted).loop("opacity", { from: 0.25, to: 1, period: 1400 }));
  return box;
}
