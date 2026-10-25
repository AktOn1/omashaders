#!/usr/bin/env bash
# vm-check-timeout: 600
# VM check: a broken effect must never fill the disk or memory. Runs inside the VM (vm-test omashaders runs it from vm-check.sh;
# standalone: d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-fxguard.sh" "$d/vm-check.sh" && vm-test "$d").
# For wallpaper, second wallpaper and cursor effects: a pack that is missing / cut off / wrong stage / not loadable by the renderer is
# switched off by itself with ONE notice and only a few log lines, and the shell memory stays flat over 60 s.
# Then a stand-in log flood checks the guard (bin/fx-guard) end to end.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
st=$HOME/.local/state/omarchy/$S
gen=$st/generated
fail=0
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
shell_pid() { pgrep -x quickshell | head -1; }
rss_kb() { ps -o rss= -p "$(shell_pid)" 2>/dev/null | tr -d ' ' | grep . || echo 0; }
wait_for() { local t=$1; while [ "$t" -gt 0 ]; do eval "$2" >/dev/null 2>&1 && return 0; sleep 1; t=$((t - 1)); done; return 1; }
notices() { grep -rl -- "$1" "$HOME/.local/state/omarchy/notifications" 2>/dev/null | wc -l; }
mkdir -p "$gen/wall" "$gen/mouse"
hdr() { python3 - "$1" "$2" "$3" <<'PY'
import os, struct, sys, zlib
kind, path, stage = sys.argv[1], sys.argv[2], int(sys.argv[3])
data = struct.pack(">ii", 9, stage) + os.urandom(400)
good = struct.pack(">I", len(data)) + zlib.compress(data)
open(path, "wb").write({"garbage": os.urandom(3000), "cut": good[:len(good) // 2], "stage": good, "header-only": good}[kind])
PY
}

# state files the effects are read from
fxfile() { case $1 in wall) echo "$st/wp-effect" ;; wall2) echo "$st/wp-effect2" ;; mouse) echo "$st/mouse" ;; esac; }
setfx() { echo "$2" > "$(fxfile "$1")"; }
cur() { head -1 "$(fxfile "$1")" 2>/dev/null; }

case_run() { # KIND LABEL PACKKIND STAGE WATCH_SECONDS
  local kind=$1 label=$2 pk=$3 stage=$4 secs=$5 dir name
  dir=$gen/wall; [ "$kind" = mouse ] && dir=$gen/mouse
  name=ai-fxtest-$label
  if [ "$pk" = none ]; then rm -f "$dir/$name.frag.qsb"; else hdr "$pk" "$dir/$name.frag.qsb" "$stage"; fi
  [ "$kind" = wall2 ] && { echo aurora > "$st/wp-effect"; sleep 3; }
  local mark; mark=$(log | wc -l)
  local n0; n0=$(notices "$name")
  local r0; r0=$(rss_kb)
  setfx "$kind" "$name"
  wait_for 15 "[ -z \"\$(cat $(fxfile $kind) 2>/dev/null)\" ]"
  [ -z "$(cur "$kind")" ] && ok "$kind/$label: the effect switched itself off" || bad "$kind/$label: still set to '$(cur "$kind")'"
  sleep "$secs"
  local r1; r1=$(rss_kb)
  local n1 lines
  n1=$(notices "$name"); lines=$(log | tail -n +$((mark + 1)) | wc -l)
  [ $((n1 - n0)) -eq 1 ] && ok "$kind/$label: exactly one notice" || bad "$kind/$label: $((n1 - n0)) notices"
  [ "$lines" -le 12 ] && ok "$kind/$label: $lines new log lines" || { bad "$kind/$label: $lines new log lines (more than 12)"; log | tail -n +$((mark + 1)) | cut -c1-200 | head -20; }
  [ $((r1 - r0)) -lt 51200 ] && ok "$kind/$label: memory flat over ${secs}s ($(( (r1 - r0) / 1024 )) MB change)" || bad "$kind/$label: memory grew $(( (r1 - r0) / 1024 )) MB in ${secs}s"
  [ "$kind" = wall2 ] && echo > "$st/wp-effect"
  rm -f "$dir/$name.frag.qsb"
}

case_run wall missing none 0 8
case_run wall garbage garbage 0 8
case_run wall cut cut 0 8
case_run wall vertex stage 0 8
case_run wall2 vertex stage 0 8
case_run mouse vertex stage 0 8
# the longest watch: a bad pack is switched off, then the shell is left alone for 60 s
case_run wall vertex60 stage 0 60
# the check is bypassed on purpose (test hook) so the renderer gets a real pack with the wrong stage: it must neither crash nor leak
touch "$st/fx-check-off"
python3 - "$PLUGIN_DIR/wallpaper-effects/crt.frag.qsb" "$gen/wall/ai-fxtest-bypass.frag.qsb" <<'PY'
import struct, sys, zlib
d = bytearray(zlib.decompress(open(sys.argv[1], "rb").read()[4:]))
d[4:8] = struct.pack(">i", 0)
open(sys.argv[2], "wb").write(struct.pack(">I", len(d)) + zlib.compress(bytes(d)))
PY
setfx wall ai-fxtest-bypass; sleep 5; r0=$(rss_kb); sleep 15; r1=$(rss_kb)  # the first seconds load the effect (a one-time jump)
[ -n "$(shell_pid)" ] && ok "bypass: the shell is still running" || bad "bypass: the shell died"
[ $((r1 - r0)) -lt 204800 ] && ok "bypass: memory flat from 5 s to 20 s ($(( (r1 - r0) / 1024 )) MB change)" || bad "bypass: memory grew $(( (r1 - r0) / 1024 )) MB from 5 s to 20 s"
echo > "$st/wp-effect"; rm -f "$st/fx-check-off" "$gen/wall/ai-fxtest-bypass.frag.qsb"
sleep 31
grim "$out/fxguard-1-after-cases.png" 2>/dev/null

# the stand-in for the real thing: an effect is running and the shell log suddenly floods; the guard must switch the effects off
echo aurora > "$st/wp-effect"; echo "" > "$st/mouse"; sleep 4
shell_log=$(ls -t "$XDG_RUNTIME_DIR"/quickshell/by-id/*/log.log | head -1)
nflood0=$(notices "switched its effects off")
python3 - "$shell_log" <<'PY'
import sys
with open(sys.argv[1], "ab") as f:
    f.write(b"WARN scene: Failed to compile shader: 0(5) : error C7573: stand-in for a driver error\n")
PY
wait_for 20 "[ -z \"\$(cat $st/wp-effect 2>/dev/null)\" ]" && ok "guard: one driver error line switched the wallpaper effect off" || bad "guard: wallpaper effect still '$(cat "$st/wp-effect")' after a driver error line"
sleep 3
[ $(( $(notices "switched its effects off") - nflood0 )) -eq 1 ] && ok "guard: exactly one notice" || bad "guard: notices: $(( $(notices "switched its effects off") - nflood0 ))"
[ -f "$st/guard.log" ] && ok "guard: wrote its own log ($(wc -l < "$st/guard.log") lines)" || bad "guard: no guard.log"

log | grep -ciE "TypeError|ReferenceError|is not a type|Unable to assign" | grep -qx 0 && ok "no QML errors in the log" || bad "QML errors in the log"
echo "screenshots: fxguard-1-after-cases"
exit $fail
