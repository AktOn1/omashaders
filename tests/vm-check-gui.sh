#!/usr/bin/env bash
# VM check for the menu layout. Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-gui.sh" "$d/vm-check.sh" && vm-test "$d"
# Shots: first view (themes + tab row), one tab open at a time, filter + Tab, Surprise list, paused.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
st=$HOME/.local/state/omarchy/$S
shot() { grim "$out/$1.png"; }
ipc() { omarchy-shell "$S" "$@"; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
fail=0
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
mark=$(log | wc -l)
newlog() { log | tail -n +$((mark + 1)); }
panel_open() { [ "$(hyprctl layers 2>/dev/null | grep -c omarchy-keyboard-panel)" -gt 0 ]; }
key() { wtype "$@"; sleep 0.5; }
mkdir -p "$st"
rm -f "$st/sections"

bind=$HOME/.config/hypr/bindings.lua
mkdir -p "$(dirname "$bind")"; touch "$bind"; cp "$bind" "$out/bindings.lua.orig"
echo 'hl.bind("SUPER + ALT + F9", hl.dsp.exec_cmd("omarchy-shell io.github.akton1.omashaders power toggle"))' >> "$bind"
echo "pause-key output: '$(python3 $HOME/.config/omarchy/plugins/$S/bin/pause-key 2>&1)'"
sleep 8
hyprctl -j binds | python3 -c 'import json,sys; sys.exit(0 if any(b.get("modmask")==12 and str(b.get("key")).upper()=="P" and "omashaders" in json.dumps(b).lower() for b in json.load(sys.stdin)) else 1)' \
  && ok "default pause key Ctrl+Alt+P is bound" || bad "Ctrl+Alt+P is not bound"
hyprctl -j binds | python3 -c 'import json,sys; [print(json.dumps(b)) for b in json.load(sys.stdin) if b.get("modmask")==12]'
echo "pause-bind.key: '$(cat $st/pause-bind.key 2>&1)'"
echo "pause-key output (default first): '$(python3 $HOME/.config/omarchy/plugins/$S/bin/pause-key 2>&1)'"
[ "$(python3 $HOME/.config/omarchy/plugins/$S/bin/pause-key 2>&1)" = "Ctrl+Alt+P" ] && ok "pause-key shows Ctrl+Alt+P first" || bad "pause-key did not show Ctrl+Alt+P first"
for i in $(seq 1 30); do [ -s "$st/themes" ] && break; sleep 2; done; sleep 4
ipc open; sleep 4
panel_open && ok "menu opens" || bad "menu did not open"
shot gui-1-first-view
key -s 200 "?"; sleep 1
shot gui-1b-hotkeys-open
key -s 200 "?"; sleep 1
shot gui-1c-hotkeys-folded

key s; sleep 1
shot gui-2a-screen-open
[ "$(cat "$st/sections" 2>/dev/null)" = "screen theme" ] && ok "sections file: $(cat "$st/sections")" || bad "sections file is '$(cat "$st/sections" 2>/dev/null)'"
key C; sleep 1
shot gui-2-color-open
[ "$(cat "$st/sections" 2>/dev/null)" = "color theme" ] && ok "opening Color closes Screen: $(cat "$st/sections")" || bad "sections file is '$(cat "$st/sections" 2>/dev/null)'"
key C; sleep 1
[ "$(cat "$st/sections" 2>/dev/null)" = "theme" ] && ok "same key again folds it" || bad "sections file is '$(cat "$st/sections" 2>/dev/null)'"

key m; key 2; sleep 1
shot gui-3-surprise-list
key l; key j; key -k space; sleep 4
shot gui-4-after-surprise


key p; sleep 4
[ -s "$st/disabled" ] && ok "p pauses (state: $(cat "$st/disabled"))" || bad "p did not pause (state file empty)"
key p; sleep 4
[ -s "$st/disabled" ] && bad "second p did not resume" || ok "second p resumes"

key w; sleep 2
shot gui-6-wallpaper
key c; sleep 1
shot gui-7-cursor
key W; sleep 1
shot gui-7b-windows
key q; sleep 2
sc=$HOME/.config/omarchy/plugins/$S/bin/omashaders
$sc set "$($sc list 2>/dev/null | head -1)" >/dev/null 2>&1; $sc color set "$($sc color list 2>/dev/null | head -1)" >/dev/null 2>&1
echo 1 > "$st/disabled"
omarchy-restart-shell >/dev/null 2>&1; sleep 12
ipc open; sleep 4
shot gui-8-paused-fresh
key q; sleep 2
$sc power on >/dev/null 2>&1
panel_open && bad "menu still open after q" || ok "q closes the menu"
cp "$out/bindings.lua.orig" "$bind"

# Save (F) asks for a name; Share asks for the parts
$sc set "$($sc list 2>/dev/null | head -1)" >/dev/null 2>&1; $sc color set "$($sc color list 2>/dev/null | sed -n 3p)" >/dev/null 2>&1; sleep 2
ipc open; sleep 3
shot gui-10-left-list
key F; sleep 2
shot gui-11-save-window
wtype "Zed test theme"; sleep 1
shot gui-11b-save-typed
key -k Return; sleep 2
grep -q 'Zed test theme' "$st/themes" && ok "F + name saves the theme under that name" || bad "named theme not saved"
# "/" filter, Tab to the results, j k and Enter pick a theme
sc=$HOME/.config/omarchy/plugins/$S/bin/omashaders
$sc off >/dev/null 2>&1; sleep 2
panel_open || { ipc open; sleep 3; }
key /; wtype "Zed test"; sleep 1
shot gui-2b-filter
key -k Tab; sleep 1
key j; key k; sleep 1
shot gui-2c-filter-results
key -k Return; sleep 3
[ "$($sc status 2>/dev/null)" != "off" ] && ok "filter, Tab, j k, Enter applied the theme" || bad "theme not applied after filter + Tab + Enter"
panel_open || { ipc open; sleep 3; }
ipc shareTheme 1; sleep 3
shot gui-12-share-window
key 1; sleep 1
shot gui-12b-share-screen-off
key -k Return; sleep 2
for i in 1 2 3 4 5 6 7 8; do code=$(wl-paste -n 2>/dev/null); case "$code" in OMS1:*) break;; esac; sleep 2; done
shot gui-12c-share-code
echo "$code" | grep -q '^OMS1:' && ok "share copied a code" || bad "no code on the clipboard"
python3 $HOME/.config/omarchy/plugins/$S/bin/theme-code check "$code" --json | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d["theme"]["s"]=="" and (d["theme"]["c"] or d["theme"]["w"]) else 1)' \
  && ok "code left Screen out" || bad "code still has Screen"
