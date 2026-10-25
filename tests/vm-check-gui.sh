#!/usr/bin/env bash
# vm-check-timeout: 900
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
hintf() { ipc hints | sed -n "s/.*$1=\([^ ]*\).*/\1/p"; }
# a cold VM can be slow: press a focus key and, if the focus did not follow, say so and press it once more
focus_key() { # key kind
  key "$1"; for i in 1 2 3 4 5 6; do [ "$(hintf focus)" = "$2" ] && return 0; sleep 0.5; done
  echo "note: key $1 did not move the focus to $2 (focus is $(hintf focus)), pressing it again"; key "$1"; sleep 1
  [ "$(hintf focus)" = "$2" ]
}
f1_to() { # on|off: F1 until the strip is in that state (a key sent right after a screenshot can get lost)
  key -k F1; for i in 1 2 3 4 5 6; do [ "$(ipc hints | cut -d' ' -f1)" = "$1" ] && return 0; sleep 0.5; done
  echo "note: F1 did not switch the hints $1, pressing it again"; key -k F1; sleep 1.5
}
waitrd() { # state file, empty|set (up to 8 s)
  for i in 1 2 3 4 5 6 7 8; do v=$(rd "$1"); if [ "$2" = empty ]; then [ -z "$v" ] && return 0; else [ -n "$v" ] && return 0; fi; sleep 1; done; return 1
}
waitlook() { # polls ipc look until it starts with same| (up to 12 s)
  local l=""; for i in 1 2 3 4 5 6 7 8 9 10 11 12; do l=$(ipc look 2>/dev/null); case "$l" in same\|*) break;; esac; sleep 1; done; echo "$l"
}
totheme() { for i in 1 2 3 4 5 6 7; do [ "$(hintf focus)" = "theme" ] && return 0; key -k Tab; done; return 1; }
mkdir -p "$st"
rm -f "$st/sections"
# a __pycache__ copied in with the plugin folder would only make the final check below fail for the wrong reason
find "$HOME/.config/omarchy/plugins/$S" -name __pycache__ -type d -exec rm -rf {} + 2>/dev/null; sleep 4

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
key -k F1; sleep 1
shot gui-1b-hotkeys-hidden
key -k F1; sleep 1
shot gui-1c-hotkeys-shown

key s; sleep 1
shot gui-2a-screen-open
[ "$(cat "$st/sections" 2>/dev/null)" = "screen theme" ] && ok "sections file: $(cat "$st/sections")" || bad "sections file is '$(cat "$st/sections" 2>/dev/null)'"
key C; sleep 1
shot gui-2-color-open
[ "$(cat "$st/sections" 2>/dev/null)" = "color theme" ] && ok "opening Color closes Screen: $(cat "$st/sections")" || bad "sections file is '$(cat "$st/sections" 2>/dev/null)'"
key C; sleep 1
[ "$(cat "$st/sections" 2>/dev/null)" = "theme" ] && ok "same key again folds it" || bad "sections file is '$(cat "$st/sections" 2>/dev/null)'"

totheme; key 2; sleep 1
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

