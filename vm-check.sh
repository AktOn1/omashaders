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
layout_set() { # Classic | New: the plugin's menuLayout setting (New is the default menu; Classic is the older one)
  local cfg=$HOME/.config/omarchy/shell.json
  jq --arg v "$1" '(.. | objects | select(.id? == "io.github.akton1.omashaders")) += {menuLayout: $v}' "$cfg" >"$cfg.tmp" && mv "$cfg.tmp" "$cfg"
  local want; want=$(echo "$1" | tr 'A-Z' 'a-z')
  wait_for 20 "status | grep -q 'layout=$want'" || { hostipc reload; wait_for 15 "status | grep -q 'layout=$want'"; } || { omarchy-restart-shell >/dev/null 2>&1; wait_for 40 "status | grep -q 'layout=$want'"; }
  status | grep -q "layout=$want" && ok "layout is $1 ($(status))" || bad "layout did not become $1: $(status)"
}
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

layout_set New
# ---------------------------------------------------------------- 1. wallpaper options
ipc wallpaper aurora; sleep 3; shot wall-zoom100
echo 200 > "$state/wall-zoom"; sleep 3; shot wall-zoom200
echo 50 > "$state/wall-zoom"; echo 300 > "$state/wall-speed"; sleep 3; shot wall-zoom50
bad_shader=$(newlog | grep -iE "shader|uniform|qsb|ShaderEffect" | head -5)
ipc wallpaper off; echo 100 > "$state/wall-zoom"; echo 100 > "$state/wall-speed"
if [ -n "$bad_shader" ]; then bad "shader errors in the shell log: $bad_shader"; else ok "aurora rendered at zoom 100/200/50 and speed 300 with no shader errors"; fi

# ---------------------------------------------------------------- 1b. sprite wallpaper effect (pumpkin-night: atlas texture + pointer reaction)
mark=$(log | wc -l)
ipc wallpaper pumpkin-night; sleep 4; shot pumpkin-0-nopointer
hyprctl dispatch 'hl.dsp.cursor.move({x=140,y=640})' >/dev/null 2>&1; sleep 1
hyprctl dispatch 'hl.dsp.cursor.move({x=150,y=650})' >/dev/null 2>&1; sleep 2; shot pumpkin-1-pointer-near
bad_shader=$(newlog | grep -iE "shader|uniform|qsb|ShaderEffect|Image" | head -5)
ipc wallpaper off
if [ -n "$bad_shader" ]; then bad "pumpkin-night errors in the shell log: $bad_shader"; else ok "pumpkin-night rendered with the pointer away and near, no shader errors (look at pumpkin-*.png)"; fi

# ---------------------------------------------------------------- 2. hot reload
run_phase() { # NAME DIR  (the plugin is installed the way NAME says; DIR is where its files really are)
  local name=$1 dir=$2 core=$2/Core.qml before n r0 r1 i listing
  echo "== phase $name: files in $dir"
  layout_set New
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
  for i in 1 2 3 4 5 6 7 8; do hostipc reload >/dev/null; sleep 1; done
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

# ---------------------------------------------------------------- 3. Wallhaven browser (needs the VM to reach wallhaven.cc)
wallhaven_check() {
  local bin=$dest/bin/wallhaven cur
  if ! timeout 40 python3 "$bin" search "nature" --json 2>/dev/null | grep -q '"results"'; then
    echo "skip: the VM cannot reach wallhaven.cc, browser not tested"; return
  fi
  mark=$(log | wc -l)
  ipc wallhaven; sleep 10; shot wallhaven-0-open
  layers=$(hyprctl layers 2>/dev/null | grep -c omarchy-keyboard-panel)
  [ "$layers" -gt 0 ] && ok "wallhaven: panel is open" || bad "wallhaven: no keyboard panel layer after 'wallhaven'"
  wtype -k Right; sleep 1; wtype -k Right; sleep 2; shot wallhaven-1-selected
  wtype -k Return; wait_for 90 "readlink -f $HOME/.local/state/omarchy/current/background | grep -q wallhaven-"
  sleep 3; shot wallhaven-2-used
  cur=$(readlink -f "$HOME/.local/state/omarchy/current/background")
  case "$cur" in *wallhaven-*) ok "wallhaven: Enter downloaded the picture and set it as wallpaper ($(basename "$cur"))";; *) bad "wallhaven: wallpaper was not set (is $cur)";; esac
  "$dest/bin/wallpaper-step" list | grep -q "wallhaven/used/wallhaven-" && ok "wallhaven: Next/Prev list contains the picture" || bad "wallhaven: picture missing from the Next/Prev list"
  wtype -k Escape; sleep 1
  [ "$(hyprctl layers 2>/dev/null | grep -c 'omarchy-keyboard-panel$')" -eq 0 ] || echo "note: panel layer still listed (fade-out?)"
  newlog | grep -iE "TypeError|ReferenceError|is not a type|Wallhaven.qml.*(error|failed)|Cannot assign" | head -5 | grep . && bad "wallhaven: QML errors in the log (above)" || ok "wallhaven: no QML errors in the log"
}
wallhaven_check

