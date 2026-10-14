#!/usr/bin/env bash
# VM check: "pause while fullscreen" only switches the effects off on the monitor that shows the fullscreen window. Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-fullscreen-monitor.sh" "$d/vm-check.sh" && vm-test "$d"
# Makes a second (headless) monitor, puts a fullscreen window on it, and reads one pixel of each monitor with grim.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
st=$HOME/.local/state/omarchy/$S
dest=$HOME/.config/omarchy/plugins/$S
bin=$dest/bin
fail=0
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
px() { grim -o "$1" "$out/px-$1.png"; magick "$out/px-$1.png" -resize 1x1! -format '%[pixel:p{0,0}]' info:; }
red() { [ "$(px "$1")" = "srgb(255,0,0)" ]; }
wait_for() { local t=$1; while [ "$t" -gt 0 ]; do eval "$2" >/dev/null 2>&1 && return 0; sleep 1; t=$((t - 1)); done; return 1; }

cat > "$dest/shaders/zz-test-red.frag" <<'EOF'
#version 300 es
// category: Test
// strength: 100
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() { vec4 s = texture(tex, v_texcoord); fragColor = vec4(1.0, 0.0, 0.0, s.a); }
EOF
hyprctl output create headless >/dev/null 2>&1; sleep 2
first=$(hyprctl -j monitors | python3 -c 'import json,sys; m=json.load(sys.stdin); print(next(x["name"] for x in m if x["id"]==0))')
read -r second sid < <(hyprctl -j monitors | python3 -c 'import json,sys; m=json.load(sys.stdin); x=next(x for x in m if x["id"]!=0); print(x["name"], x["id"])')
"$bin/omashaders" set zz-test-red >/dev/null
wait_for 5 "red $first && red $second" && ok "both monitors show the screen shader" || bad "screen shader missing at the start"

"$bin/omashaders" fullscreen on
# the shell's watcher only starts once the setting is seen; toggling rewrites the file so it is noticed
"$bin/omashaders" fullscreen off; sleep 1; "$bin/omashaders" fullscreen on; sleep 3
hyprctl eval "hl.exec_cmd(\"foot -T fsone\", {monitor=\"$second\", fullscreen=true})" >/dev/null
if wait_for 20 "[ \"\$(cat '$st/fs-paused' 2>/dev/null)\" = '$sid' ]"; then
  ok "fs-paused names monitor id $sid"
  wait_for 5 "! red $second" && ok "$second (fullscreen) lost the screen shader" || bad "$second still has the shader"
  red "$first" && ok "$first (no fullscreen window) keeps it" || bad "$first lost the shader too"
else
  bad "fs-paused never got monitor id $sid ($(cat "$st/fs-paused" 2>/dev/null))"
fi

pkill -x foot; sleep 3
wait_for 15 "[ ! -s '$st/fs-paused' ]" && ok "fs-paused cleared after the window closed" || bad "fs-paused not cleared"
wait_for 5 "red $second" && ok "$second has the shader again" || bad "$second did not get the shader back"

"$bin/omashaders" fullscreen off; "$bin/omashaders" off >/dev/null 2>&1; rm -f "$dest/shaders/zz-test-red.frag"
hyprctl output remove "$second" >/dev/null 2>&1
exit $fail
