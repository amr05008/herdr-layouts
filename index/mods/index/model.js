// Index's model: what the sidebar lists and where ⌘J goes, worked out from
// Herdr's live data. Pure: it imports nothing, so Node can test it
// (tests/*.test.js). duration(), the title filter in telling() and track()
// follow Herdr's shipped `agents` mod (Apache-2.0).

// Index's statuses: asks (Herdr's blocked), turn (finished, not yet answered
// or dismissed), working, quiet (anything else). WORDS is what a lit row says.
export const RANK = { asks: 4, turn: 3, working: 2, quiet: 1 };
export const WORDS = { asks: "asks", turn: "your turn" };
const rank = (s) => RANK[s] ?? 0;
const higher = (a, b) => (rank(b) > rank(a) ? b : a);
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

// A sub-agent's status: an error or a question needs you; its "done" is its
// parent's news, so a sub-agent never has a turn of its own.
export function kidStatus(k, listed) {
  const s = listed?.get(k.address) ?? k.status;
  return s === "error" || s === "blocked" ? "asks" : s === "working" ? "working" : "quiet";
}

// Stamps agents whose state changed (done and idle count as one) and keeps
// each one's turn: an agent that finished needs you until it works again
// (you replied) or you dismiss it. Looking at it doesn't end the turn.
// Stamp = { s: "working" | "blocked" | "idle", at, turn } (old stamps lack
// `turn`: quiet). Mutates `changed`; returns whether anything did.
export function track(changed, agents, now) {
  let dirty = false;
  for (const a of agents) {
    const s = a.status === "done" ? "idle" : a.status;
    const prev = changed[a.address];
    // First sight: `fresh` (no history yet), so an older stamp may replace it (mergeLegacy).
    if (!prev) changed[a.address] = { s, at: now, turn: a.status === "done", fresh: true };
    else if (prev.s !== s) changed[a.address] = { s, at: now, turn: s === "idle" };
    // A finish the stamps missed (it worked between two looks): Herdr still says
    // done. Not the finish you just dismissed, which Herdr may still call done.
    else if (a.status === "done" && !prev.turn && !prev.dismissed) changed[a.address] = { s, at: now, turn: true };
    else continue;
    dirty = true;
  }
  if (!dirty) return false;
  const listed = new Set(agents.map((a) => a.address));
  for (const [k, c] of Object.entries(changed)) if (!listed.has(k) && now - c.at > MONTH) delete changed[k];
  return true;
}

// The saved record as a plain object of stamps, whatever was stored: a wrong
// shape would make track() rediscover the same agents on every render and
// write forever. Drops entries that aren't stamps.
export function asRecord(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out = {};
  for (const [k, st] of Object.entries(v)) {
    if (st && typeof st === "object" && !Array.isArray(st) && typeof st.s === "string" && typeof st.at === "number") out[k] = st;
  }
  return out;
}

// Folds the sidebar's old per-copy stamps into the shared record. An old
// stamp replaces only a missing or fresh one (first sight, nothing since), so
// a finish the old stamp proves (working, now idle) still lights, and no real
// turn or dismissal is lost whichever copy started first.
export function mergeLegacy(record, legacy) {
  const out = { ...record };
  let changed = false;
  for (const [k, st] of Object.entries(asRecord(legacy))) {
    if (out[k] && !out[k].fresh) continue;
    out[k] = { s: st.s, at: st.at };
    changed = true;
  }
  return { record: out, changed };
}

// ⇧⌘J: ends the agent's turn without a reply. Only a turn: an agent that
// asks is stuck until you answer it. Returns whether it did anything.
export function dismiss(changed, address) {
  const st = address == null ? null : changed[address];
  if (!st?.turn) return false;
  st.turn = false;
  st.dismissed = true; // until it changes state again: this finish is handled
  delete st.fresh;
  return true;
}

