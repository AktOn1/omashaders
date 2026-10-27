#!/usr/bin/env bash
# VM check for F3 (show / hide the "What is using my GPU" block). Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-resources.sh" "$d/vm-check.sh" && vm-test "$d"
# Done looks like: the block is shown at the first start; the F3 cap is in the header (always, dimmed when hidden); F3 hides it and the lists get the space back (more rows);
# the GPU poll stops while it is hidden; F3 shows it again; the choice sits in the state file `resources` and survives closing the menu and a shell reload; F3 also works inside the filter field.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
st=$HOME/.local/state/omarchy/$S; mkdir -p "$st"
rf=$st/resources
shot() { grim "$out/$1.png"; }
ipc() { omarchy-shell "$S" "$@"; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
fail=0
mark=$(log | wc -l)
field() { echo "$1" | tr ' ' '\n' | sed -n "s/^$2=//p" | head -1; }
res() { ipc resources | tail -1; }
hints() { ipc hints | tail -1; }
for i in $(seq 1 45); do [ "$(wc -l < "$st/themes" 2>/dev/null || echo 0)" -ge 100 ] && break; sleep 2; done; sleep 6
rm -f "$st/sections" "$rf"
ipc open; sleep 4
r=$(res); echo "first view: $r"
[ "$(field "$r" shown)" = "true" ] && ok "the block is shown at the first start" || bad "block not shown at the first start: $r"
[ "$(field "$r" cap)" = "true" ] && ok "the F3 cap is in the header" || bad "no F3 cap in the header: $r"
[ "$(field "$r" poll)" = "true" ] && ok "the GPU poll runs while the block is shown" || bad "poll not running: $r"
[ "$(field "$r" height)" -gt 20 ] && ok "the block has height ($(field "$r" height) px)" || bad "block has no height: $r"
rows_on=$(field "$(hints)" rows)
shot resources-1-shown
wtype -k F3; sleep 1.5
r=$(res); echo "after F3: $r"
[ "$(field "$r" shown)" = "false" ] && ok "F3 hides the block" || bad "F3 did not hide it: $r"
[ "$(field "$r" height)" = "0" ] && ok "the block takes no height" || bad "hidden block still has height: $r"
[ "$(field "$r" cap)" = "true" ] && ok "the cap stays (dimmed)" || bad "cap vanished: $r"
[ "$(field "$r" poll)" = "false" ] && ok "the GPU poll stopped" || bad "poll still running while hidden: $r"
[ "$(cat "$rf" 2>/dev/null)" = "off" ] && ok "state file says off" || bad "state file is '$(cat "$rf" 2>/dev/null)'"
rows_off=$(field "$(hints)" rows)
[ "$rows_off" -gt "$rows_on" ] && ok "the lists got the space back (rows $rows_on -> $rows_off)" || bad "rows did not grow ($rows_on -> $rows_off)"
shot resources-2-hidden
wtype -k F3; sleep 1.5
r=$(res)
[ "$(field "$r" shown)" = "true" ] && ok "F3 shows it again" || bad "second F3 did not show it: $r"
[ "$(cat "$rf" 2>/dev/null)" = "on" ] && ok "state file says on" || bad "state file is '$(cat "$rf" 2>/dev/null)'"
[ "$(field "$(hints)" rows)" = "$rows_on" ] && ok "rows are back to $rows_on" || bad "rows are $(field "$(hints)" rows), not $rows_on"
# F3 inside the filter field
wtype /; sleep 0.5; wtype -k F3; sleep 1.5
[ "$(field "$(res)" shown)" = "false" ] && ok "F3 works inside the filter field" || bad "F3 did nothing in the filter field"
wtype -k Escape; sleep 1
# remembered: close and reopen, then a shell reload
ipc close; sleep 1.5; ipc open; sleep 3
[ "$(field "$(res)" shown)" = "false" ] && ok "off survives closing and reopening" || bad "state lost on reopen: $(res)"
shot resources-3-reopened-hidden
omarchy-shell "$S-host" reload >/dev/null 2>&1; sleep 8
main=$(pgrep -o -x quickshell); for p in $(pgrep -x quickshell); do [ "$p" != "$main" ] && kill "$p" 2>/dev/null; done; sleep 1
ipc open; sleep 4
[ "$(field "$(res)" shown)" = "false" ] && ok "off survives a shell reload" || bad "state lost on reload: $(res)"
wtype -k F3; sleep 1.5
ipc close; sleep 1.5; ipc open; sleep 3
[ "$(field "$(res)" shown)" = "true" ] && ok "on survives closing and reopening" || bad "on lost on reopen: $(res)"
# F1 and F2 still work beside it
wtype -k F1; sleep 1.2; [ "$(hints | awk '{print $1}')" = "off" ] && ok "F1 still toggles the hints" || bad "F1 broken"
wtype -k F1; sleep 1.2
errs=$(log | tail -n +$((mark + 1)) | grep -E "Core.qml|ReferenceError|TypeError|is not a type|unavailable" | head -5)
[ -z "$errs" ] && ok "no menu errors in the shell log" || bad "log: $errs"
ipc close 2>/dev/null
exit $fail
