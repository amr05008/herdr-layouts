#!/usr/bin/env python3
"""Merge a layout's keys.json into the person's Herdr keys.json, never clobbering.

usage: merge_keys.py <layout keys.json> <your keys.json>

Adds each binding that's free. A key you already use asks first (no answer,
or no terminal to ask in, means no). A key in your "terminal" section is
skipped: that section wins inside terminals, so the layout's binding could
never fire. Before writing, your file is copied to keys.json.bak-<time>.
"""
import copy
import json
import os
import shutil
import sys
import time


def merge(ours, theirs, ask):
    """Returns (merged copy of theirs, messages). Pure: `ask(question) -> bool`."""
    out = copy.deepcopy(theirs)
    msgs = []
    for section, binds in ours.items():
        for key, action in binds.items():
            mine = out.get(section, {})
            if mine.get(key) == action:
                continue
            terminal = out.get("terminal", {})
            if section != "terminal" and key in terminal:
                msgs.append(f"Skipped {key}: your terminal section binds it to {terminal[key]}, which wins inside terminals.")
                continue
            where = current = None
            if key in mine:
                where, current = section, mine[key]
            elif section != "global" and key in out.get("global", {}):
                where, current = "global", out["global"][key]
            if where and not ask(f"{key} is {current} in {where}. Use it for {action} while this layout shows?"):
                msgs.append(f"Kept your {key} ({current} in {where}); {action} has no key. Bind one under \"{section}\" in keys.json.")
                continue
            out.setdefault(section, {})[key] = action
    return out, msgs


def main(argv):
    if len(argv) != 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    path = os.path.realpath(argv[2])  # a dotfile manager may link keys.json elsewhere: update the real file
    with open(argv[1], encoding="utf-8") as f:
        ours = json.load(f)
    try:
        with open(path, encoding="utf-8") as f:
            theirs = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Your keys.json isn't valid JSON ({e}); fix it, then re-run.", file=sys.stderr)
        return 1

    interactive = sys.stdin.isatty()

    def ask(question):
        return interactive and input(f"{question} [y/N] ").strip().lower() in ("y", "yes")

    out, msgs = merge(ours, theirs, ask)
    for m in msgs:
        print(m)
    if out == theirs:
        print("Keys: nothing to change.")
        return 0
    backup = f"{path}.bak-{int(time.time())}"
    shutil.copy2(path, backup)
    with open(path + ".tmp", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(path + ".tmp", path)
    print(f"Keys: added the layout's keys. Your previous file is {backup}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
