#!/usr/bin/env bash
# Installs one of this repo's Herdr layouts into your Herdr home.
#   ./install.sh            list the layouts
#   ./install.sh <layout>   install (or update) one
# Writes only files named after the layout, merges its keys into yours
# (asking before taking a key you use), and checks its mods.
set -euo pipefail
REPO="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"

layouts() {
  for d in "$REPO"/*/; do
    n="$(basename "$d")"
    [ -f "$d/layouts/$n.json" ] && echo "$n"
  done
  return 0
}

if [ $# -eq 0 ]; then
  layouts
  echo "Install one: ./install.sh <layout>" >&2
  exit 0
fi

name="$1"
SRC="$REPO/$name"
if [ ! -f "$SRC/layouts/$name.json" ]; then
  echo "No layout named '$name'. Layouts: $(layouts | tr '\n' ' ')" >&2
  exit 2
fi
if [ ! -d "$HOME_DIR" ]; then
  echo "No Herdr home at $HOME_DIR. Open Herdr once first, then re-run." >&2
  exit 1
fi

# The layout may only bring files named after itself.
for kind in layouts mods themes; do
  [ -d "$SRC/$kind" ] || continue
  for f in "$SRC/$kind"/*; do
    [ -e "$f" ] || continue
    b="$(basename "$f")"
    case "$b" in
      "$name"*) ;;
      *) echo "Refusing to install: $name/$kind/$b isn't named $name*." >&2; exit 1 ;;
    esac
  done
done

mkdir -p "$HOME_DIR/layouts" "$HOME_DIR/mods"
cp "$SRC/layouts"/* "$HOME_DIR/layouts/"
if [ -d "$SRC/themes" ]; then
  mkdir -p "$HOME_DIR/themes"
  cp "$SRC/themes"/* "$HOME_DIR/themes/"
fi
for d in "$SRC/mods"/*/; do
  b="$(basename "$d")"
  rm -rf "${HOME_DIR:?}/mods/$b"
  cp -R "$SRC/mods/$b" "$HOME_DIR/mods/$b"
done
echo "Installed $name into $HOME_DIR."

if [ -f "$SRC/keys.json" ]; then
  if [ ! -f "$HOME_DIR/keys.json" ]; then
    echo "Keys not added: Open Herdr once so it writes keys.json, then re-run."
  elif python3 -c pass >/dev/null 2>&1; then
    python3 "$REPO/tools/merge_keys.py" "$SRC/keys.json" "$HOME_DIR/keys.json"
  else
    echo "Python 3 isn't available, so add these to $HOME_DIR/keys.json yourself:"
    cat "$SRC/keys.json"
  fi
fi

if command -v herdr-app >/dev/null 2>&1; then
  for d in "$SRC/mods"/*/; do
    herdr-app check "$HOME_DIR/mods/$(basename "$d")" || { echo "Mod check failed; see above." >&2; exit 1; }
  done
else
  echo "herdr-app isn't on PATH, so the mods weren't checked."
fi

echo
echo "Switch to it:  herdr-app do layout.switch '{\"name\":\"$name\"}'"
echo "Back to stock: herdr-app do layout.switch '{\"name\":\"main\"}'"
