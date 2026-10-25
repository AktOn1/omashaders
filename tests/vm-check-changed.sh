#!/usr/bin/env bash
# VM check for the "(changed)" label, Revert (b) and Undo (y). Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-changed.sh" "$d/vm-check.sh" && vm-test "$d"
# Only the throwaway VM's own state folder is used. Asserts the wallpaper effect file after each step and that nothing logs QML errors; screenshots changed-*.png show the label.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
st=$HOME/.local/state/omarchy/$S
ipc() { omarchy-shell "$S" "$@"; }
hostipc() { omarchy-shell "$S-host" "$@"; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
shot() { grim "$out/$1.png"; }
mark=$(log | wc -l)
fail=0
want() { local got; got=$(cat "$st/wp-effect" 2>/dev/null); [ "$got" = "$2" ] && echo "ok: $1 ($got)" || { echo "FAIL: $1 (wanted '$2', got '$got')"; fail=1; }; }
rm -f "$st/dev-export"
# the first run of a helper writes __pycache__ into the plugin folder, which makes the shell reload the plugin and forget the look: do that before the test
python3 -m compileall -q "$HOME/.config/omarchy/plugins/$S/bin" >/dev/null 2>&1; sleep 3
hostipc reload >/dev/null 2>&1; sleep 10
sed -n '9p;114p' "$PLUGIN_DIR/starter-themes" > "$st/.themes.tmp" && mv -f "$st/.themes.tmp" "$st/themes"; sleep 5
ipc open; sleep 3
ipc theme 1; sleep 5; shot changed-1-applied
want "theme applied" plankton
look=$(ipc look); case "$look" in same\|Abyss) echo "ok: label off ($look)";; *) echo "FAIL: label off ($look)"; fail=1;; esac
ipc wallpaper deepblue; sleep 4; ipc close; sleep 1; ipc open; sleep 3; shot changed-2-edited
want "edited wallpaper" deepblue
look=$(ipc look); case "$look" in changed\|Abyss) echo "ok: label on ($look)";; *) echo "FAIL: label on ($look)"; fail=1;; esac
wtype b 2>/dev/null; sleep 4; shot changed-3-reverted
want "revert" plankton
wtype y 2>/dev/null; sleep 4; shot changed-4-undone
want "undo" deepblue
ipc close; sleep 1
log | tail -n +$((mark + 1)) > "$out/check-log.txt"
n=$(log | tail -n +$((mark + 1)) | grep -ci "error" || true)
[ "${n:-0}" = 0 ] && echo "ok: no errors in the log" || { echo "FAIL: $n error lines"; fail=1; }
exit $fail
