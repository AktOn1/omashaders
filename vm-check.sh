#!/usr/bin/env bash
# Runs inside the Omarchy VM: wallpaper effect with the Speed and Zoom options must render without shader errors.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
state=$HOME/.local/state/omarchy/$S
shot() { grim "$out/$1.png"; }
ipc() { omarchy-shell "$S" "$@"; }
mark=$(quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null | wc -l)
mkdir -p "$state"
ipc wallpaper aurora; sleep 3; shot wall-zoom100
echo 200 > "$state/wall-zoom"; sleep 3; shot wall-zoom200
echo 50 > "$state/wall-zoom"; echo 300 > "$state/wall-speed"; sleep 3; shot wall-zoom50
bad=$(quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null | tail -n +$((mark + 1)) | grep -iE "shader|uniform|qsb|ShaderEffect" | head -5)
ipc wallpaper off; echo 100 > "$state/wall-zoom"; echo 100 > "$state/wall-speed"
if [ -n "$bad" ]; then echo "shader errors in the shell log:"; echo "$bad"; exit 1; fi
echo "aurora rendered at zoom 100/200/50 and speed 300 with no shader errors (see wall-zoom*.png)"
