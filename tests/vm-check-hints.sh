#!/usr/bin/env bash
# VM check for the hotkey hints: key caps next to the sliders, a strip under the menus, F1 shows / hides them and the choice is remembered. Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-hints.sh" "$d/vm-check.sh" && vm-test "$d"
# Done looks like: hints on at the first start; the header keeps an F1 cap when they are off; F1 hides them and the lists get the space back; F1 shows them again; the last choice survives closing the menu and a shell reload; ? does nothing.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
st=$HOME/.local/state/omarchy/$S; mkdir -p "$st"
shot() { grim "$out/$1.png"; }
ipc() { omarchy-shell "$S" "$@"; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
fail=0
mark=$(log | wc -l)
hint() { ipc hints | awk '{print $1}'; }
strip() { ipc hints | sed -n 's/.*strip=\([0-9]*\).*/\1/p'; }
rowsnow() { ipc hints | sed -n 's/.*rows=\([0-9]*\).*/\1/p'; }
rm -f "$st/sections" "$st/hotkey-hints"
for i in $(seq 1 45); do [ "$(wc -l < "$st/themes" 2>/dev/null || echo 0)" -ge 100 ] && break; sleep 2; done; sleep 6
ipc open; sleep 4
echo "first view: $(ipc hints)"
[ "$(hint)" = "on" ] && ok "hints are on at the first start" || bad "hints not on at the first start: $(ipc hints)"
[ "$(strip)" -gt 20 ] && ok "the strip under the menus has height ($(strip) px)" || bad "no strip height"
rows_on=$(rowsnow)
shot hints-1-on-themes
sleep 1; wtype w; sleep 3
shot hints-2-on-wallpaper-sliders
wtype C; sleep 1.5
shot hints-3-on-color-sliders
wtype -k F1; sleep 1.5
[ "$(hint)" = "off" ] && ok "F1 hides the hints" || bad "F1 did not hide: $(ipc hints)"
[ "$(cat "$st/hotkey-hints" 2>/dev/null)" = "off" ] && ok "state file says off" || bad "state file is '$(cat "$st/hotkey-hints" 2>/dev/null)'"
[ "$(strip)" = "0" ] && ok "the strip is gone" || bad "strip still there"
shot hints-4-off-color
wtype w; sleep 1.5
shot hints-5-off-wallpaper
rows_off=$(rowsnow)
[ "$rows_off" -ge "$rows_on" ] && ok "the lists got the space back (rows $rows_on -> $rows_off)" || bad "rows did not grow ($rows_on -> $rows_off)"
wtype -k F1; sleep 1.5
[ "$(hint)" = "on" ] && ok "F1 shows them again" || bad "second F1 did not show: $(ipc hints)"
[ "$(cat "$st/hotkey-hints" 2>/dev/null)" = "on" ] && ok "state file says on" || bad "state file is '$(cat "$st/hotkey-hints" 2>/dev/null)'"
wtype '?'; sleep 1
[ "$(hint)" = "on" ] && [ "$(strip)" -gt 20 ] && ok "? changes nothing" || bad "? changed the hints: $(ipc hints)"
# F1 also works while the filter field has the keyboard
wtype /; sleep 0.5; wtype -k F1; sleep 1.5
[ "$(hint)" = "off" ] && ok "F1 works inside the filter field" || bad "F1 did nothing in the filter field: $(ipc hints)"
wtype -k Escape; sleep 1
# remembered: close and reopen, then a shell reload
ipc close; sleep 1.5; ipc open; sleep 3
[ "$(hint)" = "off" ] && ok "off survives closing and reopening" || bad "state lost on reopen: $(ipc hints)"
shot hints-6-reopened-off
omarchy-shell "$S-host" reload >/dev/null 2>&1; sleep 8
main=$(pgrep -o -x quickshell); for p in $(pgrep -x quickshell); do [ "$p" != "$main" ] && kill "$p" 2>/dev/null; done; sleep 1
ipc open; sleep 4
[ "$(hint)" = "off" ] && ok "off survives a shell reload" || bad "state lost on reload: $(ipc hints)"
wtype -k F1; sleep 1.5
ipc close; sleep 1.5; ipc open; sleep 3
[ "$(hint)" = "on" ] && ok "on survives closing and reopening" || bad "on lost on reopen: $(ipc hints)"
shot hints-7-reopened-on
# a small screen: the menu must still fit with the hints on (short strip) and off
mon=$(hyprctl -j monitors | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["name"])')
fits() { # name
  local info need room; info=$(ipc hints); need=$(echo "$info" | sed -n 's/.*need=\([0-9]*\).*/\1/p'); room=$(echo "$info" | sed -n 's/.*room=\([0-9]*\).*/\1/p')
  echo "$1: $info"
  [ -n "$need" ] && [ -n "$room" ] && [ "$need" -le "$room" ] && ok "$1: the menu fits ($need of $room px)" || bad "$1: the menu does not fit ($need of $room px)"
}
for mode in 1024x768 800x600; do
  h=${mode#*x}
  ipc close; sleep 1
  hyprctl eval "hl.monitor({output=\"$mon\", mode=\"$mode@60\", position=\"0x0\", scale=1})" >/dev/null 2>&1; sleep 3
  echo "monitor now: $(hyprctl -j monitors | python3 -c 'import json,sys; m=json.load(sys.stdin)[0]; print(m["width"], m["height"])')"
  echo on > "$st/hotkey-hints"; sleep 1.5
  ipc open; sleep 4
  [ "$(hint)" = "on" ] || { wtype -k F1; sleep 1.5; }
  shot hints-8-small-${mode}-on
  fits "small ${mode} hints on"
  wtype -k F1; sleep 1.5
  shot hints-9-small-${mode}-off
  fits "small ${mode} hints off"
  # the header F1 cap stays while the hints are off, and the second row follows the focused menu
  [ "$(ipc hints | sed -n 's/.*f1cap=\([a-z]*\).*/\1/p')" = "true" ] && ok "small ${mode}: F1 cap stays in the header with hints off" || bad "small ${mode}: F1 cap gone: $(ipc hints)"
  wtype -k F1; sleep 1.5
  echo "small ${mode} themes focus: $(ipc hints)"
  wtype s; sleep 1.5
  shot hints-10-small-${mode}-screen-on
  fits "small ${mode} screen focus hints on"
  echo "small ${mode} screen focus: $(ipc hints)"
  wtype -k F1; sleep 1.5
  shot hints-11-small-${mode}-screen-off
  fits "small ${mode} screen focus hints off"
  wtype -k F1; sleep 1
  wtype s; sleep 1
done
ipc close; sleep 1
hyprctl eval "hl.monitor({output=\"$mon\", mode=\"1280x800@60\", position=\"0x0\", scale=1})" >/dev/null 2>&1; sleep 3
errs=$(log | tail -n +$((mark + 1)) | grep -E "Core.qml|ReferenceError|TypeError|is not a type|unavailable|binding loop" | head -5)
[ -z "$errs" ] && ok "no menu errors in the shell log" || bad "log: $errs"
ipc close 2>/dev/null
exit $fail
