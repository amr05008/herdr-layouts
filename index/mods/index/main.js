// Index: one mod, four roles chosen by its block's props (see model.js roleOf):
// the sidebar list, the empty drag strip above it, the work area's top strip
// (which owns ⌘J and the Files/Changes keys) and the label on split panes.
// One folder because Herdr refuses imports from outside a mod's folder, and
// ⌘J must follow exactly the sidebar's logic.

import { View, div } from "gpui-kit";
import { props } from "herdr";
import { roleOf } from "./model.js";
import * as sidebar from "./sidebar.js";
import * as strip from "./strip.js";
import * as pane from "./pane.js";

const ROLES = { sidebar, strip, pane, top: { render: () => div().size_full() } };

export default class Index extends View {
  init(_p, cx) {
    // props() is this copy's block props; init's own argument doesn't carry them.
    const p = props();
    this.role = ROLES[roleOf(p)];
    this.role.init?.(this, p, cx);
  }

  render(cx) {
    return this.role.render(this, cx);
  }
}
