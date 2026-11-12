// Index's model: what the sidebar lists and where ⌘J goes, worked out from
// Herdr's live data. Pure: it imports nothing, so Node can test it
// (tests/*.test.js). duration(), the title filter in telling() and track()
// follow Herdr's shipped `agents` mod (Apache-2.0).

export const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
const rank = (s) => RANK[s] ?? 0;
const higher = (a, b) => (rank(b) > rank(a) ? b : a);
const NEEDS = new Set(["blocked", "done"]);
const MONTH = 30 * 86400000;

export function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

// The terminal's title when it says something: not a path, not user@host,
// not just the program's name.
export function telling(title, program) {
  const raw = (title ?? "").trim();
  if (!raw || /^[~/]|^[A-Za-z]:\\/.test(raw)) return null;
  const live = clean(raw);
  if (!live || live.includes("@") || live === program?.name || live.toLowerCase() === program?.key) return null;
  return live;
}

// A sub-agent's status: an error needs you; its "done" is its parent's news.
export function kidStatus(k, listed) {
  const s = listed?.get(k.address) ?? k.status;
  return s === "error" ? "blocked" : s === "done" ? "idle" : s;
}

// Stamps agents whose state changed (done and idle count as one).
// Mutates `changed`; returns whether anything did.
export function track(changed, agents, now) {
  let dirty = false;
  for (const a of agents) {
    const s = a.status === "done" ? "idle" : a.status;
    if (changed[a.address]?.s === s) continue;
    changed[a.address] = { s, at: now };
    dirty = true;
  }
  if (!dirty) return false;
  const listed = new Set(agents.map((a) => a.address));
  for (const [k, c] of Object.entries(changed)) if (!listed.has(k) && now - c.at > MONTH) delete changed[k];
  return true;
}

// Live sub-agents below `addr`, depth first. A kept one (in agents()) is
// walked as an agent in its own right, so it and its children are left out.
function subsOf(all, addr, listed) {
  return all
    .filter((k) => k.parent === addr && k.state === "live" && !listed.has(k.address))
    .flatMap((k) => [k, ...subsOf(all, k.address, listed)]);
}

// Every agent in list order, with the status Index uses for it and its
// unlisted sub-agents. A kept sub-agent (one with a pane, so in agents())
// is still a sub-agent: its "done" counts as idle (spec), and it isn't
// one of its space's own agents.
function entries(agents, terminals) {
  const listed = new Map(agents.map((a) => [a.address, a.status]));
  const parentOf = new Map(terminals.map((t) => [t.address, t.parent]));
  return agents.map((a) => {
    const kept = Boolean(parentOf.get(a.address));
    return {
      agent: a,
      kept,
      status: kept ? kidStatus(a, null) : a.status,
      subs: subsOf(terminals, a.address, listed).map((k) => ({ term: k, status: kidStatus(k, listed), tab: a.tab, space: a.space })),
    };
  });
}

// Who needs you, in ⌘J order: blocked agents, each followed by its blocked
// sub-agents, then done agents; list order within each.
function needs(es) {
  const blocked = [], done = [];
  for (const { agent: a, status, subs } of es) {
    const own = { address: a.address, title: a.title, program: a.program, space: a.space, tab: a.tab };
    if (status === "blocked") blocked.push(own);
    for (const s of subs) {
      if (s.status === "blocked") blocked.push({ address: s.term.address, title: s.term.title, program: s.term.program, space: s.space, tab: s.tab, sub: true });
    }
    if (status === "done") done.push(own);
  }
  return [...blocked, ...done];
}

const subRow = (s) => ({
  address: s.term.address,
  label: s.term.name ?? s.term.program?.name ?? s.term.address,
  status: s.status,
  detail: telling(s.term.title, s.term.program),
});

const mostUrgent = (es) => es.reduce((best, e) => (!best || rank(e.status) > rank(best.status) ? e : best), null)?.agent;
// A row's status: its most urgent agent (sub-agents as Index counts them), lifted by blocked sub-agents.
const statusOf = (es, blockedSubs) => es.reduce((st, e) => higher(st, e.status), blockedSubs.length ? "blocked" : null);

// Stock's tab label: the agent's title for an unnamed tab, else its name.
function tabLabel(tab, lead) {
  const live = telling(lead?.title, lead?.program);
  return (tab.name === lead?.program?.name || !tab.named) && live ? live : tab.name;
}

