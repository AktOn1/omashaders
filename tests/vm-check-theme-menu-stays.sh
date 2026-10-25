#!/usr/bin/env bash
# VM check: moving over and choosing a theme keeps the Themes menu on the same category, row and scroll position. Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-theme-menu-stays.sh" "$d/vm-check.sh" && vm-test "$d"
# Stepping onto a theme previews it, which adds Save as new / Revert (and, on choosing, Undo) above the categories; every category index shifts.
# Done looks like: the list keeps the same number of rows (the GPU chips below it take a fixed room) and, before and after choosing a row (Space keeps the menu open), `themeMenu` names the category we went to, the same row and the same
# scroll offset, for All themes (a long list, row far down), a built-in group and a category made by the user; the chosen theme is the one now on.
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
cf=$st/theme-categories
rm -f "$st/sections"
for i in $(seq 1 45); do [ "$(wc -l < "$st/themes" 2>/dev/null || echo 0)" -ge 100 ] && break; sleep 2; done; sleep 6
# a category of the user's own with 20 themes in it (a list longer than the rows shown)
{ echo "cat	Shelf"; head -20 "$st/themes" | awk -F'|' 'NF >= 4 {print "set\tShelf\t" $1 "|" $2 "|" $3 "|" $4}'; } > "$cf"
# the helper scripts write __pycache__ into the plugin folder on first use and the shell reloads a plugin whose folder changes (the menu would close): stop that
pd=${PLUGIN_DIR:-$HOME/.config/omarchy/plugins/$S}
find "$pd" -name '*.py' | while read -r f; do mkdir -p "$(dirname "$f")/__pycache__"; done
find "$pd" -name __pycache__ -type d | while read -r d; do rm -f "$d"/*; chmod a-w "$d"; done
omarchy-shell "$S-host" reload >/dev/null 2>&1; sleep 10

field() { echo "$1" | tr ' ' '\n' | sed -n "s/^$2=//p" | head -1; }
state() { local i r; for i in 1 2 3 4 5 6; do r=$(ipc themeMenu 2>&1 | tail -1); case $r in open=*) echo "$r"; return;; esac; sleep 1; done; echo "$r"; }

# the menu can close when the shell reloads the plugin right after the host reload: open it until it stays open
for i in 1 2 3 4 5 6; do ipc open >/dev/null 2>&1; sleep 4; [ "$(field "$(state)" open)" = true ] && break; done
[ "$(field "$(state)" open)" = true ] || bad "the menu did not open"

# NAME KEY WANTED_CATEGORY_ID DOWNS: go to the category (digit key; 1 = All themes, 2 = Surprise me, 3 = the user's category, 4 = the first built-in group),
# step into the list, move DOWNS rows, choose with Space, compare
case_run() {
  local name=$1 key=$2 want=$3 downs=$4 before after n
  wtype "$key"; sleep 1
  wtype -k Right; sleep 0.8
  for n in $(seq 1 "$downs"); do wtype -k Down; sleep 0.3; done
  sleep 2
  before=$(state)
  shot "stays-$name-1-before"
  poll=$(mktemp)
  ( for n in $(seq 1 12); do ipc themeMenu | tail -1; done > "$poll" ) &
  pp=$!
  wtype ' '; sleep 3
  wait $pp
  # every sample taken while the theme went on keeps the category, row and both scroll offsets (a jump that comes back shows as 3 runs)
  local flips
  local drop=' nCmd=[0-9]+| catIdx=[0-9]+| chrome=[0-9]+| load=[0-9]+| loadH=[0-9]+| sel=.*| open=[a-z]+'
  flips=$(sed -E "s/$drop//g" "$poll" | grep -v '^$' | uniq | wc -l)
  [ "$flips" -le 1 ] && ok "$name: the menu held its position in all samples while the theme went on" || { bad "$name: the menu moved while the theme went on ($flips changes of position)"; cat "$poll"; }
  after=$(state)
  shot "stays-$name-2-after"
  echo "$name before: $before"
  echo "$name after:  $after"
  [ "$(field "$before" cat)" = "$want" ] && ok "$name: the menu is on $want after moving over $downs rows" || bad "$name: moving over the rows jumped from $want to $(field "$before" cat)"
  for f in cat item scroll catscroll rows; do
    [ "$(field "$before" $f)" = "$(field "$after" $f)" ] && ok "$name: $f stays $(field "$before" $f)" || bad "$name: $f changed from $(field "$before" $f) to $(field "$after" $f)"
  done
  [ "$(field "$after" jumps)" = "$(field "$before" jumps)" ] && ok "$name: no list was thrown back to its top ($(field "$after" jumps) jumps)" || bad "$name: a list jumped back to its top while the theme went on (jumps $(field "$before" jumps) -> $(field "$after" jumps))"
  [ "$(field "$after" col)" = "1" ] && ok "$name: the cursor is still on the theme list" || bad "$name: the cursor left the theme list"
  local sel on
  sel=$(echo "$after" | sed 's/.* sel=//; s/ (changed)$//'); on=$(ipc look | tail -1 | sed 's/^[^|]*|//')
  [ -n "$sel" ] && [ "$on" = "$sel" ] && ok "$name: the chosen theme ($sel) is the one on" || bad "$name: chosen '$sel' but the look on is '$on'"
  wtype -k Left; sleep 0.8
}

# a look the user has changed (Save as new / Revert are showing): choosing a theme drops them and shows Undo
ipc theme 5; sleep 5; ipc wallpaper deepblue; sleep 5
case_run changed 1 themes 12
case_run all 1 themes 40
# walk down All themes choosing one after another (each brings its own chips): the number of rows never changes and no list is thrown back to its top
wtype 1; sleep 1; wtype -k Right; sleep 0.8
for n in $(seq 1 30); do wtype -k Down; sleep 0.2; done; sleep 1
w0=$(state)
for n in $(seq 1 8); do
  wtype -k Down; sleep 0.4; wtype ' '; sleep 2.5
  w=$(state)
  [ "$(field "$w" rows)" = "$(field "$w0" rows)" ] || bad "walk step $n: the list shows $(field "$w" rows) rows, it showed $(field "$w0" rows)"
  [ "$(field "$w" jumps)" = "$(field "$w0" jumps)" ] || bad "walk step $n: a list jumped back to its top"
  [ "$(field "$w" cat)" = "$(field "$w0" cat)" ] || bad "walk step $n: the category changed from $(field "$w0" cat) to $(field "$w" cat)"
done
[ "$fail" = 0 ] && ok "walk: 8 themes chosen in a row, rows stay $(field "$w0" rows), no jumps"
wtype -k Left; sleep 0.8
case_run mine 3 "cat:Shelf" 14
grp=$(awk -F'|' '!/^#/ && NF >= 2 {print $1; exit}' "${PLUGIN_DIR:-$HOME/.config/omarchy/plugins/$S}/starter-theme-categories")
case_run group 4 "cat:$grp" 6

errs=$(log | tail -n +$((mark + 1)) | grep -E "Core.qml|ReferenceError|TypeError|is not a type|unavailable" | head -5)
[ -z "$errs" ] && ok "no menu errors in the shell log" || bad "log: $errs"
ipc close 2>/dev/null
exit $fail
