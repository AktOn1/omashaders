#!/usr/bin/env bash
# VM check for the built-in lock marks, Duplicate and the "Create with AI" left-list rows. Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-locks.sh" "$d/vm-check.sh" && vm-test "$d"
# Only the throwaway VM's own state folder is used. Looks at screenshots (lock-*.png); asserts only that nothing logs QML errors.
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
st=$HOME/.local/state/omarchy/$S
ipc() { omarchy-shell "$S" "$@"; }
hostipc() { omarchy-shell "$S-host" "$@"; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
shot() { grim "$out/$1.png"; }
mark=$(log | wc -l)
rm -f "$st/dev-export"
hostipc reload >/dev/null 2>&1; sleep 10
ipc open; sleep 3; shot lock-1-open
wtype N 2>/dev/null; sleep 2; shot lock-2-duplicate
ipc close; sleep 1
for k in s C w c; do
  ipc open; sleep 3
  wtype "$k" 2>/dev/null; sleep 2; shot "lock-3-$k-top"
  for _ in 1 2 3 4 5 6 7 8 9 10 11; do wtype -k Down 2>/dev/null; sleep 0.3; done; sleep 1; shot "lock-3-$k-end"
  ipc close; sleep 1
done
n=$(log | tail -n +$((mark + 1)) | grep -ci "error" || true)
[ "${n:-0}" = 0 ] && echo "ok: no errors in the log" || { echo "FAIL: $n error lines"; exit 1; }