export function buildGroups({ spaces, agents, terminals, machines, changed, now }) {
  const es = entries(agents, terminals);
  const need = needs(es);
  const own = (e) => !e.kept;
  const detailOf = (status, n) => (NEEDS.has(status) && n ? telling(n.title, n.program) : null);

  function tabRow(t, mine, blockedSubs) {
    const tabbed = mine.filter((e) => e.agent.tab === t.id);
    const inTab = tabbed.filter(own);
    const subs = blockedSubs.filter((s) => s.tab === t.id);
    const status = statusOf(tabbed, subs);
    const name = tabLabel(t, inTab[0]?.agent);
    const detail = detailOf(status, need.find((n) => n.tab === t.id && !n.sub));
    return {
      id: t.id,
      name,
      active: t.active,
      status,
      detail: detail === name ? null : detail,
      agents: inTab.length >= 2
        ? inTab.map(({ agent: a, status: st }) => ({ address: a.address, label: a.program?.key ?? "agent", status: st, detail: detailOf(st, a) }))
        : [],
      subs: subs.map(subRow),
    };
  }

  function spaceRow(s) {
    const mine = es.filter((e) => e.agent.space === s.id);
    const ownAgents = mine.filter(own);
    const blockedSubs = mine.flatMap((e) => e.subs.filter((x) => x.status === "blocked"));
    const status = statusOf(mine, blockedSubs);
    const lead = mostUrgent(ownAgents);
    const at = lead ? changed[lead.address]?.at : undefined;
    const right = ownAgents.length >= 2 ? `${ownAgents.length} agents` : at != null ? duration(now - at) : "";
    const tabs = s.active ? s.tabs.map((t) => tabRow(t, mine, blockedSubs)) : [];
    // A sub-agent shows its own text on its own row below, so only the space's own agents count here.
    const detail = detailOf(status, need.find((n) => n.space === s.id && !n.sub));
    return {
      id: s.id,
      name: s.name,
      current: s.active,
      status,
      // The current space's tab rows may already say it.
      detail: tabs.some((t) => t.name === detail || t.detail === detail) ? null : detail,
      right,
      subs: s.active ? [] : blockedSubs.map(subRow),
      tabs,
    };
  }

  const groups = new Map();
  for (const s of spaces) {
    const m = s.machine ?? null;
    if (!groups.has(m)) groups.set(m, []);
    groups.get(m).push(spaceRow(s));
  }
  for (const mc of machines) {
    if (mc.layout === "unavailable" && !groups.has(mc.name ?? null)) groups.set(mc.name ?? null, []);
  }
  const state = new Map(machines.map((mc) => [mc.name ?? null, mc.layout]));
  const one = groups.size === 1;
  return [...groups].map(([machine, rows]) => {
    const offline = state.get(machine) === "unavailable";
    const base = machine ?? "This computer";
    return { machine, label: one && !offline ? null : offline ? `${base} · offline` : base, offline, rows };
  });
}

// Where ⌘J goes, in order (see needs()). "N need you" is its length.
export function targets({ agents, terminals }) {
  return needs(entries(agents, terminals)).map((n) => n.address);
}

// The target after `current`, wrapping. When `current` has left the list
// (looking at a done agent makes it idle), the first of `after` (the targets
// that followed it when it was jumped to) still listed; else the first.
export function nextTarget(list, current, after = []) {
  if (!list.length) return null;
  const i = list.indexOf(current);
  if (i !== -1) return list[(i + 1) % list.length];
  return after.find((a) => list.includes(a)) ?? list[0];
}

// Where the next ⌘J counts from. A jump to a pane-less sub-agent only peeks,
// so focus doesn't move: while focus is still where it was (or on the last
// target), carry on from the last target. memory = { at, from, after } | null.
// The address ⌘J counts from: what has the keyboard. focused().agent is the
// agent an agent block would show, which Index doesn't have, so it's second.
export function focusedAddress(f) {
  return f?.terminal ?? f?.agent ?? null;
}

export function jumpFrom(memory, current) {
  return memory && (current === memory.at || current === memory.from) ? memory.at : current;
}

// How to show a target: agents with a pane get focus; a sub-agent without
// one opens in a peek, as stock's agents list does.
export function jumpCommand(address, agents) {
  return agents.some((a) => a.address === address)
    ? ["agent.focus", { terminal: address }]
    : ["terminal.peek", { terminal: address }];
}

const MAC_MODS = [["ctrl", "⌃"], ["alt", "⌥"], ["shift", "⇧"], ["cmd", "⌘"]];
const cap = (s) => (s.length === 1 ? s.toUpperCase() : s[0].toUpperCase() + s.slice(1));

// The key bound to `action`, as people read it ("⇧⌘E"); null when unbound.
// Index's own section wins over global.
export function keyLabel(keys, action, mac) {
  const k = keys.find((x) => x.section === "layout:index" && x.action === action)
    ?? keys.find((x) => x.section === "global" && x.action === action);
  if (!k) return null;
  const [, mods = "", key] = /^((?:(?:cmd|ctrl|alt|shift|fn)-)*)(.+)$/.exec(k.keys) ?? [];
  const held = mods.split("-").filter(Boolean);
  if (!mac) return [...held, key].map(cap).join("+");
  return MAC_MODS.filter(([m]) => held.includes(m)).map(([, g]) => g).join("") + cap(key);
}

// Which part of the window this copy draws: a pane header gets `pane` props.
export function roleOf(p) {
  if (p?.pane) return "pane";
  return p?.role === "strip" || p?.role === "top" ? p.role : "sidebar";
}