# ---------------------------------------------------------------- 4. AI theme dialog, share and import (a fake AI command; no real AI call, no network)
theme_check() {
  local bin=$dest/bin fake=$HOME/fake-ai.sh cfg=$HOME/.config/omarchy/shell.json st=$HOME/.local/state/omarchy/io.github.akton1.omashaders code
  # the full offline self-tests run on the host (they take minutes); here only a quick look that the CLI works in this session
  python3 "$bin/ai-theme" catalog --quiet >/tmp/selftest.out 2>&1 && ok "theme: ai-theme builds its catalog" || { bad "theme: ai-theme catalog failed: $(tail -3 /tmp/selftest.out | tr '\n' ' ')"; }
  # a code made here must import here (CLI round trip in a scratch folder)
  code=$(OMASHADERS_STATE_DIR=/tmp/ost-vm bash -c 'mkdir -p /tmp/ost-vm; printf "|neonrain||neon-noir|VM Share|||\n" > /tmp/ost-vm/themes; python3 '"$bin"'/theme-code share 1')
  case "$code" in OMS1:*) ok "theme: theme share made a code";; *) bad "theme: theme share gave: $code";; esac
  OMASHADERS_STATE_DIR=/tmp/ost-vm2 python3 "$bin/theme-code" import "$code" --json | grep -q '"name": "VM Share"' && ok "theme: theme import read the code back" || bad "theme: theme import failed"
  cat >"$fake" <<'EOF'