# --- keyboard block: cursor moves apply nothing, Space applies, F2 live preview, Shift+arrow previews, stacking by keyboard only
rd() { cat "$st/$1" 2>/dev/null | head -1; }
rm -f "$st/key-preview" "$st/sections"
ipc close >/dev/null 2>&1; sleep 1
$sc off >/dev/null 2>&1; ipc setColor off; ipc setMouse off; ipc wallpaper off; : > "$st/effect2"; : > "$st/color2"; sleep 3
ipc open; sleep 4
panel_open && ok "keys: menu opens" || bad "keys: menu did not open"
echo "keys start: $(ipc hints)"
[ "$(hintf f1cap)" = "true" ] && ok "F1 cap is in the header" || bad "F1 cap missing: $(ipc hints)"
[ "$(hintf preview)" = "off" ] && ok "live preview is off by default" || bad "preview not off by default: $(ipc hints)"
[ "$(hintf slashcap)" = "true" ] && ok "the / cap sits at the search bar" || bad "no / cap at the search bar: $(ipc hints)"
case "$(hintf ekeys)" in *"/"*) bad "/ is still in the Everywhere row: $(hintf ekeys)";; *) ok "/ is not in the Everywhere row";; esac
case "$(hintf ekeys)" in *"⏎"*) ok "Everywhere row keeps the Enter cap";; *) bad "Enter cap missing: $(hintf ekeys)";; esac
shot keys-1-start
shot keys-1b-header-search
key -k F1; sleep 1
[ "$(hintf slashcap)" = "false" ] && ok "F1 hides the / cap" || bad "/ cap still shown after F1: $(ipc hints)"
[ "$(hintf f1cap)" = "true" ] && [ "$(hintf f1dim)" = "true" ] && [ "$(hintf row2)" = "false" ] && ok "F1 hides the strip, the header cap stays and is dimmed" || bad "F1 cap/strip wrong: $(ipc hints)"
shot keys-2-hints-off
key -k F1; sleep 1
[ "$(hintf slashcap)" = "true" ] && ok "F1 shows the / cap again" || bad "/ cap not back after F1: $(ipc hints)"
[ "$(hintf f1dim)" = "false" ] && [ "$(hintf row2)" = "true" ] && ok "F1 shows the strip again, cap lit" || bad "F1 did not restore: $(ipc hints)"
# Screen: cursor moves change nothing
{ [ -z "$(rd current)" ] || [ "$(rd current)" = "off" ]; } && ok "screen starts off" || bad "screen not off at start: '$(rd current)'"
key s; sleep 1
[ "$(hintf focus)" = "screen" ] && ok "s moves the cursor to Screen" || bad "focus is $(hintf focus)"
key l; key j; key j; sleep 2
{ [ -z "$(rd current)" ] || [ "$(rd current)" = "off" ]; } && ok "moving the cursor in Screen applied nothing" || bad "cursor move applied '$(rd current)'"
shot keys-3-screen-cursor
key m; sleep 1
[ "$(hintf focus)" = "screen" ] && ok "m does nothing (still on Screen)" || bad "m moved the cursor to $(hintf focus)"
case "$(hintf fkeys)" in *"m"*) bad "a hint still shows m: $(hintf fkeys)";; *) ok "no m in the hints";; esac
case "$(hintf fkeys)" in *",a,"*|*",a") ok "Screen hints show a (add a second effect)";; *) bad "no a hint on Screen: $(hintf fkeys)";; esac
case "$(hintf fkeys)" in *",t,"*|*",t") bad "t hint shows without a mix: $(hintf fkeys)";; *) ok "t hint is hidden while no mix is on";; esac
key -k space; sleep 3
fx1=$(rd current)
{ [ -n "$fx1" ] && [ "$fx1" != "off" ]; } && ok "Space applies the effect under the cursor ($fx1)" || bad "Space did not apply"
panel_open && ok "Space keeps the menu open" || bad "Space closed the menu"
key j; key -k Return; sleep 3
fx1b=$(rd current)
{ [ -n "$fx1b" ] && [ "$fx1b" != "$fx1" ]; } && ok "Enter applies the effect under the cursor ($fx1b)" || bad "Enter did not apply (current '$fx1b')"
panel_open && ok "Enter keeps the menu open" || bad "Enter closed the menu"
key k; key -k space; sleep 3
[ "$(rd current)" = "$fx1" ] && ok "back on the first effect ($fx1)" || bad "could not return to $fx1 (now '$(rd current)')"
# F2: live preview on, moving applies, F2 off goes back to the kept effect
key -k F2; sleep 1
{ [ "$(hintf preview)" = "on" ] && [ "$(rd key-preview)" = "on" ]; } && ok "F2 turns live preview on" || bad "F2 did not turn preview on: $(ipc hints)"
shot keys-4-preview-on
key j; sleep 2.5
[ "$(rd current)" != "$fx1" ] && ok "with F2 on, moving previews ($(rd current))" || bad "F2 on but moving did not preview"
key -k F2; sleep 2.5
{ [ "$(hintf preview)" = "off" ] && [ "$(rd current)" = "$fx1" ]; } && ok "F2 off drops the preview, back to $fx1" || bad "after F2 off the effect is '$(rd current)', wanted $fx1"
# Shift+arrow previews one step and goes back on release
wtype -M shift -P Shift_L -k Down -s 3500 -p Shift_L -m shift & wp=$!
sleep 2.5
[ "$(rd current)" != "$fx1" ] && ok "Shift+Down previews a step while Shift is held ($(rd current))" || bad "Shift+Down did not preview"
wait $wp; sleep 2.5
[ "$(rd current)" = "$fx1" ] && ok "Shift+Down preview is dropped on release" || bad "Shift+Down left '$(rd current)'"
# add a second effect with a
key j; sleep 1
key a; sleep 3
[ -n "$(rd effect2)" ] && ok "a added a second effect ($(rd effect2))" || bad "no second effect"
[ "$(rd current)" = "$fx1" ] && ok "the first effect stays ($fx1)" || bad "first effect changed to '$(rd current)'"
panel_open && ok "a keeps the menu open" || bad "a closed the menu"
case "$(hintf fkeys)" in *",t,"*|*",t,"*) ok "t hint shows while a mix is on";; *) bad "no t hint with a mix: $(hintf fkeys)";; esac
shot keys-5a-mix-on
mode1=$(rd mix-effect | awk '{print $1}')
key t; sleep 3
mode2=$(rd mix-effect | awk '{print $1}')
{ [ -n "$mode1" ] && [ "$mode1" != "$mode2" ]; } && ok "t flips the mix ($mode1 -> $mode2)" || bad "t did not flip the mix ($mode1 -> $mode2)"
key t; sleep 2
[ "$(rd mix-effect | awk '{print $1}')" = "$mode1" ] && ok "t flips it back" || bad "t did not flip back"
# Right on the last column only moves on: no apply, menu stays
key l; sleep 1
{ panel_open && [ "$(rd current)" = "$fx1" ]; } && ok "l on the last column does not apply or close" || bad "l on the last column changed things"
# Colour, Wallpaper, Cursor one by one
focus_key C color || bad "C did not focus Color"
key l; key -k space; sleep 3
col1=$(rd color)
[ -n "$col1" ] && ok "Colour by keyboard: $col1" || bad "no colour applied"
[ "$(rd current)" = "$fx1" ] && ok "screen kept after Colour" || bad "screen is '$(rd current)' after Colour"
focus_key w wall || bad "w did not focus Wallpaper"
key l; key -k space; sleep 3
[ -n "$(rd wp-effect)" ] && ok "Wallpaper by keyboard: $(rd wp-effect)" || bad "no wallpaper effect applied"
shot keys-5-wallpaper
focus_key c mouse || bad "c did not focus Cursor"
key l; key -k space; sleep 3
{ [ -n "$(rd mouse)" ] && [ "$(rd mouse)" != "off" ]; } && ok "Cursor by keyboard: $(rd mouse)" || bad "no cursor effect applied"
{ [ "$(rd current)" = "$fx1" ] && [ "$(rd color)" = "$col1" ]; } && ok "screen + colour + wallpaper + cursor are all on" || bad "stack broke: screen '$(rd current)' colour '$(rd color)'"
shot keys-6-stacked
# Themes: moving never overwrites the look
totheme; sleep 1
[ "$(hintf focus)" = "theme" ] && ok "Tab reaches Themes" || bad "focus is $(hintf focus)"
key j; key j; key j; sleep 2.5
{ [ "$(rd current)" = "$fx1" ] && [ "$(rd color)" = "$col1" ]; } && ok "moving through Themes left the look alone" || bad "Themes cursor changed the look"
shot keys-7-themes-cursor
case "$(hintf fkeys)" in *",r,"*) ok "Themes hints show r and R";; *) bad "no r hint on Themes: $(hintf fkeys)";; esac
# the flag legend: after the keys of the Themes list, worded like the status line, hidden with the strip (F1), not a key
[ "$(hintf legend)" = "true" ] && ok "Themes strip shows the built-in flag legend" || bad "no flag legend on Themes: $(ipc hints)"
[ "$(hintf legendtext)" = "built_in_(Duplicate_to_change)" ] && ok "legend reads 'built in (Duplicate to change)'" || bad "legend text is '$(hintf legendtext)'"
case "$(hintf fkeys)" in *"󰈻"*) bad "the flag legend is counted as a key: $(hintf fkeys)";; *) ok "the legend is not listed as a key";; esac
shot keys-7a-themes-legend
f1_to off; sleep 0.5
[ "$(hintf legend)" = "false" ] && ok "F1 hides the flag legend" || bad "legend still shown with hints off: $(ipc hints)"
f1_to on; sleep 0.5
[ "$(hintf legend)" = "true" ] && ok "F1 shows the flag legend again" || bad "legend not back after F1: $(ipc hints)"
focus_key s screen || bad "s did not focus Screen"
[ "$(hintf legend)" = "true" ] && ok "Screen strip shows the legend too (its list has built-in rows)" || echo "info: no legend on Screen: $(ipc hints | sed 's/ fkeys.*//')"
totheme
# r = a random complete theme (never the same twice in a row), R = every part on its own
look() { ipc look; }
key r; l1=$(waitlook); echo "after r #1: $l1"
case "$l1" in same\|*) ok "r applied a complete theme (${l1#same|})";; *) bad "r did not land on a complete theme: $l1";; esac
shot keys-7b-random-theme
panel_open && ok "r keeps the menu open" || bad "r closed the menu"
key r; l2=$(waitlook); echo "after r #2: $l2"
{ [ "$l2" != "$l1" ] && case "$l2" in same\|*) true;; *) false;; esac; } && ok "second r picked a different complete theme (${l2#same|})" || bad "second r gave '$l2' after '$l1'"
# R compiles four shaders in one go: on the software GPU the shell can be busy for several seconds
waitresp() { local l=""; for i in $(seq 1 30); do l=$(timeout 4 omarchy-shell "$S" look 2>&1); case "$l" in ""|*"not responding"*) sleep 1;; *) break;; esac; done; echo "$l"; }
key R; sleep 2; l3=$(waitresp); echo "after R: $l3"
case "$l3" in same\|*) echo "note: R left the look unchanged ($l3), pressing it again"; key R; sleep 2; l3=$(waitresp); echo "after R again: $l3";; esac
case "$l3" in same\|*) bad "R landed on a complete theme: $l3";; *) ok "R shuffles the parts separately (not a complete theme): $l3";; esac
key -k Escape; for i in $(seq 1 15); do panel_open || break; sleep 1; done
panel_open && bad "Esc did not close" || ok "Esc closes the menu"
# Enter picks and the menu stays; a adds a second effect
$sc off >/dev/null 2>&1; ipc setColor off; ipc setMouse off; ipc wallpaper off; : > "$st/effect2"; sleep 2
ipc open; sleep 3
for i in 1 2; do [ "$(hintf focus)" = "screen" ] || key s; done
key l; key -k Return; sleep 3
fx2=$(rd current)
{ panel_open && [ -n "$fx2" ] && [ "$fx2" != "off" ]; } && ok "Enter picks an effect and the menu stays open ($fx2)" || bad "Enter: open=$(panel_open && echo yes || echo no) current '$(rd current)'"
key j; key a; waitrd effect2 set
{ panel_open && [ "$(rd current)" = "$fx2" ] && [ -n "$(rd effect2)" ]; } && ok "a mixes a second effect and the menu stays open ($(rd effect2))" || bad "a: open=$(panel_open && echo yes || echo no) current '$(rd current)' second '$(rd effect2)'"
shot keys-8-screen-mix
key a; waitrd effect2 empty
[ -z "$(rd effect2)" ] && ok "a on the second effect removes it" || bad "second effect still '$(rd effect2)'"
key a; waitrd effect2 set
[ -n "$(rd effect2)" ] && ok "a adds it again" || bad "second effect not back"
key -k BackSpace; waitrd effect2 empty
[ -z "$(rd effect2)" ] && ok "Backspace removes the mix" || bad "Backspace did not remove the mix"
key a; waitrd effect2 set
shot keys-8b-screen-mix-hints
# Color tab: a keyboard pair for each rail of the custom colour (z Z hue, v V saturation, m M brightness)
cust() { echo " $(ipc custom)" | sed -n "s/.* $1=\([^ ]*\).*/\1/p"; }
cmpf() { python3 -c "import sys; a,b=float(sys.argv[1]),float(sys.argv[2]); print('up' if b>a+1e-6 else ('down' if b<a-1e-6 else 'same'))" "$1" "$2"; }
waitcol() { for i in 1 2 3 4 5 6 7 8 9 10; do [ "$(rd color)" = "custom-$(cust hex)" ] && return 0; sleep 1; done; return 1; }
to_color() { # open the Color tab if needed and put the cursor on it
  grep -q color "$st/sections" 2>/dev/null || { key C; sleep 1; }
  for i in 1 2 3 4 5 6 7; do [ "$(hintf focus)" = "color" ] && return 0; key -k Tab; done; return 1
}
ipc setColor custom-ff8a00; sleep 4
panel_open || { ipc open; sleep 4; }
to_color && ok "color keys: cursor is on the Color tab" || bad "color keys: focus is $(hintf focus)"
echo "color keys start: $(ipc custom)"
[ "$(cust on)" = "true" ] && ok "color keys: the custom colour is on" || bad "color keys: custom colour not on: $(ipc custom)"
[ "$(cust railcaps)" = "zZ,vV,mM" ] && ok "caps sit next to the three rail labels (zZ,vV,mM)" || bad "rail caps are '$(cust railcaps)'"
case "$(hintf fkeys)" in *"z+Z"*"v+V"*"m+M"*) ok "the Color strip row lists the three pairs: $(hintf fkeys)";; *) bad "Color strip row misses the pairs: $(hintf fkeys)";; esac
shot keys-10-color-rails
fx_before=$(rd current)
for pair in "z Z h hue" "v V s saturation" "m M v brightness"; do
  set -- $pair; lo=$1; up=$2; fld=$3; nm=$4
  b0=$(cust $fld); hx0=$(cust hex)
  key $lo; sleep 1; b1=$(cust $fld)
  [ "$(cmpf $b0 $b1)" = "down" ] && ok "$lo lowers the $nm ($b0 -> $b1)" || bad "$lo did not lower the $nm ($b0 -> $b1)"
  [ "$(cust hex)" != "$hx0" ] && ok "$nm: the hex field value follows ($hx0 -> $(cust hex))" || bad "$nm: hex stayed $hx0"
  waitcol && ok "$nm: the applied colour follows ($(rd color))" || bad "$nm: applied colour is '$(rd color)', hex is $(cust hex)"
  key $up; sleep 1; b2=$(cust $fld)
  [ "$(cmpf $b1 $b2)" = "up" ] && ok "$up raises the $nm ($b1 -> $b2)" || bad "$up did not raise the $nm ($b1 -> $b2)"
  [ "$(cust hex)" = "$hx0" ] && ok "$nm: lower then upper is back at $hx0" || bad "$nm: hex is $(cust hex), wanted $hx0"
  waitcol || bad "$nm: applied colour did not follow the way back"
