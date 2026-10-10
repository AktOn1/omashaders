#!/usr/bin/env bash
# Runs inside the Omarchy VM (vm-test omashaders): (1) wallpaper Speed/Zoom render without shader errors,
# (2) hot reload: edits to the plugin show up in the running shell without a restart, in the symlinked layout
# (a developer, where Omarchy's own reload cannot see the files) and in the copied layout (store install).
set -u
S=io.github.akton1.omashaders
H=$S-host
out=${VM_TEST_OUT:-/tmp}
state=$HOME/.local/state/omarchy/$S
plugins=$HOME/.config/omarchy/plugins
shot() { grim "$out/$1.png"; }
ipc() { omarchy-shell "$S" "$@"; }
hostipc() { omarchy-shell "$H" "$@"; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
fail=0
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
mark=$(log | wc -l)
newlog() { log | tail -n +$((mark + 1)); }
wait_for() { # SECONDS 'shell expression'
  local t=$1
  while [ "$t" -gt 0 ]; do eval "$2" >/dev/null 2>&1 && return 0; sleep 1; t=$((t - 1)); done
  return 1
}
status() { hostipc status 2>&1; }
reloads() { status | sed -n 's/.*reloads=\([0-9]*\).*/\1/p'; }
shell_rss() { ps -o rss= -p "$(pgrep -x quickshell | head -1)" | tr -d ' '; }
mkdir -p "$state"

# ---------------------------------------------------------------- 1. wallpaper options
ipc wallpaper aurora; sleep 3; shot wall-zoom100
echo 200 > "$state/wall-zoom"; sleep 3; shot wall-zoom200
echo 50 > "$state/wall-zoom"; echo 300 > "$state/wall-speed"; sleep 3; shot wall-zoom50
bad_shader=$(newlog | grep -iE "shader|uniform|qsb|ShaderEffect" | head -5)
ipc wallpaper off; echo 100 > "$state/wall-zoom"; echo 100 > "$state/wall-speed"
if [ -n "$bad_shader" ]; then bad "shader errors in the shell log: $bad_shader"; else ok "aurora rendered at zoom 100/200/50 and speed 300 with no shader errors"; fi

# ---------------------------------------------------------------- 2. hot reload
run_phase() { # NAME DIR  (the plugin is installed the way NAME says; DIR is where its files really are)
  local name=$1 dir=$2 core=$2/Core.qml before n r0 r1 i listing
  echo "== phase $name: files in $dir"
  if ! wait_for 60 "status | grep -q 'running=yes'"; then bad "$name: host not running: $(status)"; return; fi
  ok "$name: host running ($(status))"
  cp "$core" "$out/Core.$name.orig"
  mark=$(log | wc -l)
  before=$(reloads); shot "$name-0-before"

  # a) edit the bar glyph
  sed -i 's|^  readonly property string barGlyph: ".*"$|  readonly property string barGlyph: "HOTRELOAD"|' "$core"
  wait_for 25 "[ \"\$(status | sed -n 's/.*reloads=\\([0-9]*\\).*/\\1/p')\" != '$before' ]"
  sleep 3; shot "$name-1-edited"
  n=$(reloads)
  if [ "$name" = symlink ]; then
    [ "$n" -gt "$before" ] && ok "$name: Core.qml edit reloaded by the host (reloads $before -> $n)" || bad "$name: host did not reload (reloads $before -> $n)"
    newlog | grep -q "Local plugin changed" && bad "$name: Omarchy's own reload fired for a symlinked plugin (unexpected)" || ok "$name: Omarchy's own reload did not see the change, as expected for a symlink"
  else
    newlog | grep -q "Local plugin changed, reloading: $S" && ok "$name: Omarchy's own reload handled the edit" || bad "$name: no 'Local plugin changed' log line"
  fi

  # b) broken edit: refused, the old version keeps running (the host does the checking in the symlinked layout)
  echo 'this is not qml {{{' >> "$core"
  if [ "$name" = symlink ]; then
    wait_for 15 "status | grep -qv 'error=none'"; sleep 2
    status | grep -q "running=yes" && ! status | grep -q "error=none" && ok "$name: broken Core.qml refused, old one running ($(status))" || bad "$name: broken edit not handled: $(status)"
    newlog | grep -q "OmaShaders: not reloading" && ok "$name: refusal logged" || bad "$name: no refusal in the log"
  else
    sleep 6
  fi
  shot "$name-2-broken"

  # c) restore (a plain overwrite, not a rename)
  cp "$out/Core.$name.orig" "$core"
  wait_for 25 "status | grep -q 'running=yes' && status | grep -q 'error=none'"; sleep 4
  shot "$name-3-restored"
  status | grep -q "error=none" && status | grep -q "running=yes" && ok "$name: restored, error cleared ($(status))" || bad "$name: not clean after restore: $(status)"

  # c2) a sibling QML file: a broken WallpaperFx.qml is refused too, a good edit reloads
  if [ "$name" = symlink ]; then
    n=$(reloads); cp "$dir/WallpaperFx.qml" "$out/WallpaperFx.orig"
    echo 'this is not qml {{{' >> "$dir/WallpaperFx.qml"
    wait_for 15 "status | grep -q 'error=WallpaperFx.qml'"
    status | grep -q "error=WallpaperFx.qml" && ok "$name: broken WallpaperFx.qml refused ($(status | cut -c1-80))" || bad "$name: broken sibling not refused: $(status)"
    cp "$out/WallpaperFx.orig" "$dir/WallpaperFx.qml"; echo "// touched" >> "$dir/WallpaperFx.qml"
    wait_for 25 "status | grep -q 'error=none' && [ \"\$(reloads)\" -gt $n ]"
    status | grep -q "error=none" && [ "$(reloads)" -gt "$n" ] && ok "$name: edited WallpaperFx.qml reloaded ($(status))" || bad "$name: sibling edit not reloaded: $(status)"
    cp "$out/WallpaperFx.orig" "$dir/WallpaperFx.qml"; sleep 3
  fi

  # d) new wallpaper effects: a new category, an existing category, none
  printf '// label: Hot test one\n// hint: brand new category\n// category: Hot category\n' > "$dir/wallpaper-effects/hottest1.frag"
  printf '// label: Hot test two\n// hint: joins an existing group\n// category: Weather and nature\n' > "$dir/wallpaper-effects/hottest2.frag"
  printf '// label: Hot test three\n// hint: no category\n' > "$dir/wallpaper-effects/hottest3.frag"
  sleep 1
  listing=$("$dir/bin/omashaders" listall | grep "^hottest")
  [ "$(echo "$listing" | wc -l)" = 3 ] && echo "$listing" | grep -q "hottest1.*Hot category$" && ok "$name: listall reports the three new wallpaper effects with their categories" || bad "$name: listall: $listing"

  # e) a changed menu label in Core.qml shows in the open menu, with the new wallpaper category
  n=$(reloads)
  sed -i 's|placeholderText: "/  filter every column"|placeholderText: "/  filter HOT column"|' "$core"
  wait_for 25 "[ \"\$(status | sed -n 's/.*reloads=\\([0-9]*\\).*/\\1/p')\" != '$n' ]"; sleep 3
  ipc sections wall; ipc open; sleep 3; shot "$name-4-menu"
  hyprctl layers 2>/dev/null | grep -i "namespace" | sort -u > "$out/$name-layers-menu-open.txt"
  wtype '/' 2>/dev/null; sleep 1; wtype 'hot test' 2>/dev/null; sleep 2; shot "$name-5-menu-filtered"
  ipc close; sleep 1

  # f) leaks: one perf-log, shell memory and log noise after 8 forced reloads
  r0=$(shell_rss)
  for i in 1 2 3 4 5 6 7 8; do hostipc reload >/dev/null; sleep 2; done
  sleep 2
  r1=$(shell_rss)
  ok "$name: shell memory ${r0} KB -> ${r1} KB after 8 forced reloads"
  [ "$(pgrep -fc 'bin/perf-log run')" -le 1 ] && ok "$name: one perf-log process" || bad "$name: $(pgrep -fc 'bin/perf-log run') perf-log processes"
  if newlog | grep -iE "duplicate|already (registered|exists)|Failed to create|is not a type|TypeError|ReferenceError" | head -5 | grep .; then bad "$name: errors/warnings in the shell log (above)"; else ok "$name: no duplicate-handler or QML errors in the log"; fi

  rm -f "$dir"/wallpaper-effects/hottest?.frag
  cp "$out/Core.$name.orig" "$core"
  sleep 4
}

dest="$plugins/$S"
if [ -d "$dest" ] && [ ! -L "$dest" ]; then
  # layout 1 (a developer): the plugin dir is a symlink into a source tree, so Omarchy's own reload (inotifywait -r) cannot see edits
  src=$HOME/omashaders-src
  rm -rf "$src"; cp -a "$dest" "$src"
  rm -rf "$dest"; ln -s "$src" "$dest"
  omarchy-shell shell rescanPlugins >/dev/null 2>&1; sleep 8
  run_phase symlink "$src"
  # layout 2 (store install): a real directory
  rm -f "$dest"; cp -a "$src" "$dest"; rm -rf "$src"
  omarchy-shell shell rescanPlugins >/dev/null 2>&1; sleep 8
  run_phase copied "$dest"
else
  bad "plugin not installed as a real directory at $dest"
fi

echo "screenshots: symlink-0..5 and copied-0..5 (bar icon text HOTRELOAD in -1 and -2, original in -0 and -3; -4 shows the menu with the new wallpaper category and the edited filter placeholder, -5 the filter 'hot test' narrowing it to the new effects)"
exit $fail
