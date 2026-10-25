#!/usr/bin/env bash
# VM check for the key caps on buttons and the single bracket pair on Strength. Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-hint-buttons.sh" "$d/vm-check.sh" && vm-test "$d"
# Done looks like: [ ] change Strength by 5, Shift+[ / Shift+] by 1, { } still work; the Strength slider shows only [ ] and d; with hints on the tabs, Pause, Fullscreen, What's new and the theme buttons carry key caps, F1 hides them all; the menu still fits on 1024x768 and 800x600.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
st=$HOME/.local/state/omarchy/$S; mkdir -p "$st"
shot() { grim "$out/$1.png"; }
ipc() { omarchy-shell "$S" "$@"; }
cli() { "$HOME/.config/omarchy/plugins/$S/bin/omashaders" "$@"; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
fail=0
mark=$(log | wc -l)
hint() { ipc hints | awk '{print $1}'; }
sval() { cat "$st/strength-effect" 2>/dev/null; }
expect() { # label want
  sleep 0.8
  [ "$(sval)" = "$2" ] && ok "$1 (strength $2)" || bad "$1: strength is '$(sval)', wanted $2"
}
rm -f "$st/sections" "$st/hotkey-hints"
for i in $(seq 1 45); do [ "$(wc -l < "$st/themes" 2>/dev/null || echo 0)" -ge 100 ] && break; sleep 2; done; sleep 6
# a clean desktop first (nothing on), so the small screens are measured like the hint test does
ipc open; sleep 4
echo "view: $(ipc hints)"
[ "$(hint)" = "on" ] && ok "hints are on at the first start" || bad "hints not on: $(ipc hints)"
shot buttons-1-on-first-view
ipc close; sleep 1.5
mon=$(hyprctl -j monitors | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["name"])')
fits() { # name
  local info need room; info=$(ipc hints); need=$(echo "$info" | sed -n 's/.*need=\([0-9]*\).*/\1/p'); room=$(echo "$info" | sed -n 's/.*room=\([0-9]*\).*/\1/p')
  echo "$1: $info"
  [ -n "$need" ] && [ -n "$room" ] && [ "$need" -le "$room" ] && ok "$1: the menu fits ($need of $room px)" || bad "$1: the menu does not fit ($need of $room px)"
}
for mode in 1024x768 800x600; do
  ipc close; sleep 1
  hyprctl eval "hl.monitor({output=\"$mon\", mode=\"$mode@60\", position=\"0x0\", scale=1})" >/dev/null 2>&1; sleep 3
  echo on > "$st/hotkey-hints"; sleep 1.5
  ipc open; sleep 4
  [ "$(hint)" = "on" ] || { wtype -k F1; sleep 1.5; }
  shot buttons-6-small-${mode}-on
  fits "small ${mode} hints on"
  wtype -k F1; sleep 1.5
  shot buttons-7-small-${mode}-off
  fits "small ${mode} hints off"
  wtype -k F1; sleep 1
done
ipc close; sleep 1
hyprctl eval "hl.monitor({output=\"$mon\", mode=\"1280x800@60\", position=\"0x0\", scale=1})" >/dev/null 2>&1; sleep 3
# a mild effect (sharpen) so the Strength slider is live and the shots stay readable
ipc set sharpen; sleep 2
cli strength effect 50 >/dev/null 2>&1; sleep 1.5
ipc open; sleep 4
wtype s; sleep 2
shot buttons-2-on-screen-strength
[ "$(sval)" = "50" ] || bad "strength did not start at 50 (is '$(sval)')"
wtype ']'; expect "] adds 5" 55
wtype '['; expect "[ takes 5" 50
wtype -M shift ']' -m shift; expect "Shift+] adds 1" 51
wtype -M shift '[' -m shift; expect "Shift+[ takes 1" 50
wtype '}'; expect "} still adds 1" 51
wtype '{'; expect "{ still takes 1" 50
wtype d; sleep 1
[ "$(sval)" != "50" ] && ok "d goes back to the start value ($(sval))" || bad "d did nothing"
wtype -k F1; sleep 1.5
[ "$(hint)" = "off" ] && ok "F1 hides the hints" || bad "F1 did not hide: $(ipc hints)"
shot buttons-5-off-screen-strength
wtype -k F1; sleep 1.5
ipc close; sleep 1
# a changed look makes the Save / Revert buttons appear
ipc theme 1; sleep 3
ipc set off; sleep 1; ipc setColor off; sleep 2
ipc open; sleep 4
shot buttons-3-on-changed-look
wtype -k F1; sleep 1.5
shot buttons-4-off-changed-look
wtype -k F1; sleep 1.5
ipc close; sleep 1
hyprctl eval "hl.monitor({output=\"$mon\", mode=\"1280x800@60\", position=\"0x0\", scale=1})" >/dev/null 2>&1; sleep 3
errs=$(log | tail -n +$((mark + 1)) | grep -E "Core.qml|ReferenceError|TypeError|is not a type|unavailable|binding loop" | head -5)
[ -z "$errs" ] && ok "no menu errors in the shell log" || bad "log: $errs"
ipc close 2>/dev/null
exit $fail
