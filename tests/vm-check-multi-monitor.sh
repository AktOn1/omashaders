#!/usr/bin/env bash
# VM check: a dimming cursor effect (Flashlight, Spotlight, Reading line) keeps the monitor without the pointer dark, and
# crossing from one monitor to the other never flashes it. Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-multi-monitor.sh" "$d/vm-check.sh" && vm-test "$d"
# Makes a second (headless) monitor, covers both with a white fullscreen window, moves the pointer, and reads pixels with grim.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
dir=${PLUGIN_DIR:-$HOME/.config/omarchy/plugins/$S}
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
fail=0
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
cmd="bash $dir/bin/omashaders"
mv_cursor() { hyprctl dispatch "hl.dsp.cursor.move({x=$1,y=$2})" >/dev/null 2>&1; }

sleep 6
hyprctl output create headless >/dev/null 2>&1; sleep 2
read -r n1 x1 w1 h1 < <(hyprctl -j monitors | python3 -c 'import json,sys; m=sorted(json.load(sys.stdin), key=lambda m: m["x"])[0]; print(m["name"], m["x"], m["width"], m["height"])')
read -r n2 x2 w2 h2 < <(hyprctl -j monitors | python3 -c 'import json,sys; m=sorted(json.load(sys.stdin), key=lambda m: m["x"])[1]; print(m["name"], m["x"], m["width"], m["height"])')
echo "monitors: $n1 at $x1 ${w1}x${h1}, $n2 at $x2 ${w2}x${h2}"
for n in $n1 $n2; do
  hyprctl eval "hl.exec_cmd(\"foot -T white-$n -o colors.background=ffffff -o colors-dark.background=ffffff -o colors.alpha=1.0\", {monitor=\"$n\", fullscreen=true})" >/dev/null 2>&1
done
sleep 12

# corner luminance (0-255) of a monitor: the pixel farthest from the pointer when the pointer is mid-screen on the other monitor
corner() { # MONITOR TAG -> prints min luminance of the four corners and the centre
  grim -o "$1" -t ppm "/tmp/mm-$2-$1.ppm" && python3 - "/tmp/mm-$2-$1.ppm" <<'PY'
import sys
d = open(sys.argv[1], "rb").read()
parts = d.split(None, 4); w, h = int(parts[1]), int(parts[2]); px = d[len(d) - w * h * 3:]
def lum(x, y):
    o = (y * w + x) * 3
    return (px[o] * 2126 + px[o + 1] * 7152 + px[o + 2] * 722) // 10000
pts = [(8, 8), (w - 9, 8), (8, h - 9), (w - 9, h - 9)]
print(min(lum(*p) for p in pts), lum(w // 2, h // 2))
PY
}
shot() { grim "$out/$1.png"; }

$cmd mouse off >/dev/null 2>&1; sleep 3
mv_cursor $((x1 + w1 / 2)) $((h1 / 2)); sleep 1
read -r base _ < <(corner $n2 base)
echo "baseline corner luminance on $n2 (effect off): $base"
[ "${base:-0}" -gt 200 ] && ok "white test window is visible (corner $base)" || bad "test window is not white (corner $base), result below is not meaningful"
shot mm-off

for fx in flashlight spotlight reading-line; do
  # the memory guard can trip on the burst of adding a monitor in the VM and clears the effect: set it again (a real bug fails every try)
  for try in 1 2 3; do
    $cmd mouse set $fx >/dev/null 2>&1; sleep 4
    mv_cursor $((x1 + w1 / 2)) $((h1 / 2)); sleep 1.5
    read -r c2 _ < <(corner $n2 a)
    [ "${c2:-255}" -lt $((base * 3 / 4)) ] && break
    echo "note: $fx not dimming on try $try (corner $c2), setting it again"; sleep 6
  done
  shot mm-$fx-cursor-on-1
  read -r c1 m1 < <(corner $n1 a)
  [ "${c2:-255}" -lt $((base * 3 / 4)) ] && ok "$fx: cursor on $n1, $n2 is dark (corner $c2 of $base)" || bad "$fx: cursor on $n1, $n2 is NOT dark (corner $c2 of $base)"
  if [ "$fx" != reading-line ]; then
    [ "${m1:-0}" -gt $((base * 3 / 4)) ] && ok "$fx: lit spot at the pointer on $n1 ($m1)" || bad "$fx: no lit spot at the pointer on $n1 ($m1)"
  fi
  # walk the pointer across the shared edge in small steps; neither monitor's far corner may ever be lit
  worst=0
  for dx in -120 -60 -20 -4 0 4 20 60 120; do
    mv_cursor $((x2 + dx)) $((h1 / 2)); sleep 0.6
    read -r a1 _ < <(corner $n1 w)
    read -r a2 _ < <(corner $n2 w)
    hi=$(( a1 > a2 ? a1 : a2 ))
    [ "$hi" -gt "$worst" ] && worst=$hi
    [ "$dx" = 0 ] && shot mm-$fx-edge
  done
  [ "$worst" -lt $((base * 3 / 4)) ] && ok "$fx: crossing the edge: far corners stay dark (brightest $worst of $base)" || bad "$fx: crossing the edge: a far corner flashed to $worst of $base"
  mv_cursor $((x2 + w2 / 2)) $((h2 / 2)); sleep 1.5
  shot mm-$fx-cursor-on-2
  read -r c1 _ < <(corner $n1 b)
  [ "${c1:-255}" -lt $((base * 3 / 4)) ] && ok "$fx: cursor on $n2, $n1 is dark (corner $c1 of $base)" || bad "$fx: cursor on $n2, $n1 is NOT dark (corner $c1 of $base)"
done
$cmd mouse off >/dev/null 2>&1
pkill -x foot; sleep 1
hyprctl output remove "$n2" >/dev/null 2>&1
exit $fail
