#!/usr/bin/env bash
# vm-check-timeout: 600
# VM check for the Wallhaven capsule above the Wallpaper tab and for themes keeping their Wallhaven id. Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-wallcapsule.sh" "$d/vm-check.sh" && vm-test "$d"
# Needs the network (downloads one ~2.5 MB Wallhaven picture, id jelj7w, inside the throwaway VM). Wallhaven being down is simulated with /etc/hosts.
# Done looks like: no Wallhaven id -> muted "No Wallhaven picture saved for this theme" (capsule always visible, no H key); a Wallhaven picture on screen and the theme has none ->
# "Remember Wallhaven <id> for this theme" (button and H write wh= into the theme; a built-in theme is copied as "<name> (mine)"); id and picture not on disk -> "Download and set"; on disk, other picture on screen -> "Set wallpaper";
# already the wallpaper -> "Wallpaper set" (disabled); wallhaven.cc not answering -> error with Retry; the H key and the button do the same; the hint strip lists H;
# F on a look that already is a saved theme attaches the on-screen id; the "Use theme wallpapers" checkbox (key L) is in the capsule row and writes useThemeWallpaper in shell.json (off by default);
# Save as new and Duplicate keep wh=; the legend reads "edit and save yours with F" with the dev switch on and "Duplicate to change" without it.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
st=$HOME/.local/state/omarchy/$S
WH=jelj7w
shot() { grim "$out/$1.png"; }
ipc() { omarchy-shell "$S" "$@"; }
hostipc() { omarchy-shell "$S-host" "$@"; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
fail=0
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
mark=$(log | wc -l)
field() { echo "$1" | tr ' ' '\n' | sed -n "s/^$2=//p" | head -1; }
cap() { local i r; for i in 1 2 3 4 5; do r=$(ipc wallCap 2>&1 | tail -1); case $r in visible=*) echo "$r"; return;; esac; sleep 1; done; echo "$r"; }
wait_kind() { local t=$1 k=$2; while [ "$t" -gt 0 ]; do [ "$(field "$(cap)" kind)" = "$k" ] && return 0; sleep 1; t=$((t - 1)); done; return 1; }
bg() { readlink -f "$HOME/.local/state/omarchy/current/background" 2>/dev/null; }
block() { echo tester | sudo -S sh -c 'grep -q "wallhaven.cc" /etc/hosts || echo "0.0.0.0 wallhaven.cc w.wallhaven.cc" >> /etc/hosts' >/dev/null 2>&1; }
unblock() { echo tester | sudo -S sed -i '/wallhaven.cc/d' /etc/hosts >/dev/null 2>&1; echo tester | sudo -S resolvectl flush-caches >/dev/null 2>&1
  local t; for t in $(seq 1 60); do curl -sI -m 5 -o /dev/null https://wallhaven.cc && return 0; sleep 2; done; return 1; }
mkdir -p "$st"

# a picture that is not from Wallhaven, to put on screen
python3 - <<'EOF'
import struct, zlib
def chunk(t, d): c = struct.pack(">I", len(d)) + t + d; return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
w = h = 64
raw = b"".join(b"\x00" + bytes([40, 60, 90]) * w for _ in range(h))
open("/tmp/other-bg.png", "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))
EOF
otherbg() { omarchy-theme-bg-set /tmp/other-bg.png >/dev/null 2>&1; sleep 1; }
# put the cursor of the Themes list on the theme called $1
cursor_to() { local n; wtype 1; sleep 1; wtype -k Right; sleep 0.8; for n in 1 2 3 4 5 6; do wtype -k Up; sleep 0.2; done
  for n in 1 2 3 4 5 6; do ipc themeMenu | tail -1 | grep -Eq "sel=$1( \(changed\))?\$" && return 0; wtype -k Down; sleep 0.6; done; return 1; }
reopen() { ipc close >/dev/null 2>&1; sleep 1.5; ipc open >/dev/null 2>&1; sleep 3.5; }

rm -f "$st/dev-export"
rm -rf "$st/wallhaven/full" "$st/wallhaven/used"
printf '|neonrain||neon-noir|WH Theme||||fx=60,wall=65,wh=%s\n|neonrain||neon-noir|Plain Theme||||fx=50\n|neonrain||neon-noir|Second Plain||||fx=40\n' "$WH" > "$st/themes"
head -1 "${PLUGIN_DIR:-$HOME/.config/omarchy/plugins/$S}/starter-themes" >> "$st/themes"
rm -f "$st/theme-categories" "$st/sections"
hostipc reload >/dev/null 2>&1; sleep 10
# the helper scripts write __pycache__ into the plugin folder and the shell reloads a plugin whose folder changes: stop that
pd=${PLUGIN_DIR:-$HOME/.config/omarchy/plugins/$S}
find "$pd" -name '*.py' | while read -r f; do mkdir -p "$(dirname "$f")/__pycache__"; done
find "$pd" -name __pycache__ -type d | while read -r d; do rm -f "$d"/*; chmod a-w "$d"; done
hostipc reload >/dev/null 2>&1; sleep 10
otherbg

# ---- 1. a theme without a Wallhaven id: the capsule says so
ipc theme 2 >/dev/null; sleep 3
for i in 1 2 3 4 5 6; do ipc open >/dev/null 2>&1; sleep 3; [ "$(field "$(ipc themeMenu | tail -1)" open)" = true ] && break; done
cursor_to "Plain Theme" && ok "cursor is on Plain Theme" || bad "could not put the cursor on Plain Theme: $(ipc themeMenu | tail -1)"
sleep 1; echo "plain: $(cap)"
[ "$(field "$(cap)" visible)" = true ] && [ "$(field "$(cap)" kind)" = none ] && [ "$(field "$(cap)" label)" = No_Wallhaven_picture_saved_for_this_theme ] && [ "$(field "$(cap)" enabled)" = false ] && ok "no Wallhaven id: capsule says so, no action" || bad "wrong capsule for a theme without an id: $(cap)"
shot cap-1-no-wh
ipc hints | grep -q 'fkeys=[^ ]*H' && bad "H is listed in the hint strip for a theme without an id: $(ipc hints)" || ok "no id: H is not in the hint strip"

# ---- 2. a theme with an id, picture not on disk: Download and set; nothing was downloaded
ipc theme 1 >/dev/null; sleep 3; reopen; cursor_to "WH Theme" || bad "could not put the cursor on WH Theme"; sleep 1
echo "wh, not cached: $(cap)"
[ "$(field "$(cap)" visible)" = true ] && [ "$(field "$(cap)" kind)" = download ] && [ "$(field "$(cap)" label)" = Download_and_set ] && [ "$(field "$(cap)" wh)" = "$WH" ] && ok "id, not on disk: Download and set" || bad "wrong capsule for a picture not on disk: $(cap)"
[ ! -e "$st/wallhaven/full/wallhaven-$WH.png" ] && [ ! -e "$st/wallhaven/full/wallhaven-$WH.jpg" ] && ok "nothing was downloaded by showing the capsule" || bad "the picture was downloaded before the button was pressed"
shot cap-2-download
ipc hints | grep -q 'fkeys=[^ ]*H' && ok "the hint strip lists H" || bad "H missing from the hint strip: $(ipc hints)"
echo "hints: $(ipc hints)"

# ---- 3. wallhaven.cc not answering: the error and a retry
block
before=$(bg)
wtype H; sleep 1; echo "busy: $(cap)"; shot cap-3-busy
wait_kind 90 error && ok "wallhaven.cc not answering: error state" || bad "no error state: $(cap)"
[ "$(field "$(cap)" label)" = Wallhaven_did_not_answer._Retry ] && ok "the error says to retry" || bad "error label: $(cap)"
[ "$(bg)" = "$before" ] && ok "the wallpaper stayed as it was" || bad "the wallpaper changed although the download failed"
shot cap-4-error
unblock

# ---- 4. Retry: downloads and sets
echo "before retry: $(cap) hosts: $(grep -c wallhaven.cc /etc/hosts)"
wtype H; sleep 1; echo "busy (download): $(cap)"; shot cap-4b-busy
wait_kind 150 current || { echo "retry state: $(cap)"; python3 "$HOME/.config/omarchy/plugins/$S/bin/wallhaven" use "$WH" 2>&1 | tail -3; ls -la "$st/wallhaven/full" "$st/wallhaven/used" 2>&1 | tail -8; }
wait_kind 5 current && ok "Retry downloaded and set the picture: Wallpaper set" || bad "Retry did not end in 'current': $(cap)"
case "$(bg)" in *wallhaven-$WH.*) ok "the wallpaper is $(basename "$(bg)")";; *) bad "the wallpaper is $(bg)";; esac
[ "$(field "$(cap)" enabled)" = false ] && ok "Wallpaper set is disabled" || bad "button still enabled: $(cap)"
[ "$(field "$(cap)" label)" = Wallpaper_set ] && ok "label reads Wallpaper set" || bad "label: $(cap)"
sleep 1; shot cap-5-current
wtype H; sleep 2
[ "$(field "$(cap)" kind)" = current ] && ok "H on a set picture does nothing" || bad "H changed the state: $(cap)"

# ---- 5. on disk, another picture on screen: Set wallpaper (no download)
otherbg; reopen
echo "cached, other bg: $(cap)"
[ "$(field "$(cap)" kind)" = set ] && [ "$(field "$(cap)" label)" = Set_wallpaper ] && ok "on disk, other picture on screen: Set wallpaper" || bad "wrong capsule: $(cap)"
shot cap-6-set
block
wtype H; wait_kind 30 current && ok "Set wallpaper works with no network" || bad "Set wallpaper needed the network: $(cap)"
unblock
sleep 1; shot cap-7-set-done

# ---- 5b. Wallhaven picture on screen, theme without an id: Remember writes wh= into it (H and the button do the same)
reopen
cursor_to "Plain Theme" || bad "could not put the cursor on Plain Theme"; sleep 1
echo "remember: $(cap)"
[ "$(field "$(cap)" kind)" = remember ] && [ "$(field "$(cap)" label)" = "Remember_Wallhaven_${WH}_for_this_theme" ] && [ "$(field "$(cap)" enabled)" = true ] && ok "picture on screen, theme without id: Remember offer" || bad "wrong capsule: $(cap)"
ipc hints | grep -q 'fkeys=[^ ]*H' && ok "the hint strip lists H for the remember offer" || bad "H missing from the hint strip: $(ipc hints)"
shot cap-6b-remember
cp "$st/themes" /tmp/themes-before-remember
wtype H; sleep 2
grep -q "Plain Theme||||fx=50,wh=$WH" "$st/themes" && ok "H wrote wh=$WH into Plain Theme" || { bad "Plain Theme did not get the id"; cat "$st/themes"; }
[ "$(grep -c 'Plain Theme' "$st/themes")" = 1 ] && grep -q "Second Plain||||fx=40$" "$st/themes" && ok "other themes untouched, no duplicate" || bad "themes file changed more than it should"
sleep 1; echo "after remember: $(cap)"
[ "$(field "$(cap)" kind)" = current ] && [ "$(field "$(cap)" wh)" = "$WH" ] && ok "the capsule now shows the theme's picture (Wallpaper set)" || bad "capsule after remember: $(cap)"
shot cap-6c-remembered
# a built-in theme stays as it is: a copy is saved
cursor_to "whiteout" || bad "could not put the cursor on whiteout"; sleep 1
[ "$(field "$(cap)" kind)" = remember ] && ok "built-in theme without id also offers Remember" || bad "built-in: $(cap)"
wtype H; sleep 2
grep -q "^noir|warp|comet|invert|whiteout$" "$st/themes" && ok "the built-in whiteout line is unchanged" || bad "built-in line changed"
grep -q "^noir|warp|comet|invert|whiteout (mine)||||wh=$WH$" "$st/themes" && ok "copy 'whiteout (mine)' saved with wh=$WH" || { bad "no copy of the built-in theme"; tail -3 "$st/themes"; }
shot cap-6d-builtin-copy

# ---- 5c. F on a look that already is a saved theme (it only lacks the Wallhaven picture on screen): attaches the id instead of "Already saved"
python3 "$pd/bin/wallhaven" use "$WH" >/dev/null 2>&1; sleep 2
ipc theme 3 >/dev/null; sleep 3
reopen
echo "look: $(ipc look) / $(cap)"
[ "$(field "$(cap)" current)" = "$WH" ] && ok "the Wallhaven picture is on screen" || bad "no Wallhaven picture on screen: $(cap)"
grep -q "Second Plain||||fx=40$" "$st/themes" && ok "Second Plain has no id yet" || bad "Second Plain: $(grep 'Second Plain' "$st/themes")"
wtype F; sleep 2
grep -q "Second Plain||||fx=40,wh=$WH$" "$st/themes" && ok "F attached wh=$WH to Second Plain" || { bad "F did not attach the id"; grep 'Second Plain' "$st/themes"; }
[ "$(grep -c 'Second Plain' "$st/themes")" = 1 ] && ok "no duplicate theme made by F" || bad "F duplicated the theme"
wtype F; sleep 2
[ "$(grep -c "Second Plain||||fx=40,wh=$WH$" "$st/themes")" = 1 ] && [ "$(grep -c 'Second Plain' "$st/themes")" = 1 ] && ok "F again changes nothing (already saved)" || bad "second F changed the themes"
shot cap-6e-f-attached

# ---- 5d. the "Use theme wallpapers" checkbox: in the capsule row, same setting as the Omarchy settings screen, off by default, key L
cfg=$HOME/.config/omarchy/shell.json
inset() { jq -r '[.. | objects | select(.id? == "io.github.akton1.omashaders")][0].useThemeWallpaper | tostring' "$cfg"; }
jq '(.. | objects | select(.id? == "io.github.akton1.omashaders")) += {keepMe: 7}' "$cfg" >"$cfg.tmp" && mv "$cfg.tmp" "$cfg"; sleep 4
reopen
c=$(cap); echo "checkbox: $c"
[ "$(field "$c" box)" = true ] && ok "the checkbox is in the capsule row" || bad "no checkbox: $c"
[ "$(field "$c" auto)" = false ] && ok "off by default" || bad "not off by default: $c"
[ $(( $(field "$c" x) + $(field "$c" w) )) -le "$(field "$c" boxx)" ] && ok "the checkbox does not overlap the capsule" || bad "checkbox overlaps the capsule: $c"
ipc hints | grep -q 'fkeys=[^ ]*L' && ok "the hint strip lists L" || bad "L missing from the hint strip: $(ipc hints)"
shot cap-10-checkbox-off
wtype L; sleep 2
[ "$(field "$(cap)" auto)" = true ] && ok "L turns it on in the menu" || bad "L did not turn it on: $(cap)"
[ "$(inset)" = true ] && ok "shell.json now has useThemeWallpaper true (the Omarchy settings screen shows the same value)" || bad "shell.json: $(inset)"
[ "$(jq -r '[.. | objects | select(.id? == "io.github.akton1.omashaders")][0].keepMe' "$cfg")" = 7 ] && ok "the entry's other settings stayed" || bad "another key of the entry was lost"
shot cap-11-checkbox-on
wtype L; sleep 2
[ "$(field "$(cap)" auto)" = false ] && [ "$(inset)" = false ] && ok "L turns it off again, in the menu and in shell.json" || bad "off: $(cap) / $(inset)"
ipc autoWallpaper on >/dev/null; sleep 2
[ "$(field "$(cap)" auto)" = true ] && [ "$(inset)" = true ] && ok "on from the command line too" || bad "ipc on: $(cap) / $(inset)"
# a change made in the Omarchy settings screen (a shell.json edit) shows in the menu
jq '(.. | objects | select(.id? == "io.github.akton1.omashaders")) += {useThemeWallpaper: false}' "$cfg" >"$cfg.tmp" && mv "$cfg.tmp" "$cfg"; sleep 6
[ "$(field "$(cap)" auto)" = false ] && ok "turning it off in shell.json shows in the menu" || bad "menu did not follow shell.json: $(cap)"

# ---- 6. saving keeps the id even when the picture is not on screen and not on disk
otherbg
rm -rf "$st/wallhaven/full" "$st/wallhaven/used"
reopen; ipc theme 1 >/dev/null; sleep 3
ipc set moonlight >/dev/null; sleep 3
ipc theme save >/dev/null; sleep 3
n=$(grep -c "wh=$WH" "$st/themes")
[ "$n" -ge 2 ] && ok "Save as new kept wh=$WH ($n lines carry it)" || { bad "Save as new dropped the Wallhaven id"; cat "$st/themes"; }
[ "$(grep -c 'Second Plain' "$st/themes")" = 1 ] && ok "Save as new did not copy the other themes" || bad "Second Plain is there more than once"

# ---- 7. Duplicate keeps the id
ipc close >/dev/null 2>&1; sleep 1.5; ipc open >/dev/null 2>&1; sleep 3
cursor_to "WH Theme" || bad "could not put the cursor on WH Theme"
echo "cursor on: $(ipc themeMenu | tail -1)"
wtype N; sleep 1.5; shot cap-8-duplicate
wtype -M ctrl a -m ctrl 2>/dev/null; wtype "Dup copy"; sleep 0.5; wtype -k Return; sleep 3
grep "Dup copy" "$st/themes" | grep -q "wh=$WH" && ok "Duplicate kept wh=$WH" || bad "Duplicate dropped the id: $(grep 'Dup copy' "$st/themes")"
ipc close >/dev/null 2>&1; sleep 1

# ---- 8. the legend: Duplicate to change for everyone, "edit and save yours with F" with the dev switch
ipc open >/dev/null 2>&1; sleep 3
ipc hints | grep -q 'legendtext=built_in_(Duplicate_to_change)' && ok "without the dev switch the legend says Duplicate to change" || bad "legend: $(ipc hints)"
ipc close >/dev/null 2>&1; sleep 1
touch "$st/dev-export"; hostipc reload >/dev/null 2>&1; sleep 10
ipc open >/dev/null 2>&1; sleep 3
ipc hints | grep -q 'legendtext=built_in_(edit_and_save_yours_with_F)' && ok "with the dev switch the legend says edit and save yours with F" || bad "legend with the dev switch: $(ipc hints)"
shot cap-9-legend-dev
ipc close >/dev/null 2>&1; rm -f "$st/dev-export"

errs=$(log | tail -n +$((mark + 1)) | grep -E "Core.qml|ReferenceError|TypeError|is not a type|unavailable|QML file has errors" | head -5)
[ -z "$errs" ] && ok "no menu errors in the shell log" || bad "log: $errs"
unblock
exit $fail
