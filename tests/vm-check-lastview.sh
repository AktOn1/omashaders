#!/usr/bin/env bash
# VM check for "the menu remembers the last open picker". Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-lastview.sh" "$d/vm-check.sh" && vm-test "$d"
# Done looks like: open Create with AI (or the Wallhaven picker or the Palette editor), close the menu (bar icon / click away), open it again: you are back in that picker.
# Leave it with Esc and the next open is the main menu. The choice sits in the state file `last-view`, so it survives a shell reload. A junk value there opens the main menu.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
st=$HOME/.local/state/omarchy/$S; mkdir -p "$st"
lv=$st/last-view
shot() { grim "$out/$1.png"; }
ipc() { omarchy-shell "$S" "$@"; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
fail=0
mark=$(log | wc -l)
field() { echo "$1" | tr ' ' '\n' | sed -n "s/^$2=//p" | head -1; }
view() { ipc view | tail -1; }
# Esc in the AI dialog first leaves the typing field, the next Esc closes: press until the picker is gone (at most 3)
esc_out() { local i; for i in 1 2 3; do wtype -k Escape; sleep 1.5; [ "$(field "$(view)" dlg)$(field "$(view)" wh)$(field "$(view)" pal)" = "falsefalsefalse" ] && return 0; done; }
# NAME FIELD WANT: poll the view line for up to 8 s
want() { local n=$1 f=$2 w=$3 i v; for i in $(seq 1 16); do v=$(view); [ "$(field "$v" "$f")" = "$w" ] && { ok "$n ($f=$w)"; return 0; }; sleep 0.5; done; bad "$n: wanted $f=$w, got: $v"; return 1; }
for i in $(seq 1 45); do [ "$(wc -l < "$st/themes" 2>/dev/null || echo 0)" -ge 100 ] && break; sleep 2; done; sleep 6
echo > "$lv"; omarchy-shell "$S-host" reload >/dev/null 2>&1; sleep 10

# 1. Create with AI: close the menu with the bar icon (toggle), open again -> back in the AI picker
ipc open; sleep 3; want "the main menu opens" menu true
ipc aiTheme; sleep 3; want "Create with AI opens" dlg true; want "it is the AI dialog" mode ai
[ "$(cat "$lv" 2>/dev/null)" != "" ] && ok "state file written: $(cat "$lv")" || bad "state file last-view is empty while the AI dialog is open"
shot lastview-1-ai-open
ipc toggle; sleep 2; want "the bar icon closes the picker" dlg false
[ "$(cat "$lv" 2>/dev/null)" != "" ] && ok "closing with the icon keeps the memory" || bad "closing with the icon cleared the memory"
ipc toggle; sleep 3
want "next open returns to the AI picker" dlg true; want "it is the AI dialog again" mode ai; want "the main menu is not shown" menu false
shot lastview-2-ai-back
# 2. Esc leaves for good: next open is the main menu
esc_out; want "Esc closes the picker" dlg false
[ -z "$(tr -d '[:space:]' < "$lv" 2>/dev/null)" ] && ok "Esc cleared the memory" || bad "Esc left '$(cat "$lv")' in last-view"
ipc open; sleep 3
want "after Esc the next open is the main menu" menu true; want "no picker is open" dlg false
shot lastview-3-main-after-esc
ipc close; sleep 1.5

# 3. Wallhaven browser: same, closing with ipc close (what a click outside does)
ipc wallhaven; sleep 3; want "Wallhaven opens" wh true
ipc close; sleep 2; want "close hides the browser" wh false
ipc open; sleep 3; want "next open returns to Wallhaven" wh true; want "main menu not shown" menu false
shot lastview-4-wallhaven-back
wtype -k Escape; sleep 2; want "Esc closes Wallhaven" wh false
ipc open; sleep 3; want "after Esc the next open is the main menu (Wallhaven)" menu true
ipc close; sleep 1.5

# 4. Palette editor
ipc palette; sleep 3; want "Palette opens" pal true
ipc toggle; sleep 2; want "icon closes the palette" pal false
ipc toggle; sleep 3; want "next open returns to the palette" pal true
wtype -k Escape; sleep 2; want "Esc closes the palette" pal false
ipc open; sleep 3; want "after Esc the next open is the main menu (Palette)" menu true
ipc close; sleep 1.5

# 5. survives a shell reload
ipc aiTheme; sleep 3; want "AI opens before the reload" dlg true
ipc close; sleep 1.5
omarchy-shell "$S-host" reload >/dev/null 2>&1; sleep 10
main=$(pgrep -o -x quickshell); for p in $(pgrep -x quickshell); do [ "$p" != "$main" ] && kill "$p" 2>/dev/null; done; sleep 1
ipc open; sleep 4; want "after a shell reload the open returns to the AI picker" dlg true
esc_out

# 6. a junk value opens the main menu and is cleared; a Save dialog is never remembered
echo "nonsense|x" > "$lv"; sleep 1.5
ipc open; sleep 3; want "junk value: the main menu opens" menu true; want "junk value: no picker" dlg false
ipc close; sleep 1.5
[ -z "$(tr -d '[:space:]' < "$lv" 2>/dev/null)" ] && ok "junk value was cleared" || bad "junk value still in last-view: $(cat "$lv")"
# 7. leaving through a different picker: Wallhaven -> theme from picture keeps the newest one only
ipc wallhaven; sleep 3; ipc aiTheme; sleep 3
want "AI replaced Wallhaven" wh false
case "$(cat "$lv")" in dialog\|ai*) ok "memory names the AI dialog: $(cat "$lv")";; *) bad "memory after switching is '$(cat "$lv")'";; esac
esc_out
errs=$(log | tail -n +$((mark + 1)) | grep -E "Core.qml|ThemeDialog|Wallhaven|PaletteDialog|ReferenceError|TypeError|is not a type|unavailable" | head -5)
[ -z "$errs" ] && ok "no errors in the shell log" || bad "log: $errs"
ipc close 2>/dev/null
exit $fail
