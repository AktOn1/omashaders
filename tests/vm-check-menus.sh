#!/usr/bin/env bash
# VM check for the left list of each menu: commands pinned in one block, a filter shows its matches directly. Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-menus.sh" "$d/vm-check.sh" && vm-test "$d"
# Done looks like: Off / Create with AI / Surprise me sit above the categories; typing a filter shows "All matches" first;
# Clear and Esc empty the field and leave the menu open.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
shot() { grim "$out/$1.png"; }
ipc() { omarchy-shell "$S" "$@"; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
fail=0
mark=$(log | wc -l)
panel_open() { [ "$(hyprctl layers 2>/dev/null | grep -c omarchy-keyboard-panel)" -gt 0 ]; }
st=$HOME/.local/state/omarchy/$S; mkdir -p "$st"
rm -f "$st/sections"
for i in $(seq 1 30); do [ -s "$st/themes" ] && break; sleep 2; done; sleep 4
ipc open; sleep 4
panel_open && ok "menu opens" || bad "menu did not open"
shot menus-1-first-view
wtype s; sleep 1.5
shot menus-2-screen-commands-pinned
wtype /; sleep 0.5; wtype blue; sleep 2
shot menus-3-filter-blue
wtype -k Escape; sleep 1.5
shot menus-4-after-esc
panel_open && ok "Esc emptied the filter and left the menu open" || bad "Esc closed the whole menu"
wtype /; sleep 0.5; wtype blue; sleep 1.5
wtype -k Escape; sleep 1
wtype -k Escape; sleep 1.5
panel_open && bad "second Esc did not close the menu" || ok "second Esc closes the menu"
errs=$(log | tail -n +$((mark + 1)) | grep -E "menulist|Core.qml|ReferenceError|TypeError|is not a type|unavailable" | head -5)
[ -z "$errs" ] && ok "no menu errors in the shell log" || bad "log: $errs"
exit $fail
