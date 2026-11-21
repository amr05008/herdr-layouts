// Signal: one mod, five roles chosen by its block's props (model.js roleOf):
// the sidebar list, the empty drag strip above it, the tab bar, the status
// bar (which owns ⌘J, ⇧⌘J and the Files/Changes keys) and the label on split
// panes. One folder because Herdr refuses imports from outside a mod's
// folder. model.js and turns.js are the same files as Index's
// (tests/signal.test.js keeps them so), and both layouts share one record
// of who waits on you.

import { View, div } from "gpui-kit";
import { props } from "herdr";
import { roleOf } from "./model.js";
import * as sidebar from "./sidebar.js";
import * as tabs from "./tabs.js";
import * as bar from "./bar.js";
import * as pane from "./pane.js";

const ROLES = { sidebar, tabs, bar, pane, top: { render: () => div().size_full() } };

export default class Signal extends View {
  init(_p, cx) {
    // props() is this copy's block props; init's own argument doesn't carry them.
    const p = props();
    this.role = ROLES[roleOf(p)] ?? sidebar;
    this.role.init?.(this, p, cx);
  }

  render(cx) {
    return this.role.render(this, cx);
  }
}
