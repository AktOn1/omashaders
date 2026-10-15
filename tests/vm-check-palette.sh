#!/usr/bin/env bash
# VM check: the Palette editor opens in both menus, a palette colour is applied and stays on, no QML errors. Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-palette.sh" "$d/vm-check.sh" && vm-test "$d"
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
state=$HOME/.local/state/omarchy/$S
fail=0
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
ipc() { omarchy-shell $S "$@"; }
status() { omarchy-shell $S-host status 2>&1; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
wait_for() { local t=$1; while [ "$t" -gt 0 ]; do eval "$2" >/dev/null 2>&1 && return 0; sleep 1; t=$((t - 1)); done; return 1; }
panel_open() { [ "$(hyprctl layers 2>/dev/null | grep -c omarchy-keyboard-panel)" -gt 0 ]; }
PAL=pal-300c2177080ff8fc4fffff5fa0080808080808000808080000

cfg=$HOME/.config/omarchy/shell.json
for layout in New Classic; do
  want=$(echo $layout | tr A-Z a-z)
  jq --arg v "$layout" '(.. | objects | select(.id? == "io.github.akton1.omashaders")) += {menuLayout: $v}' "$cfg" >"$cfg.tmp" && mv "$cfg.tmp" "$cfg"
  wait_for 60 "status | grep -q 'layout=$want' && status | grep -q 'running=yes'" && ok "layout is $layout" || bad "layout did not become $layout: $(status)"
  omarchy-shell $S-host reload; sleep 5
  mark=$(log | wc -l)
  ipc setColor "$PAL"; sleep 3
  [ "$(cat "$state/color" 2>/dev/null)" = "$PAL" ] && ok "$layout: a palette colour is set" || bad "$layout: colour file holds '$(cat "$state/color" 2>/dev/null)'"
  ipc palette; sleep 3
  panel_open && ok "$layout: the Palette editor opens" || bad "$layout: no panel after 'palette'"
  grim "$out/palette-$want-1-open.png"
  wtype -s 200 f; sleep 2
  grep -qx "$PAL" "$state/color-favorites" 2>/dev/null && ok "$layout: f marks the palette as favourite" || bad "$layout: favourite file: $(cat "$state/color-favorites" 2>/dev/null)"
  wtype -s 200 f; sleep 1
  wtype -k Escape; sleep 2
  panel_open && bad "$layout: Esc did not close the editor" || ok "$layout: Esc closes the editor"
  log | tail -n +$((mark + 1)) | grep -iE "TypeError|ReferenceError|is not a type|PaletteDialog.qml.*(error|failed)|Cannot assign|Unable to assign|palette.js" | head -5 | grep . && bad "$layout: QML errors in the log (above)" || ok "$layout: no QML errors in the log"
  ipc setColor off
done
exit $fail
