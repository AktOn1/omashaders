#!/usr/bin/env bash
# vm-check-timeout: 600
# VM check for the plugin setting "Use theme wallpaper when available" (useThemeWallpaper, off by default). Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-themewallpaper.sh" "$d/vm-check.sh" && vm-test "$d"
# Needs the network (downloads one ~2.5 MB Wallhaven picture, id jelj7w, inside the throwaway VM). Wallhaven being down is simulated with /etc/hosts.
# Done looks like: setting off (default) -> applying a theme with a Wallhaven id never touches the wallpaper and downloads nothing;
# on -> the picture is downloaded and set; a theme without an id leaves the wallpaper alone; wallhaven.cc not answering -> the theme still applies,
# the wallpaper stays, the capsule shows Retry.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
st=$HOME/.local/state/omarchy/$S
cfg=$HOME/.config/omarchy/shell.json
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
wait_for() { local t=$1; while [ "$t" -gt 0 ]; do eval "$2" >/dev/null 2>&1 && return 0; sleep 1; t=$((t - 1)); done; return 1; }
bg() { readlink -f "$HOME/.local/state/omarchy/current/background" 2>/dev/null; }
block() { echo tester | sudo -S sh -c 'grep -q "wallhaven.cc" /etc/hosts || echo "0.0.0.0 wallhaven.cc w.wallhaven.cc" >> /etc/hosts' >/dev/null 2>&1; }
unblock() { echo tester | sudo -S sed -i '/wallhaven.cc/d' /etc/hosts >/dev/null 2>&1; echo tester | sudo -S resolvectl flush-caches >/dev/null 2>&1
  local t; for t in $(seq 1 60); do curl -sI -m 5 -o /dev/null https://wallhaven.cc && return 0; sleep 2; done; return 1; }
# the plugin setting, the way the settings UI stores it; with no key at all the default (off) must hold
setting() { # on | off | unset
  case $1 in
    unset) jq '(.. | objects | select(.id? == "io.github.akton1.omashaders")) |= del(.useThemeWallpaper)' "$cfg" >"$cfg.tmp" ;;
    *) jq --argjson v "$([ "$1" = on ] && echo true || echo false)" '(.. | objects | select(.id? == "io.github.akton1.omashaders")) += {useThemeWallpaper: $v}' "$cfg" >"$cfg.tmp" ;;
  esac && mv "$cfg.tmp" "$cfg"
  local want=false; [ "$1" = on ] && want=true
  wait_for 25 "[ \"\$(omarchy-shell $S wallCap 2>&1 | tail -1 | tr ' ' '\\n' | sed -n 's/^auto=//p')\" = $want ]" || { hostipc reload >/dev/null 2>&1; sleep 10; }
  [ "$(field "$(cap)" auto)" = $want ] && ok "setting is $1 (auto=$want)" || bad "setting $1 did not reach the menu: $(cap)"
}
mkdir -p "$st"
python3 - <<'PY'
import struct, zlib
def chunk(t, d): c = struct.pack(">I", len(d)) + t + d; return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
w = h = 64
raw = b"".join(b"\x00" + bytes([40, 60, 90]) * w for _ in range(h))
open("/tmp/other-bg.png", "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))
PY
otherbg() { omarchy-theme-bg-set /tmp/other-bg.png >/dev/null 2>&1; sleep 1; }
rm -f "$st/dev-export"; rm -rf "$st/wallhaven/full" "$st/wallhaven/used"
printf '|neonrain||neon-noir|WH Theme||||fx=60,wall=65,wh=%s\n|neonrain||neon-noir|Plain Theme||||fx=50\n' "$WH" > "$st/themes"
rm -f "$st/theme-categories" "$st/sections"
hostipc reload >/dev/null 2>&1; sleep 10
pd=${PLUGIN_DIR:-$HOME/.config/omarchy/plugins/$S}
find "$pd" -name '*.py' | while read -r f; do mkdir -p "$(dirname "$f")/__pycache__"; done
find "$pd" -name __pycache__ -type d | while read -r d; do rm -f "$d"/*; chmod a-w "$d"; done
hostipc reload >/dev/null 2>&1; sleep 10
otherbg
base=$(bg)
downloaded() { ls "$st"/wallhaven/full/wallhaven-$WH.* "$st"/wallhaven/used/wallhaven-$WH.* >/dev/null 2>&1; }

# ---- 1. no key in the settings at all: off by default
setting unset
ipc wallpaper aurora >/dev/null; sleep 3
ipc theme 1 >/dev/null; sleep 12
[ "$(bg)" = "$base" ] && ok "default (off): applying a theme with a Wallhaven id left the wallpaper alone" || bad "wallpaper changed with the setting unset: $(bg)"
downloaded && bad "default (off): the picture was downloaded" || ok "default (off): nothing was downloaded"
[ "$(cat "$st/wp-effect" 2>/dev/null)" = neonrain ] && ok "the theme itself was applied (wallpaper effect neonrain)" || bad "theme not applied: $(cat "$st/wp-effect" 2>/dev/null)"
shot auto-1-default-off
setting off
ipc theme 2 >/dev/null; sleep 3; ipc theme 1 >/dev/null; sleep 10
[ "$(bg)" = "$base" ] && ! downloaded && ok "explicitly off: same" || bad "explicitly off: wallpaper $(bg), downloaded=$(downloaded && echo yes || echo no)"

# ---- 2. on, theme without an id: wallpaper stays
setting on
ipc theme 1 >/dev/null; sleep 3
rm -rf "$st/wallhaven/full" "$st/wallhaven/used"; otherbg; base=$(bg)
ipc theme 2 >/dev/null; sleep 10
[ "$(bg)" = "$base" ] && ! downloaded && ok "on, theme without an id: wallpaper untouched, nothing downloaded" || bad "a theme without an id touched the wallpaper: $(bg)"

# ---- 3. on, wallhaven.cc not answering: theme applies, wallpaper stays, capsule offers Retry
block
ipc wallpaper aurora >/dev/null; sleep 3
ipc theme 1 >/dev/null
wait_for 90 "[ \"\$(omarchy-shell $S wallCap 2>&1 | tail -1 | tr ' ' '\\n' | sed -n 's/^kind=//p')\" = error ]" && ok "on, Wallhaven down: capsule shows the error state" || bad "no error state: $(cap)"
[ "$(field "$(cap)" label)" = Wallhaven_did_not_answer._Retry ] && ok "the capsule says Retry" || bad "capsule label: $(cap)"
[ "$(bg)" = "$base" ] && ok "on, Wallhaven down: wallpaper stayed" || bad "wallpaper changed although the download failed: $(bg)"
[ "$(cat "$st/wp-effect" 2>/dev/null)" = neonrain ] && ok "on, Wallhaven down: the theme still applied" || bad "theme not applied: $(cat "$st/wp-effect" 2>/dev/null)"
shot auto-2-error
unblock

# ---- 4. on, picture not on disk: applying the theme downloads and sets it
ipc theme 2 >/dev/null; sleep 3
ipc theme 1 >/dev/null
wait_for 150 "case \"\$(readlink -f $HOME/.local/state/omarchy/current/background)\" in *wallhaven-$WH.*) true;; *) false;; esac" && ok "on: applying the theme downloaded and set Wallhaven $WH ($(basename "$(bg)"))" || bad "wallpaper after apply: $(bg) cap: $(cap)"
sleep 2; shot auto-3-set
[ "$(field "$(cap)" kind)" = current ] && ok "capsule reads Wallpaper set" || bad "capsule: $(cap)"

# ---- 5. on, picture on disk, another wallpaper on screen: set again with no network
otherbg; block
ipc theme 2 >/dev/null; sleep 3; ipc theme 1 >/dev/null
wait_for 30 "case \"\$(readlink -f $HOME/.local/state/omarchy/current/background)\" in *wallhaven-$WH.*) true;; *) false;; esac" && ok "on: a cached picture is set again without network" || bad "cached picture not set: $(bg)"
unblock

# ---- 6. off again: back to never touching the wallpaper
setting off
otherbg; base=$(bg)
ipc theme 2 >/dev/null; sleep 3; ipc theme 1 >/dev/null; sleep 10
[ "$(bg)" = "$base" ] && ok "off again: the wallpaper is left alone although the picture is on disk" || bad "off again changed the wallpaper: $(bg)"

errs=$(log | tail -n +$((mark + 1)) | grep -E "Core.qml|ReferenceError|TypeError|is not a type|unavailable|QML file has errors" | head -5)
[ -z "$errs" ] && ok "no menu errors in the shell log" || bad "log: $errs"
unblock
exit $fail