done
[ "$(hintf focus)" = "color" ] && ok "the keys left the cursor on Color" || bad "focus moved to $(hintf focus)"
[ "$(rd current)" = "$fx_before" ] && ok "the screen effect stayed ($fx_before)" || bad "screen effect changed to '$(rd current)'"
panel_open && ok "the keys keep the menu open" || bad "a colour key closed the menu"
# F1 hides the caps on the rails and brings them back
f1_to off; sleep 0.5
[ "$(cust railcaps)" = "-,-,-" ] && ok "F1 hides the rail caps" || bad "rail caps with hints off: '$(cust railcaps)'"
f1_to on; sleep 0.5
[ "$(cust railcaps)" = "zZ,vV,mM" ] && ok "F1 shows the rail caps again" || bad "rail caps after F1: '$(cust railcaps)'"
# the same letters still do their old job on Cursor and Wallpaper, and leave the colour alone
hx_keep=$(cust hex)
focus_key c mouse || bad "c did not focus Cursor"
key v; key z; key m; sleep 1
[ "$(cust hex)" = "$hx_keep" ] && ok "v z m on Cursor leave the custom colour alone" || bad "a key on Cursor moved the colour to $(cust hex)"
focus_key w wall || bad "w did not focus Wallpaper"
key V; key Z; key M; sleep 1
[ "$(cust hex)" = "$hx_keep" ] && ok "V Z M on Wallpaper leave the custom colour alone" || bad "a key on Wallpaper moved the colour to $(cust hex)"
# no click, no custom colour on. Keyboard only (Tab to Color, j/k on the effect rows): the first key starts the custom colour
nokey_check() { # label: custom colour must be off now; every key must start/move it
  local lbl=$1 fld lo up pair b0 b1 b2
  [ "$(cust on)" = "false" ] && ok "$lbl: the custom colour is off before the keys" || bad "$lbl: custom colour already on: $(ipc custom)"
  for pair in "z Z h hue" "v V s saturation" "m M v brightness"; do
    set -- $pair; lo=$1; up=$2; fld=$3; nm=$4
    b0=$(cust $fld); key $lo; sleep 1; b1=$(cust $fld)
    [ "$(cmpf $b0 $b1)" = "down" ] && ok "$lbl: $lo lowers the $nm ($b0 -> $b1)" || bad "$lbl: $lo did not lower the $nm ($b0 -> $b1)"
    waitcol && ok "$lbl: $nm: custom-$(cust hex) is applied" || bad "$lbl: $nm: applied colour is '$(rd color)', hex is $(cust hex)"
    [ "$(cust on)" = "true" ] || bad "$lbl: $nm: custom colour not on after $lo"
    key $up; sleep 1; b2=$(cust $fld)
    [ "$(cmpf $b1 $b2)" = "up" ] && ok "$lbl: $up raises the $nm ($b1 -> $b2)" || bad "$lbl: $up did not raise the $nm ($b1 -> $b2)"
    waitcol || bad "$lbl: $nm: applied colour did not follow the way back"
  done
}
to_color || bad "could not return to Color"
ipc setColor off; sleep 3
nokey_check "custom off"
ipc setColor off; sleep 3
to_color
ipc setColor amber; sleep 3
key j; key k; sleep 1
[ "$(rd color)" = "amber" ] && ok "a built-in colour (amber) is on, cursor moved with j k" || bad "colour is '$(rd color)', wanted amber"
nokey_check "built-in colour"
[ "$(hintf focus)" = "color" ] && ok "the keys left the cursor on Color" || bad "focus moved to $(hintf focus)"
ipc setColor custom-ff8a00; sleep 4
# small screens: caps stay on the rails, the menu still fits
for mode in 1024x768 800x600; do
  ipc close; sleep 1
  hyprctl eval "hl.monitor({output=\"$(hyprctl -j monitors | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["name"])')\", mode=\"$mode@60\", position=\"0x0\", scale=1})" >/dev/null 2>&1; sleep 3
  echo on > "$st/hotkey-hints"; sleep 1.5
  ipc open; sleep 4
  panel_open || { ipc open; sleep 4; }
  to_color
  shot keys-10b-color-rails-${mode}
  echo "color rails ${mode}: $(ipc hints | sed 's/ fkeys.*//') | $(ipc custom)"
  [ "$(cust railcaps)" = "zZ,vV,mM" ] && ok "small ${mode}: caps stay on the rails" || bad "small ${mode}: rail caps are '$(cust railcaps)'"
  if [ "$mode" = "800x600" ]; then
    [ "$(hintf row2)" = "false" ] && ok "small ${mode}: the strip stays one compact line ($(hintf strip) px)" || bad "small ${mode}: the strip has a second row: $(ipc hints | sed 's/ fkeys.*//')"
  else
    info=$(ipc hints); need=$(echo "$info" | sed -n 's/.*need=\([0-9]*\).*/\1/p'); room=$(echo "$info" | sed -n 's/.*room=\([0-9]*\).*/\1/p')
    [ -n "$need" ] && [ -n "$room" ] && [ "$need" -le "$room" ] && ok "small ${mode} Color focus: the menu fits ($need of $room px)" || bad "small ${mode} Color focus: the menu does not fit ($need of $room px)"
  fi
