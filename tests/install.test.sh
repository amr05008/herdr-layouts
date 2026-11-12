#!/usr/bin/env bash
# install.sh tests: every case installs into a throwaway Herdr home, never the real one.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fail() { echo "FAIL $1: $2"; exit 1; }
ok() { echo "ok $1"; }

# A home shaped like Herdr's after its first start, plus things that aren't ours.
seed() {
  mkdir -p "$1/layouts" "$1/mods/other"
  cp "$REPO/tests/fixtures/keys.json" "$1/keys.json"
  echo '{"id":"root","type":"row","children":[]}' > "$1/layouts/main.json"
  echo 'export default 1;' > "$1/mods/other/main.js"
}
run() { # run <home> <args...>  → sets rc, output in $TMP/out
  local h="$1"; shift
  set +e; HERDR_APP_HOME="$h" "$@" </dev/null >"$TMP/out" 2>&1; rc=$?; set -e
}

# install_lists
run "$TMP/none" "$REPO/install.sh"
[ "$rc" -eq 0 ] && grep -q '^index$' "$TMP/out" || fail install_lists "rc=$rc $(cat "$TMP/out")"
ok install_lists

# install_unknown
run "$TMP/none" "$REPO/install.sh" nope
[ "$rc" -eq 2 ] || fail install_unknown "rc=$rc"
ok install_unknown

# install_fresh
H="$TMP/fresh"; seed "$H"; cp -R "$H" "$TMP/fresh.before"
run "$H" "$REPO/install.sh" index
[ "$rc" -eq 0 ] || fail install_fresh "rc=$rc $(cat "$TMP/out")"
for f in layouts/index.json mods/index/main.js mods/index/model.js themes/index-dark.json themes/index-light.json; do
  [ -f "$H/$f" ] || fail install_fresh "missing $f"
done
python3 -c 'import json,sys; k=json.load(open(sys.argv[1])); assert k["layout:index"]["cmd-j"]=="index.next-needs-you"; assert k["global"]["cmd-t"]=="tab.new"' "$H/keys.json" \
  || fail install_fresh "keys not merged"
cmp -s "$H/layouts/main.json" "$TMP/fresh.before/layouts/main.json" || fail install_fresh "touched layouts/main.json"
cmp -s "$H/mods/other/main.js" "$TMP/fresh.before/mods/other/main.js" || fail install_fresh "touched mods/other"
ok install_fresh

# install_rerun
cp "$H/keys.json" "$TMP/keys.before"; baks=$(ls "$H" | grep -c '^keys.json.bak-' || true)
run "$H" "$REPO/install.sh" index
[ "$rc" -eq 0 ] || fail install_rerun "rc=$rc"
cmp -s "$H/keys.json" "$TMP/keys.before" || fail install_rerun "keys.json changed"
[ "$(ls "$H" | grep -c '^keys.json.bak-' || true)" -eq "$baks" ] || fail install_rerun "new backup made"
ok install_rerun

# install_no_home
run "$TMP/missing" "$REPO/install.sh" index
[ "$rc" -eq 1 ] || fail install_no_home "rc=$rc"
ok install_no_home

# install_no_keys
H="$TMP/nokeys"; seed "$H"; rm "$H/keys.json"
run "$H" "$REPO/install.sh" index
[ "$rc" -eq 0 ] && grep -q "Open Herdr once" "$TMP/out" && [ -f "$H/layouts/index.json" ] && [ ! -e "$H/keys.json" ] \
  || fail install_no_keys "rc=$rc $(cat "$TMP/out")"
ok install_no_keys

# install_refuses_foreign
R="$TMP/repo"; mkdir -p "$R"
cp -R "$REPO/install.sh" "$REPO/tools" "$REPO/index" "$R/"
mkdir -p "$R/index/mods/other"; echo 'export default 1;' > "$R/index/mods/other/main.js"
H="$TMP/foreign"; seed "$H"; cp -R "$H" "$TMP/foreign.before"
run "$H" "$R/install.sh" index
[ "$rc" -eq 1 ] || fail install_refuses_foreign "rc=$rc"
diff -r "$H" "$TMP/foreign.before" >/dev/null || fail install_refuses_foreign "home changed"
ok install_refuses_foreign

# install_keeps_symlinked_keys (dotfile managers link keys.json elsewhere)
H="$TMP/linked"; seed "$H"; mkdir -p "$TMP/dotfiles"; mv "$H/keys.json" "$TMP/dotfiles/keys.json"; ln -s "$TMP/dotfiles/keys.json" "$H/keys.json"
run "$H" "$REPO/install.sh" index
[ "$rc" -eq 0 ] && [ -L "$H/keys.json" ] || fail install_keeps_symlinked_keys "rc=$rc, link replaced"
python3 -c 'import json,sys; assert "layout:index" in json.load(open(sys.argv[1]))' "$TMP/dotfiles/keys.json" || fail install_keeps_symlinked_keys "target not updated"
ok install_keeps_symlinked_keys
