#!/usr/bin/env bash
# vm-check-timeout: 900
# VM check for "Edit with AI" and "Regenerate selected" in the theme dialog. Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-regen.sh" "$d/vm-check.sh" && vm-test "$d"
# A fake AI command answers the regenerate prompts (Pick) and the Builder/Reviewer prompts (Rich, from rich-examples/); nothing is sent anywhere.
# It drives the real dialog: open a saved theme, tick parts, regenerate, go back, save in place, and a Rich regenerate of one part.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
plugins=$HOME/.config/omarchy/plugins
dest=$plugins/$S
st=$HOME/.local/state/omarchy/$S
bin=$dest/bin
gen=$st/generated
shot() { grim "$out/$1.png"; }
ipc() { omarchy-shell "$S" "$@"; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
fail=0
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
mark=$(log | wc -l)
newlog() { log | tail -n +$((mark + 1)); }
wait_for() { local t=$1; while [ "$t" -gt 0 ]; do eval "$2" >/dev/null 2>&1 && return 0; sleep 1; t=$((t - 1)); done; return 1; }
dialog_open() { [ "$(hyprctl layers 2>/dev/null | grep -c omarchy-keyboard-panel)" -gt 0 ]; }
mkdir -p "$st"
jobs_json() { python3 "$bin/ai-theme" job list --json; }
jstate() { jobs_json | python3 -c 'import json,sys; j=json.load(sys.stdin)["jobs"]; print(j[-1]["state"] if j else "none")'; }
jid() { jobs_json | python3 -c 'import json,sys; j=json.load(sys.stdin)["jobs"]; print(j[-1]["id"] if j else "")'; }
jline() { jobs_json | python3 -c 'import json,sys; j=json.load(sys.stdin)["jobs"]; print((j[-1].get("result") or {}).get("line","") if j else "")'; }
jturn() { jobs_json | python3 -c 'import json,sys; j=json.load(sys.stdin)["jobs"]; print((j[-1].get("result") or {}).get("turn",-1) if j else -1)'; }
# field N (0-based) of a theme line: screen wall cursor color name winfx wincolor winframe opts
field() { printf '%s' "$1" | cut -d'|' -f$(($2 + 1)); }
themes_line() { sed -n "$1p" "$st/themes"; }

python3 -c "import PIL, numpy" 2>/dev/null || echo tester | sudo -S pacman -Sy --noconfirm --needed python-pillow python-numpy >/tmp/pacman.out 2>&1 || true
python3 -c "import PIL, numpy" 2>/dev/null && ok "regen: python-pillow and python-numpy are installed" || bad "regen: no python-pillow/python-numpy"

fake=$HOME/fake-regen.py
calls=$HOME/fake-calls.log
: >"$calls"
cat >"$fake" <<'PYEOF'
#!/usr/bin/env python3
import glob, json, os, re, sys
t = sys.stdin.read()
log = os.path.expanduser("~/fake-calls.log")
ex = os.path.join(os.path.expanduser("~/.config/omarchy/plugins/io.github.akton1.omashaders"), "rich-examples")
def example(kind, n=0):
    return open(sorted(glob.glob(os.path.join(ex, kind + "-*.glsl")))[n]).read()
def note(x):
    open(log, "a").write(x + "\n")
if "REGENERATE. The user pressed" in t:
    sect, cur = {}, None
    for line in t.split("# PARTS TO REGENERATE")[0].splitlines():
        if line.startswith("## "):
            cur = line[3:].split(" (")[0].strip(); sect[cur] = []
        elif line.startswith("#"):
            cur = None
        elif cur and "|" in line:
            sect[cur].append(line.split("|")[0])
    names = {"screen": "Screen", "color": "Color", "wallpaper": "Wallpaper", "cursor": "Cursor", "window": "Windows", "frame": "Frames"}
    ans = {"idea": "another take", "strength": {}}
    for slot, rest in re.findall(r"^- (\w+): (.*)$", t.split("# PARTS TO REGENERATE")[1], re.M):
        avoid = [x.strip() for x in rest.replace("not ", "", 1).split(",")]
        pool = [x for x in sect.get(names.get(slot, ""), []) if x not in avoid]
        if pool:
            ans[slot] = pool[0]
            note("pick:" + slot)
    print(json.dumps(ans))
elif "RICH mode (Builder)" in t:
    slot = re.search(r"# YOUR PART: (\w+)", t).group(1)
    note("builder:" + slot)
    if slot == "frame":
        print(json.dumps({"name": "Warm Edge", "desc": "A thin warm border.", "start": 70, "fallback": "", "settings": {"rounding": 14, "border_size": 2,
              "border_colors": ["ffb457", "ff6a3d"], "border_angle": 45, "shadow_range": 30, "shadow_power": 2, "shadow_color": "ff6a3d66", "border_inactive": "3b6a8f55", "spin": 0}}))
    else:
        print(json.dumps({"name": "Regen " + slot.title(), "desc": "a test " + slot, "start": 80, "fallback": "", "code": example(slot if slot != "window" else "screen")}))
elif "RICH mode (Reviewer)" in t:
    note("reviewer")
    parts = {s: {"score": 8, "seen": "fake saw it", "fixes": []} for s in re.findall(r"^- (\w+): brief:", t, re.M)}
    print(json.dumps({"summary": "fake summary", "parts": parts}))
elif "RICH mode (Planner)" in t:
    note("planner")
    print("{}")
else:
    note("other")
    print("{}")
PYEOF
chmod +x "$fake"

cfg=$HOME/.config/omarchy/shell.json
jq --arg c "$fake" '(.. | objects | select(.id? == "io.github.akton1.omashaders")) += {aiCommand: $c}' "$cfg" >"$cfg.tmp" && mv "$cfg.tmp" "$cfg"; sleep 6
python3 "$bin/ai-theme" use custom --custom "$fake" --mode pick >/dev/null 2>&1; sleep 2

# a saved theme of the user's own, made from effects that exist in this version
rm -f "$st/themes"
python3 - "$bin" <<'PYEOF'
import sys
sys.path.insert(0, sys.argv[1])
import omslib as L
cat = L.catalog()
light = sorted(L.overlay_ids() & set(cat["wall"]))
pick = lambda k: sorted(cat[k])[0]
c = {"n": "Harbor Test", "s": pick("screen"), "c": pick("color"), "w": light[0], "m": pick("mouse"), "wf": "", "wc": "", "wr": pick("frame"),
     "o": {"fx": 55, "col": 66, "wall": 44, "cur": 77}}
L.save_theme(c)
PYEOF
n=$(grep -n 'Harbor Test' "$st/themes" | head -1 | cut -d: -f1)
[ -n "$n" ] && ok "regen: a saved theme to edit is theme #$n" || bad "regen: the test theme was not saved"
orig=$(themes_line "$n")
ipc open; sleep 5; ipc close; sleep 2

# 1. Edit with AI opens the saved theme in the dialog
ipc editTheme "$n"; wait_for 45 dialog_open || bad "regen: the dialog did not open in 45 s"
sleep 3; shot regen-0-edit-form
wtype -k Return
wait_for 60 '[ "$(jstate)" = done ] && [ -n "$(jline)" ]' && ok "regen: Edit with AI opened the theme as a draft (no AI call)" || bad "regen: the theme did not open (state $(jstate))"
[ -s "$calls" ] && bad "regen: opening the theme called the AI" || ok "regen: opening the theme made no AI call"
[ "$(jline)" = "$orig" ] && ok "regen: the draft is the saved theme, byte for byte" || bad "regen: the draft differs from the saved theme"
sleep 4; shot regen-1-loaded

# 2. tick Screen (1) and Cursor (4), add a direction, regenerate with g
wtype 1; sleep 0.5; wtype 4; sleep 1
wtype w; sleep 0.5; wtype "colder and calmer"; sleep 1
shot regen-2-ticked
wtype -k Escape; sleep 0.5
t0=$(jturn); wtype g
wait_for 90 "[ \$(jturn) -gt $t0 ] && [ \"\$(jstate)\" = done ]" && ok "regen: g regenerated the ticked parts" || bad "regen: the regenerate did not finish (state $(jstate))"
sleep 4; shot regen-3-regenerated
new=$(jline)
[ "$(field "$new" 0)" != "$(field "$orig" 0)" ] && ok "regen: the screen effect is a different one" || bad "regen: the screen effect did not change"
[ "$(field "$new" 2)" != "$(field "$orig" 2)" ] && ok "regen: the cursor effect is a different one" || bad "regen: the cursor effect did not change"
same=1; for i in 1 3 4 5 6 7; do [ "$(field "$new" $i)" = "$(field "$orig" $i)" ] || same=0; done
[ "$same" = 1 ] && ok "regen: wallpaper, color, name and the window parts came back byte for byte" || bad "regen: a part that was not ticked changed: $new"
[ "$(field "$new" 8 | grep -o 'wall=44')" = wall=44 ] && ok "regen: the strength of the untouched wallpaper is unchanged" || bad "regen: the wallpaper strength changed: $(field "$new" 8)"
[ "$(sort "$calls" | tr '\n' ' ')" = "pick:cursor pick:screen " ] && ok "regen: the AI was asked for exactly those two parts" || bad "regen: AI calls were: $(tr '\n' ' ' <"$calls")"
[ "$(themes_line "$n")" = "$orig" ] && ok "regen: the saved theme is untouched while the draft is open" || bad "regen: the saved theme changed before saving"

# 3. Previous (p) takes the ticked parts back
t0=$(jturn); wtype p
wait_for 30 "[ \$(jturn) -gt $t0 ]" || bad "regen: p did nothing"
sleep 2; shot regen-4-previous
back=$(jline)
[ "$(field "$back" 0)" = "$(field "$orig" 0)" ] && [ "$(field "$back" 2)" = "$(field "$orig" 2)" ] && ok "regen: Previous brought the earlier screen and cursor back" || bad "regen: Previous did not restore: $back"

# 4. untick the cursor (4), regenerate the screen again and save the changes in place (s)
wtype 4; sleep 0.5
t0=$(jturn); wtype g
wait_for 90 "[ \$(jturn) -gt $t0 ] && [ \"\$(jstate)\" = done ]" || bad "regen: the second regenerate did not finish"
sleep 3
want=$(jline)
wtype s
wait_for 30 "[ \"\$(themes_line $n)\" != \"$orig\" ]" && ok "regen: s saved the changes into the same theme" || bad "regen: the theme line did not change after s"
[ "$(themes_line "$n")" = "$want" ] && ok "regen: the saved line is the draft" || bad "regen: the saved line is not the draft"
[ "$(wc -l <"$st/themes")" = "$n" ] && ok "regen: saving in place added no new theme" || bad "regen: the list grew to $(wc -l <"$st/themes") lines"
[ "$(field "$(themes_line "$n")" 4)" = "Harbor Test" ] && ok "regen: the theme keeps its name" || bad "regen: the name changed"
sleep 2; dialog_open && bad "regen: the dialog stayed open after saving" || ok "regen: the dialog closed after saving"
[ -z "$(ls -d "$st"/jobs/*/ 2>/dev/null)" ] && ok "regen: the saved draft's job is gone" || bad "regen: a job folder is left"

# 5. Rich regenerate of ONE part on a saved theme: only that Builder runs, no Planner call
python3 "$bin/ai-theme" use custom --custom "$fake" --mode rich >/dev/null 2>&1; sleep 2
: >"$calls"
orig=$(themes_line "$n")
ipc editTheme "$n"; wait_for 45 dialog_open || bad "regen: the dialog did not open for the Rich edit"
sleep 3; wtype -k Return
wait_for 60 '[ "$(jstate)" = done ] && [ -n "$(jline)" ]' || bad "regen: the Rich edit did not open"
sleep 3; wtype 4; sleep 1; shot regen-5-rich-ticked
t0=$(jturn); wtype g
wait_for 600 "[ \$(jturn) -gt $t0 ] && [ \"\$(jstate)\" = done ]" && ok "regen: a Rich regenerate of the cursor finished" || bad "regen: the Rich regenerate did not finish (state $(jstate))"
sleep 5; shot regen-6-rich-done
grep -q planner "$calls" && bad "regen: Rich on a saved theme called the Planner" || ok "regen: Rich on a saved theme made no Planner call"
[ "$(grep -c '^builder:' "$calls")" = 1 ] && grep -q '^builder:cursor$' "$calls" && ok "regen: only the cursor Builder ran" || bad "regen: calls were: $(tr '\n' ' ' <"$calls")"
new=$(jline)
same=1; for i in 0 1 3 4 5 6 7; do [ "$(field "$new" $i)" = "$(field "$orig" $i)" ] || same=0; done
[ "$same" = 1 ] && [ "$(field "$new" 2)" != "$(field "$orig" 2)" ] && ok "regen: only the cursor changed" || bad "regen: Rich changed more than the cursor: $new"
ls "$gen"/mouse/ai-*.frag.qsb >/dev/null 2>&1 && ok "regen: the new cursor effect was built (.qsb)" || bad "regen: no cursor .qsb"

# 6. Discard (d) puts everything back and deletes the new effect
wtype d
wait_for 30 '[ -z "$(ls -d '"$st"'/jobs/*/ 2>/dev/null)" ]' && ok "regen: d discarded the draft" || bad "regen: the draft is still there"
[ "$(themes_line "$n")" = "$orig" ] && ok "regen: discard left the saved theme as it was" || bad "regen: discard changed the saved theme"
ls "$gen"/mouse/ai-*.frag >/dev/null 2>&1 && bad "regen: discard left a generated cursor shader" || ok "regen: discard deleted the effect it generated"
wtype -k Escape; sleep 1
ls "$dest"/shaders/ai-* >/dev/null 2>&1 && bad "regen: a generated file landed in the plugin folder" || ok "regen: the plugin folder has no generated files"
newlog | grep -iE "TypeError|ReferenceError|is not a type|ThemeDialog.qml.*(error|failed)|Core.qml.*(error|failed)|Cannot assign|Unable to assign" | head -5 | grep . && bad "regen: QML errors in the log (above)" || ok "regen: no QML errors in the log"
echo "screenshots: regen-0-edit-form, regen-1-loaded, regen-2-ticked, regen-3-regenerated, regen-4-previous, regen-5-rich-ticked, regen-6-rich-done"
exit $fail