done
ipc close; sleep 1
mon0=$(hyprctl -j monitors | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["name"])')
hyprctl eval "hl.monitor({output=\"$mon0\", mode=\"1280x800@60\", position=\"0x0\", scale=1})" >/dev/null 2>&1; sleep 3
ipc setColor off; sleep 2
ipc open; sleep 3
grep -q screen "$st/sections" 2>/dev/null || { key s; sleep 1; }
# small screens: the / cap at the search bar and the t hint (mix on); the menu must fit while no other effect adds chips to the GPU block
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
  panel_open || { ipc open; sleep 4; }
  for i in 1 2 3 4 5 6 7; do [ "$(hintf focus)" = "screen" ] && break; key -k Tab; done
  shot keys-9-small-${mode}-screen-mix
  [ "$(hintf slashcap)" = "true" ] && ok "small ${mode}: the / cap sits at the search bar" || bad "small ${mode}: no / cap: $(ipc hints)"
  case "$(hintf fkeys)" in *",t,"*|*",t,"*) ok "small ${mode}: t hint with a mix";; *) bad "small ${mode}: no t hint: $(hintf fkeys)";; esac
  echo "info: small ${mode} with a mix on (two chips in the GPU block): $(ipc hints | sed 's/ fkeys.*//')"
  key -k F1; sleep 1.5
  shot keys-9b-small-${mode}-hints-off
  [ "$(hintf slashcap)" = "false" ] && ok "small ${mode}: F1 hides the / cap" || bad "small ${mode}: / cap stays with hints off"
  key -k F1; sleep 1.5
  [ "$(hintf slashcap)" = "true" ] && ok "small ${mode}: F1 brings the / cap back" || bad "small ${mode}: / cap not back"