key -k Escape; sleep 1

# update flyout: the installed copy becomes a git repo whose origin is one release ahead
pd=$HOME/.config/omarchy/plugins/$S
( cd "$pd" && rm -rf .git && git init -q -b main && git add -A && git -c user.email=t@t -c user.name=t commit -qm base \
  && git clone -q --bare . /tmp/oms-origin.git && git remote add origin /tmp/oms-origin.git \
  && git clone -q /tmp/oms-origin.git /tmp/oms-work && cd /tmp/oms-work \
  && sed -i 's/"version": "[0-9.]*"/"version": "99.0.0"/' manifest.json \
  && sed -i "s/^## What's new\$/## What's new\n\n- **1 Jan 2027, 99.0.0:** **Test release headline.** More words after it./" README.md \
  && git -c user.email=t@t -c user.name=t commit -qam "release 99.0.0" && git push -q origin main ) >/dev/null 2>&1
python3 "$pd/bin/update-check" "$pd" | grep -q '"available": true' && ok "update-check sees the newer release" || bad "update-check did not see the release"
omarchy-restart-shell >/dev/null 2>&1; sleep 12
ipc open; sleep 6
key U; sleep 1
shot gui-9-update-flyout
key -k Escape; sleep 1
panel_open && ok "Esc closes the flyout, menu stays" || bad "menu closed with the flyout"
key q; sleep 1
omarchy plugin update "$S" --yes >/dev/null 2>&1
grep -q '"99.0.0"' "$pd/manifest.json" && ok "omarchy plugin update brings 99.0.0" || bad "omarchy plugin update did not update"

# up to date: the button stays in the header and the flyout lists the latest changes
omarchy-restart-shell >/dev/null 2>&1; sleep 12
ipc open; sleep 6
key U; sleep 1
shot gui-10-whats-new
key j; key j; key j; sleep 1
shot gui-10b-whats-new-scrolled
key -k Escape; sleep 1
key q; sleep 1

errs=$(newlog | grep -iE "ReferenceError|TypeError|is not defined|Binding loop|unavailable|Cannot assign|Unable to assign" | head -8)
if [ -n "$errs" ]; then bad "QML errors:"; echo "$errs"; else ok "no QML errors in the shell log"; fi
exit $fail
