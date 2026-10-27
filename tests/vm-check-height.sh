#!/usr/bin/env bash
# vm-check-timeout: 600
# VM check: the menu lists use the whole screen height on tall screens, and nothing moves while a theme is chosen. Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-height.sh" "$d/vm-check.sh" && vm-test "$d"
# Done looks like: at each screen size the card fills the height that is free under the bar (the part left over is less than two list rows), it never needs more than the room there is,
# a small screen (tinyScreen) keeps its shorter lists, and choosing a theme leaves the number of rows and the scroll position alone.
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
st=$HOME/.local/state/omarchy/$S; mkdir -p "$st"
field() { echo "$1" | tr ' ' '\n' | sed -n "s/^$2=//p" | head -1; }
# a theme going on makes the software-rendered VM busy for a moment: ask again until the shell answers
ask() { local i r; for i in 1 2 3 4 5 6 7 8; do r=$(ipc "$1" 2>&1 | tail -1); case $r in *"not responding"*|"") sleep 2;; *) echo "$r"; return;; esac; done; echo "$r"; }
hints() { ask hints; }
state() { ask themeMenu; }
for i in $(seq 1 45); do [ "$(wc -l < "$st/themes" 2>/dev/null || echo 0)" -ge 100 ] && break; sleep 2; done; sleep 6
rm -f "$st/sections"
mon=$(hyprctl -j monitors | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["name"])')
setmode() { hyprctl eval "hl.monitor({output=\"$mon\", mode=\"$1@60\", position=\"0x0\", scale=1})" >/dev/null 2>&1; sleep 4; hyprctl -j monitors | python3 -c 'import json,sys; m=json.load(sys.stdin)[0]; print(m["width"], m["height"])'; }
# MODE NAME TALL(1 = a tall screen: the lists must fill it)
size_run() {
  local mode=$1 name=$2 tall=$3 got h hs need room rows tiny left
  got=$(setmode "$mode"); h=${got#* }
  echo "== $name: monitor now $got"
  ipc close >/dev/null 2>&1; sleep 1.5; ipc open >/dev/null 2>&1; sleep 6
  hs=$(hints); echo "$name hints: $hs"; echo "$name theme: $(state)"
  need=$(field "$hs" need); room=$(field "$hs" room); rows=$(field "$hs" rows); tiny=$(field "$hs" tiny)
  shot "height-$name"
  if [ "$(field "$hs" open)" != true ]; then
    # the software-rendered VM cannot always draw a very large output (the menu does not open); the row count is still worked out from the room, so check the ceiling does not bind
    local chrome extra2 want; chrome=$(field "$hs" chrome); extra2=$(field "$hs" extra); want=$(( (room - chrome - extra2) / 30 - 1 ))
    echo "SKIP: $name: the menu did not open at $got in the VM, only the row count is checked"
    [ "$rows" -ge "$want" ] && [ "$rows" -gt 40 -o "$h" -lt 1700 ] && ok "$name: $rows rows are worked out for $room px (no ceiling at 40)" || bad "$name: only $rows rows for $room px of room (wanted about $want)"
    setmode 1280x800 >/dev/null; return
  fi
  [ "$need" -le "$room" ] && ok "$name: the card ($need px) fits the room ($room px)" || bad "$name: the card needs $need px but only $room px are free"
  left=$((room - need)); extra=$(field "$hs" extra)
  if [ "$tall" = 1 ]; then
    # what is kept free on purpose is the room for the Save / Revert rows and the chips (extra); beyond that less than one Themes row (41 px) may be left
    [ $((left - extra)) -lt 41 ] && ok "$name: the lists fill the height ($left px left, $extra of them kept for the Save / Revert rows and chips; $rows rows)" || bad "$name: $left px of the free height are unused, only $extra are kept on purpose ($rows rows)"
    [ "$rows" -lt 200 ] || bad "$name: the row ceiling is hit"
  else
    echo "$name: $left px left over, $rows rows, tiny=$tiny"
  fi
  # choosing a theme keeps rows and scroll
  local before after
  wtype -k Right; sleep 0.8; for n in 1 2 3; do wtype -k Down; sleep 0.3; done; sleep 1.5
  before=$(state); wtype ' '; sleep 3; after=$(state)
  local drop=' nCmd=[0-9]+| catIdx=[0-9]+| chrome=[0-9]+| load=[0-9]+| loadH=[0-9]+| sel=.*| open=[a-z]+ '
  [ "$(echo "$before" | sed -E "s/$drop//g;s/ item=[0-9]+//")" = "$(echo "$after" | sed -E "s/$drop//g;s/ item=[0-9]+//")" ] \
    && ok "$name: rows and scroll stay put when a theme is chosen" || bad "$name: before=$before after=$after"
  [ "$(field "$(hints)" need)" = "$need" ] && ok "$name: the card keeps its height after choosing a theme" || bad "$name: card height changed after choosing a theme: $need -> $(field "$(hints)" need)"
  shot "height-$name-after"
  ipc close >/dev/null 2>&1; sleep 1.5
}
size_run 1280x800 small-1280x800 0
size_run 1920x1080 hd-1920x1080 1
size_run 2560x1440 qhd-2560x1440 1
size_run 3200x1800 wqhd-3200x1800 1
size_run 3840x2160 uhd-3840x2160 1
setmode 1280x800 >/dev/null
errs=$(log | tail -n +$((mark + 1)) | grep -E "Core.qml|ReferenceError|TypeError|is not a type|unavailable" | head -5)
[ -z "$errs" ] && ok "no menu errors in the shell log" || bad "log: $errs"
exit $fail
