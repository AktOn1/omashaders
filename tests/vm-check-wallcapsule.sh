#!/usr/bin/env bash
# vm-check-timeout: 600
# VM check for the Wallhaven capsule above the Wallpaper tab and for themes keeping their Wallhaven id. Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-wallcapsule.sh" "$d/vm-check.sh" && vm-test "$d"
# Needs the network (downloads one ~2.5 MB Wallhaven picture, id jelj7w, inside the throwaway VM). Wallhaven being down is simulated with /etc/hosts.
# Done looks like: no Wallhaven id -> no capsule; id and picture not on disk -> "Download and set"; on disk, other picture on screen -> "Set wallpaper";
# already the wallpaper -> "Wallpaper set" (disabled); wallhaven.cc not answering -> error with Retry; the H key and the button do the same; the hint strip lists H;
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
printf '|neonrain||neon-noir|WH Theme||||fx=60,wall=65,wh=%s\n|neonrain||neon-noir|Plain Theme||||fx=50\n' "$WH" > "$st/themes"
rm -f "$st/theme-categories" "$st/sections"
hostipc reload >/dev/null 2>&1; sleep 10
# the helper scripts write __pycache__ into the plugin folder and the shell reloads a plugin whose folder changes: stop that
pd=${PLUGIN_DIR:-$HOME/.config/omarchy/plugins/$S}
find "$pd" -name '*.py' | while read -r f; do mkdir -p "$(dirname "$f")/__pycache__"; done
find "$pd" -name __pycache__ -type d | while read -r d; do rm -f "$d"/*; chmod a-w "$d"; done
hostipc reload >/dev/null 2>&1; sleep 10
otherbg

# ---- 1. a theme without a Wallhaven id: no capsule
ipc theme 2 >/dev/null; sleep 3
for i in 1 2 3 4 5 6; do ipc open >/dev/null 2>&1; sleep 3; [ "$(field "$(ipc themeMenu | tail -1)" open)" = true ] && break; done
cursor_to "Plain Theme" && ok "cursor is on Plain Theme" || bad "could not put the cursor on Plain Theme: $(ipc themeMenu | tail -1)"
sleep 1; echo "plain: $(cap)"
[ "$(field "$(cap)" visible)" = false ] && [ "$(field "$(cap)" kind)" = none ] && ok "no Wallhaven id: no capsule" || bad "capsule shown for a theme without an id: $(cap)"
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

# ---- 6. saving keeps the id even when the picture is not on screen and not on disk
otherbg
rm -rf "$st/wallhaven/full" "$st/wallhaven/used"
reopen; ipc theme 1 >/dev/null; sleep 3
ipc set moonlight >/dev/null; sleep 3
ipc theme save >/dev/null; sleep 3
n=$(grep -c "wh=$WH" "$st/themes")
[ "$n" -ge 2 ] && ok "Save as new kept wh=$WH ($n lines carry it)" || { bad "Save as new dropped the Wallhaven id"; cat "$st/themes"; }
grep -v "wh=$WH" "$st/themes" | grep -q 'fx=50' && ok "the plain theme still has no id" || bad "the plain theme changed"

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
