#!/usr/bin/env bash
# VM check: with menuLayout set to Classic the older menu runs (Screen, Color, Wallpaper, Cursor, Windows and Combos columns, the saved list in `themes`). Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-classic.sh" "$d/vm-check.sh" && vm-test "$d"
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
state=$HOME/.local/state/omarchy/$S
fail=0
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
status() { omarchy-shell $S-host status 2>&1; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
wait_for() { local t=$1; while [ "$t" -gt 0 ]; do eval "$2" >/dev/null 2>&1 && return 0; sleep 1; t=$((t - 1)); done; return 1; }

cfg=$HOME/.config/omarchy/shell.json
jq '(.. | objects | select(.id? == "io.github.akton1.omashaders")) += {menuLayout: "Classic"}' "$cfg" >"$cfg.tmp" && mv "$cfg.tmp" "$cfg"
wait_for 60 "status | grep -q 'layout=classic' && status | grep -q 'running=yes'" && ok "layout is Classic ($(status))" || bad "layout did not become Classic: $(status)"
wait_for 20 "[ -s '$state/themes' ]" && ok "the saved list (themes) holds the starter combos" || bad "no themes file with starter combos"
omarchy-shell $S-host reload; sleep 5 # a first start cannot watch a state file that did not exist yet
mark=$(log | wc -l)
omarchy-shell $S sections all; omarchy-shell $S open; sleep 3; grim "$out/classic-0-menu.png"
wtype -k Escape; sleep 1; omarchy-shell $S close; sleep 1
log | tail -n +$((mark + 1)) | grep -iE "TypeError|ReferenceError|is not a type|CoreClassic.qml.*(error|failed)|Cannot assign|Unable to assign" | head -5 | grep . && bad "QML errors in the log (above)" || ok "menu opened, no QML errors in the log"
first=$(head -1 "$state/themes" | cut -d'|' -f1)
omarchy-shell $S combo 1; sleep 3
[ "$(cat "$state/current" 2>/dev/null)" = "$first" ] && ok "combo 1 from themes applies its screen effect ($first)" || bad "combo 1 did not set the screen effect (want $first, current=$(cat "$state/current" 2>/dev/null))"
omarchy-shell $S set off
exit $fail