done
# nothing on: the layout of the small screens is checked without chips in the GPU block
$sc off >/dev/null 2>&1; : > "$st/effect2"; sleep 2
for mode in 1024x768 800x600; do
  ipc close; sleep 1
  hyprctl eval "hl.monitor({output=\"$mon\", mode=\"$mode@60\", position=\"0x0\", scale=1})" >/dev/null 2>&1; sleep 3
  ipc open; sleep 4
  panel_open || { ipc open; sleep 4; }
  for i in 1 2 3 4 5 6 7; do [ "$(hintf focus)" = "screen" ] && break; key -k Tab; done
  shot keys-9c-small-${mode}-screen-clean
  if [ "$mode" = "800x600" ]; then
    # the GPU block can still list a chip here (it depends on the build); vm-check-hints.sh asserts the 800x600 fit
    echo "info: small ${mode} hints on: $(ipc hints | sed 's/ fkeys.*//')"
    key -k F1; sleep 1.5
    echo "info: small ${mode} hints off: $(ipc hints | sed 's/ fkeys.*//')"
  else
    fits "small ${mode} screen focus, hints on, nothing on"
    key -k F1; sleep 1.5
    fits "small ${mode} screen focus, hints off, nothing on"
  fi
  key -k F1; sleep 1.5
  # Themes focus on the small screens: the legend goes with the second strip row on 1024x768 and with the whole strip on 800x600
  totheme; sleep 1
  shot keys-9d-small-${mode}-themes-legend
  if [ "$mode" = "800x600" ]; then
    [ "$(hintf legend)" = "false" ] && ok "small ${mode}: the strip, and with it the legend, stays hidden" || bad "small ${mode}: legend shown: $(ipc hints | sed 's/ fkeys.*//')"
  else
    # the legend sits on the second strip row, which the compact one-line strip drops on a small screen, so it goes with that row
    [ "$(hintf legend)" = "$(hintf row2)" ] && ok "small ${mode}: the legend is shown exactly when the second strip row is" || bad "small ${mode}: legend and second row disagree: $(ipc hints | sed 's/ fkeys.*//')"
    fits "small ${mode} Themes focus with the legend"
  fi
done
ipc close; sleep 1
hyprctl eval "hl.monitor({output=\"$mon\", mode=\"1280x800@60\", position=\"0x0\", scale=1})" >/dev/null 2>&1; sleep 3
ipc open; sleep 3
key -k Escape; sleep 1.5
panel_open && bad "Esc did not close" || ok "Esc closes the menu"
$sc off >/dev/null 2>&1; ipc setColor off; ipc setMouse off; ipc wallpaper off; : > "$st/effect2"; sleep 1
# --- end keyboard block

pyc=$(find "$HOME/.config/omarchy/plugins/$S" -name __pycache__ 2>/dev/null | head -3)
[ -z "$pyc" ] && ok "no __pycache__ in the plugin folder (it would reload the plugin and close the menu)" || bad "__pycache__ written into the plugin folder: $pyc"
errs=$(newlog | grep -iE "ReferenceError|TypeError|is not defined|Binding loop|unavailable|Cannot assign|Unable to assign" | head -8)
if [ -n "$errs" ]; then bad "QML errors:"; echo "$errs"; else ok "no QML errors in the shell log"; fi
exit $fail