// An agent's own Index status: asks, turn, working or quiet.
export function ownStatus(a, changed) {
  if (a.status === "blocked") return "asks";
  if (a.status === "working") return "working";
  return changed?.[a.address]?.turn ? "turn" : "quiet";
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
// is still a sub-agent: it never has a turn (spec), and it isn't one of
// its space's own agents.
function entries(agents, terminals, changed) {
  const listed = new Map(agents.map((a) => [a.address, a.status]));
  const parentOf = new Map(terminals.map((t) => [t.address, t.parent]));
  return agents.map((a) => {
    const kept = Boolean(parentOf.get(a.address));
    return {
      agent: a,
      kept,
      status: kept ? kidStatus(a, null) : ownStatus(a, changed),
      subs: subsOf(terminals, a.address, listed).map((k) => ({ term: k, status: kidStatus(k, listed), tab: a.tab, space: a.space, space_name: a.space_name })),
    };
  });
}

// Who needs you, in ⌘J order: agents that ask, each followed by its
// sub-agents that ask, then agents whose turn it is; list order within each.
function collect(es) {
  const asks = [], turn = [];
  for (const { agent: a, status, subs } of es) {
    const own = { address: a.address, status, title: a.title, program: a.program, space: a.space, space_name: a.space_name, tab: a.tab };
    if (status === "asks") asks.push(own);
    for (const s of subs) {
      if (s.status === "asks") asks.push({ address: s.term.address, status: "asks", title: s.term.title, program: s.term.program, space: s.space, space_name: s.space_name, tab: s.tab, sub: true });
    }
    if (status === "turn") turn.push(own);
  }
  return [...asks, ...turn];
}

const mostUrgent = (es) => es.reduce((best, e) => (!best || rank(e.status) > rank(best.status) ? e : best), null)?.agent;
// A row's status: its most urgent agent (sub-agents as Index counts them), lifted by sub-agents that ask.
const statusOf = (es, askingSubs) => es.reduce((st, e) => higher(st, e.status), askingSubs.length ? "asks" : null);

// Stock's tab label: the agent's title for an unnamed tab, else its name.
function tabLabel(tab, lead) {
  const live = telling(lead?.title, lead?.program);
  return (tab.name === lead?.program?.name || !tab.named) && live ? live : tab.name;
}

// A row is lit only when it belongs to the waiting agent itself, so nothing
// is lit twice: a non-current space with a waiting agent of its own, a tab
// with one, an agent in a split tab, a sub-agent that asks. A lit row says
// why on the right and "<age> · <title>" below; the title is dropped when it
// says nothing or is already the row's name.
export function buildGroups({ spaces, agents, terminals, machines, changed, now }) {
  const es = entries(agents, terminals, changed);
  const need = collect(es);
  const own = (e) => !e.kept;
  const nameOf = new Map(terminals.filter((t) => t.name).map((t) => [t.address, t.name]));
  const ageOf = (address) => (changed?.[address]?.at != null ? duration(now - changed[address].at) : null);
  function detailFor(n, name) {
    const t = telling(n.title, n.program);
    const parts = [ageOf(n.address), t !== name ? t : null].filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
  }
  const line = (address, label, status, n) => ({
    address, label, status, lit: Boolean(n), right: n ? WORDS[n.status] : "", detail: n ? detailFor(n, label) : null,
  });
  const subRow = (s) => line(
    s.term.address,
    s.term.name ?? s.term.program?.name ?? s.term.address,
    s.status,
    s.status === "asks" ? { address: s.term.address, status: "asks", title: s.term.title, program: s.term.program } : null,
  );

  function tabRow(t, mine, askingSubs) {
    const tabbed = mine.filter((e) => e.agent.tab === t.id);
    const inTab = tabbed.filter(own);
    const subs = askingSubs.filter((s) => s.tab === t.id);
    const name = tabLabel(t, inTab[0]?.agent);
    const lead = inTab.length < 2 ? need.find((n) => n.tab === t.id && !n.sub) : null;
    return {
      id: t.id,
      name,
      active: t.active,
      status: statusOf(tabbed, subs),
      lit: Boolean(lead),
      right: lead ? WORDS[lead.status] : "",
      detail: lead ? detailFor(lead, name) : null,
      // A split tab lists its own agents, then any kept sub-agent that asks
      // (it has a pane, so it isn't among the unlisted subs below).
      agents: inTab.length >= 2
        ? [
          ...inTab.map(({ agent: a, status: st }) => line(a.address, a.program?.key ?? "agent", st, need.find((n) => n.address === a.address && !n.sub))),
          ...tabbed.filter((e) => e.kept && e.status === "asks").map(({ agent: a }) => line(
            a.address, nameOf.get(a.address) ?? a.program?.key ?? "agent", "asks", need.find((n) => n.address === a.address),
          )),
        ]
        : [],
      subs: subs.map(subRow),
    };
  }

  function spaceRow(s) {
    const mine = es.filter((e) => e.agent.space === s.id);
    const ownAgents = mine.filter(own);
    const askingSubs = mine.flatMap((e) => e.subs.filter((x) => x.status === "asks"));
    // The current space's tab rows carry its waiting agent.
    const lead = s.active ? null : need.find((n) => n.space === s.id && !n.sub);
    const urgent = mostUrgent(ownAgents);
    const at = urgent ? changed?.[urgent.address]?.at : undefined;
    return {
      id: s.id,
      name: s.name,
      current: s.active,
      status: statusOf(mine, askingSubs),
      lit: Boolean(lead),
      right: lead ? WORDS[lead.status] : ownAgents.length >= 2 ? `${ownAgents.length} agents` : at != null ? duration(now - at) : "",
      detail: lead ? detailFor(lead, s.name) : null,
      subs: s.active ? [] : askingSubs.map(subRow),
      tabs: s.active ? s.tabs.map((t) => tabRow(t, mine, askingSubs)) : [],
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

// Who needs you, in ⌘J order (see collect()): { address, status, title,
// program, space, space_name, tab, sub? }. "N need you" is its length.
export function waiting({ agents, terminals, changed }) {
  return collect(entries(agents, terminals, changed));
}

// Where ⌘J goes, in order.
export function targets(x) {
  return waiting(x).map((w) => w.address);
}

// The one ⌘J would go to next (what the strip names), or null when nothing
// waits or it's the one you're on. memory as for jumpFrom().
export function nextUp(all, current, memory) {
  const to = nextTarget(all.map((w) => w.address), jumpFrom(memory, current), memory?.after);
  return to && to !== current ? all.find((w) => w.address === to) : null;
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
