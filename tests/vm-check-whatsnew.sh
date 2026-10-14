#!/usr/bin/env bash
# VM check for the What's new icon in the menu's top right corner. Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-whatsnew.sh" "$d/vm-check.sh" && vm-test "$d"
# Done looks like: the header shows no "What's new" text button, only an icon at the right end; clicking it or pressing U opens
# a list of the README entries; Esc closes the list first and the menu second.
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
for i in $(seq 1 30); do [ -s "$st/themes" ] && break; sleep 2; done; sleep 4
ipc open; sleep 4
panel_open && ok "menu opens" || bad "menu did not open"
shot wn-1-icon-only
wtype U; sleep 1.5
shot wn-2-flyout-after-U
wtype -k Escape; sleep 1
shot wn-3-after-first-esc
panel_open && ok "first Esc closed only the list, the menu stays" || bad "first Esc closed the whole menu"
wtype -k Escape; sleep 1
panel_open && bad "second Esc did not close the menu" || ok "second Esc closes the menu"
errs=$(log | tail -n +$((mark + 1)) | grep -iE "WhatsNew|update-check|ReferenceError|TypeError" | head -5)
[ -z "$errs" ] && ok "no What's new errors in the shell log" || bad "log: $errs"
exit $fail
