#!/usr/bin/env bash
# VM check for deleting themes and effects with built-in protection. Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-delete.sh" "$d/vm-check.sh" && vm-test "$d"
# Only the throwaway VM's own state folder is used.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
st=$HOME/.local/state/omarchy/$S
dest=$HOME/.config/omarchy/plugins/$S
bin=$dest/bin
shot() { grim "$out/$1.png"; }
ipc() { omarchy-shell "$S" "$@"; }
hostipc() { omarchy-shell "$S-host" "$@"; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
fail=0
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
mark=$(log | wc -l)
newlog() { log | tail -n +$((mark + 1)); }
ph() { echo "$1" > /tmp/phase; }
ph start
( last=""; while :; do p=$(pgrep -x quickshell | head -1); [ "$p" != "$last" ] && echo "[quickshell pid ${p:-none} at $(cat /tmp/phase)]" >> /tmp/pidwatch; last=$p; sleep 0.3; done ) &
mkdir -p "$st/generated/screen" "$st/generated/meta"
rm -f "$st/dev-export"

# the CLI first (same tool the menu uses)
n=$(grep -c . "$dest/starter-themes")
python3 "$bin/oms-delete" list | head -3
out1=$("$bin/omashaders" theme rm 1 --yes 2>&1); rc=$?
[ "$rc" = 1 ] && [ "$out1" = "Built-in theme, cannot be deleted" ] && ok "cli: built-in theme refused" || bad "cli: rc=$rc out=$out1"
out2=$("$bin/omashaders" element rm screen vignette --yes 2>&1); rc=$?
[ "$rc" = 1 ] && [ "$out2" = "Built-in effect, cannot be deleted" ] && [ -e "$dest/shaders/vignette.frag" ] && ok "cli: built-in effect refused" || bad "cli: effect rc=$rc out=$out2"

# does the running shell notice a changed themes file? (in place, then replaced the way oms-delete writes it)
# on a fresh install the shell started before the state files existed, so it is reloaded once
hostipc reload >/dev/null 2>&1; sleep 10
ph probe
probe() { printf '%s\n' "$1" > "$st/themes"; sleep 5; "$bin/omashaders" effect off >/dev/null 2>&1; sleep 1; ipc theme 1; sleep 4; cat "$st/current" 2>/dev/null; }
r=$(probe 'vignette||||Probe A'); echo "probe in place: current=$r"
printf 'moonlight||||Probe B\n' > "$st/.themes.tmp" && mv -f "$st/.themes.tmp" "$st/themes"; sleep 5; "$bin/omashaders" effect off >/dev/null 2>&1; sleep 1; ipc theme 1; sleep 4
r2=$(cat "$st/current" 2>/dev/null); echo "probe replaced: current=$r2"
"$bin/omashaders" effect off >/dev/null 2>&1

ph menu
# a state with the shipped themes, one of mine, one using an AI effect that is about to go
printf '// label: VM Del\n// hint: test\nvoid main() { fragColor = texture(tex, v_texcoord); }\n' > "$st/generated/screen/ai-vmdel.frag"
printf '{"id":"ai-vmdel","name":"VM Del"}\n' > "$st/generated/meta/ai-vmdel.json"
{ cat "$dest/starter-themes"; printf '\nvignette||||My Own\nai-vmdel||||Uses Gone\n'; } > "$st/themes"
sleep 6
ipc open; sleep 3
wtype -k Right 2>/dev/null; sleep 1; shot del-1-themes
before=$(md5sum < "$st/themes")
wtype -k Delete 2>/dev/null; sleep 1; wtype -k Delete 2>/dev/null; sleep 2; shot del-2-builtin-Delete
[ "$(md5sum < "$st/themes")" = "$before" ] && ok "menu: Delete on a built-in theme changed nothing" || bad "menu: built-in theme changed"
wtype f 2>/dev/null; sleep 2; shot del-3-builtin-f
[ "$(md5sum < "$st/themes")" = "$before" ] && ok "menu: f on a built-in theme changed nothing" || bad "menu: built-in theme removed by f"

ph own-theme
# my own theme: bottom of the list is 'Uses Gone', then 'My Own'
wtype G 2>/dev/null; sleep 1; wtype k 2>/dev/null; sleep 1; shot del-4-own-selected
wtype -k Delete 2>/dev/null; sleep 2; shot del-5-own-asks
grep -q "My Own" "$st/themes" && ok "menu: first Delete only asked" || bad "menu: first Delete already deleted"
wtype -k Delete 2>/dev/null; sleep 3; shot del-6-own-deleted
grep -q "My Own" "$st/themes" && bad "menu: own theme still there" || ok "menu: own theme deleted by Delete Delete"
[ "$(grep -c . "$st/themes")" -ge "$n" ] && ok "menu: the shipped themes are all still there" || bad "menu: shipped themes lost"
ipc close; sleep 1

ph effect-delete
# deleting an effect a theme uses; the theme still applies
"$bin/omashaders" element rm screen ai-vmdel 2>&1 | head -2 | tee "$out/del-prompt.txt"
grep -q "Used by theme: Uses Gone" "$out/del-prompt.txt" && ok "cli: prompt names the theme" || bad "cli: prompt: $(cat "$out/del-prompt.txt")"
"$bin/omashaders" element rm screen ai-vmdel --yes >/dev/null 2>&1
[ ! -e "$st/generated/screen/ai-vmdel.frag" ] && ok "cli: effect deleted" || bad "cli: effect file still there"
grep -q "ai-vmdel" "$st/themes" && ok "theme line still refers to the gone effect (just empty)" || bad "theme line was changed"
ph apply-gone-part
sleep 3
n2=$(grep -c . "$st/themes"); ipc theme "$n2"; sleep 4; shot del-7-theme-with-gone-part
"$bin/omashaders" effect off >/dev/null 2>&1

ph rename
# renaming a built-in theme keeps the original and adds my copy
c0=$(grep -c . "$st/themes")
ipc themeRename 1 "My Renamed Copy"; sleep 3
c1=$(grep -c . "$st/themes")
[ "$c1" = $((c0 + 1)) ] && grep -q "My Renamed Copy" "$st/themes" && ok "rename: built-in kept, own copy added" || bad "rename: count $c0 -> $c1"
head -1 "$dest/starter-themes" | grep -qF "$(sed -n 1p "$st/themes")" && ok "rename: original still first" || bad "rename: original gone"

kill %1 2>/dev/null; cat /tmp/pidwatch; cp -r "$HOME"/.cache/quickshell/crashes "$out/crashes" 2>/dev/null
newlog | grep -iE "TypeError|ReferenceError|is not a type|Core.qml.*(error|failed)|Cannot assign|Unable to assign" | head -5 | grep . && bad "QML errors in the log (above)" || ok "no QML errors in the log"
echo "screenshots: del-1 themes menu, del-2/3 built-in refused, del-4..6 own theme, del-7 theme with a gone part"
exit $fail
