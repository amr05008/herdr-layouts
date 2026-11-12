// Builders for Herdr's live data (herdr.d.ts shapes). `o` overrides any field.
const CLAUDE = { key: "claude", name: "Claude Code", icon: null, tint: false, tile: null, color: null, shell: false, agent: true };

export const tb = (id, o = {}) => ({
  id, index: 1, name: "1", named: false, active: true, status: null, panes: 1, zoomed: false,
  settled: false, settled_at: null, changed_at: null, working_since: null, ...o,
});

export const sp = (id, o = {}) => ({
  id, index: 1, name: id, named: true, folder: "", machine: null, branch: null, active: false,
  status: null, tabs: [tb(`${id}-t1`)], ...o,
});

export const ag = (address, space, tab, status, o = {}) => ({
  address, pane: `p-${address}`, space, space_name: space, tab, tab_index: 1, tab_name: "1",
  status, app: "claude-code", program: CLAUDE, title: "", seq: 1, pinned: false, focused: false, ...o,
});

export const term = (address, parent, status, o = {}) => ({
  address, parent, state: "live", status, name: null, title: "", program: CLAUDE, ...o,
});

export const LOCAL = [{ name: null, layout: "ready" }];