#!/bin/sh
in=$(cat)
case "$in" in
*"# CURRENT THEME"*) echo '{"cursor":"","strength":{"wallpaper":30},"idea":"Quieter overlay, no cursor effect."}'; exit 0;;
esac
echo 'Here you go: {"name":"Fake Test","screen":"moonlight","color":"neon-noir","wallpaper":"bokehlights","cursor":"rain-ripples","window":"","window_color":"","frame":"","strength":{"color":55,"wallpaper":60},"note":"a test"}'
EOF
  chmod +x "$fake"
  mark=$(log | wc -l)
  # 1. no AI command that exists -> "AI needed", no crash
  jq --arg c "$HOME/does-not-exist" '(.. | objects | select(.id? == "io.github.akton1.omashaders")) += {aiCommand: $c}' "$cfg" >"$cfg.tmp" && mv "$cfg.tmp" "$cfg"; sleep 6
  ipc aiTheme; sleep 4; shot theme-0-ai-needed
  [ "$(hyprctl layers 2>/dev/null | grep -c omarchy-keyboard-panel)" -gt 0 ] && ok "theme: the AI dialog opens" || bad "theme: AI dialog did not open"
  wtype -k Escape; sleep 1; wtype -k Escape; sleep 1
  # 2. a working fake AI command -> typed wish -> theme applied live (not saved), a follow-up changes it, "s" saves it
  jq --arg c "$fake" '(.. | objects | select(.id? == "io.github.akton1.omashaders")) += {aiCommand: $c}' "$cfg" >"$cfg.tmp" && mv "$cfg.tmp" "$cfg"; sleep 6
  # the dialog remembers its last pick (ai.json), which now wins over the setting: point the remembered Custom command at the fake AI
  mkdir -p "$st"; printf '{"provider": "custom", "model": "", "custom": "%s"}' "$fake" >"$st/ai.json"
  ipc aiTheme; sleep 4
  wtype "a calm test night"; sleep 1; shot theme-1-ai-typed; wtype -k Return
  # the dialog runs every request as a background job: its chat session is <state>/jobs/<id>/chat.json
  wait_for 90 "grep -q 'Fake Test' $st/jobs/*/chat.json"
  sleep 4; shot theme-2-ai-done
  jd=$(ls -d "$st"/jobs/j* 2>/dev/null | head -1)
  grep -q 'Fake Test' "$jd/chat.json" 2>/dev/null && ok "theme: the first message built a theme (job's chat session)" || bad "theme: no 'Fake Test' in the job's chat session under $st/jobs"
  grep -q 'Fake Test' "$st/themes" && bad "theme: the chat theme was saved before Save as theme" || ok "theme: nothing is in the list until the theme is saved"
  wait_for 30 '[ "$(cat "$st/color" 2>/dev/null)" = "neon-noir" ] || [ "$("$bin/omashaders" color status 2>/dev/null | head -1)" = "neon-noir" ]' && ok "theme: the new theme was applied live (colour is neon-noir)" || bad "theme: theme not applied (colour: $(cat "$st/color" 2>/dev/null))"
  wtype "no cursor effect, quieter overlay"; sleep 1; wtype -k Return
  wait_for 90 "[ \$(OMASHADERS_CHAT_DIR=$jd python3 $bin/ai-theme chat status | grep -c '\"role\": \"ai\"') -ge 2 ]"
  sleep 4; shot theme-2b-ai-followup
  OMASHADERS_CHAT_DIR="$jd" python3 "$bin/ai-theme" chat status | grep '"line"' | grep -q 'wall=30' && ok "theme: the follow-up changed the same theme (overlay 30)" || bad "theme: follow-up did not change the theme: $(OMASHADERS_CHAT_DIR="$jd" python3 "$bin/ai-theme" chat status | grep '"line"')"
  OMASHADERS_CHAT_DIR="$jd" python3 "$bin/ai-theme" chat status | grep '"line"' | grep -q 'rain-ripples' && bad "theme: the cursor effect should be gone after the follow-up" || ok "theme: follow-up removed the cursor effect and kept the rest"
  wtype -k Escape; sleep 1; wtype s; wait_for 30 "grep -q 'Fake Test' $st/themes"; sleep 2; shot theme-2c-ai-saved
  grep -c 'Fake Test' "$st/themes" | grep -qx 1 && ok "theme: s saved the chat's theme as a theme (once)" || bad "theme: 'Fake Test' not saved exactly once in $st/themes"
  [ ! -f "$st/chat.json" ] && ok "theme: no stray chat session in the state folder after saving" || bad "theme: a chat session is still in the state folder after saving"
  # 3. share dialog
  ipc shareTheme 1; sleep 4; shot theme-3-share
  wtype -k Escape; sleep 1
  # 4. import dialog
  # the code goes through the clipboard, which the dialog reads when it opens (typing it with wtype dropped or swapped letters under load)
  printf '%s' "$code" | wl-copy >/dev/null 2>&1; sleep 1; ipc importTheme; sleep 3
  shot theme-4-import
  wtype -k Return; wait_for 30 "grep -q 'VM Share' $st/themes"; sleep 2; shot theme-5-imported
  grep -q 'VM Share' "$st/themes" && ok "theme: import dialog saved the theme" || bad "theme: import dialog did not save 'VM Share'"
  wtype -k Escape; sleep 1; wtype -k Escape; sleep 1
  newlog | grep -iE "TypeError|ReferenceError|is not a type|ThemeDialog.qml.*(error|failed)|Cannot assign|Unable to assign" | head -5 | grep . && bad "theme: QML errors in the log (above)" || ok "theme: no QML errors in the log"
}
theme_check

echo "screenshots: symlink-0..5 and copied-0..5 (bar icon text HOTRELOAD in -1 and -2, original in -0 and -3; -4 shows the menu with the new wallpaper category and the edited filter placeholder, -5 the filter 'hot test' narrowing it to the new effects)"
exit $fail
