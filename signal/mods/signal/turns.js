// The one record of agent stamps and turns, kept in Herdr's shared store so
// every copy of Index (sidebar, strip) reads the same one: localStorage is per
// copy, and the strip has to dismiss what the sidebar shows. Setting it
// redraws every mod, so it's set only when something changed (no loop).

import { shared, setShared, agents } from "herdr";
import { track, dismiss, asRecord, mergeLegacy } from "./model.js";

export const KEY = "index.turns";

const current = () => asRecord(JSON.parse(JSON.stringify(shared(KEY) ?? {})));

// The record, brought up to date with what the agents are doing now.
export function observe(list = agents(), now = Date.now()) {
  const changed = current();
  if (track(changed, list, now)) setShared(KEY, changed);
  return changed;
}

// ⇧⌘J: end this agent's turn. Returns whether there was one.
export function dismissAgent(address) {
  const changed = current();
  if (!dismiss(changed, address)) return false;
  setShared(KEY, changed);
  return true;
}

// One-time move from the sidebar's old per-copy stamps. Merges, so it works
// even when the strip has already started the shared record (sidebar hidden
// at startup), and never replaces a stamp with real history.
export function adopt(legacy) {
  const { record, changed } = mergeLegacy(current(), legacy);
  if (changed) setShared(KEY, record);
}
