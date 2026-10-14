#!/usr/bin/env bash
# Runs in the Omarchy VM: a cursor Trail effect must leave marks along the path behind the pointer (the pointer history
# once held references to the live pointer, so every sample sat at the pointer and trails were a flash around it).
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
dir=${PLUGIN_DIR:-$HOME/.config/omarchy/plugins/$S}
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
fail=0
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
sweep() { for i in $(seq 0 22); do hyprctl dispatch "hl.dsp.cursor.move({x=$((150 + i * 35)),y=$((400 + (i % 4) * 8))})" >/dev/null 2>&1; sleep 0.1; done; }
sleep 6
bash "$dir/bin/omashaders" mouse off >/dev/null 2>&1; sleep 3
sweep; sleep 3; grim -t ppm /tmp/trail-off.ppm
mark=$(log | wc -l)
for fx in comet star-dust; do
  bash "$dir/bin/omashaders" mouse set $fx >/dev/null 2>&1; sleep 4
  sweep; grim -t ppm /tmp/trail-$fx.ppm; grim "$out/trail-$fx.png"
  n=$(python3 - /tmp/trail-off.ppm /tmp/trail-$fx.ppm <<'PY'
import sys
def load(p):
    d = open(p, "rb").read()
    parts = d.split(None, 4)
    w, h = int(parts[1]), int(parts[2])
    return w, d[len(d) - w * h * 3:]
w, a = load(sys.argv[1])
_, b = load(sys.argv[2])
n = 0
for y in range(340, 470):  # the path runs left to right at about y 400-430; look only 220 px or more behind the end point (x 920)
    for x in range(140, 700):
        o = (y * w + x) * 3
        if abs(a[o] - b[o]) + abs(a[o + 1] - b[o + 1]) + abs(a[o + 2] - b[o + 2]) > 24:
            n += 1
print(n)
PY
)
  [ "${n:-0}" -gt 150 ] && ok "$fx drew a trail along the path ($n changed pixels far behind the pointer)" || bad "$fx left almost nothing behind the pointer ($n changed pixels)"
done
bash "$dir/bin/omashaders" mouse off >/dev/null 2>&1
bad_log=$(log | tail -n +$((mark + 1)) | grep -iE "ERROR|qsb|ReferenceError|TypeError" | head -5)
[ -n "$bad_log" ] && bad "errors in the shell log: $bad_log" || ok "no errors in the shell log"
exit $fail
