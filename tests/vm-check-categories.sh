#!/usr/bin/env bash
# VM check for theme categories: built-in groups in the Themes list, New category (K), Delete on a category (the move is checked by hand). Runs as its own vm-test:
#   d=$(mktemp -d) && cp -r <plugin folder>/. "$d" && cp "$d/tests/vm-check-categories.sh" "$d/vm-check.sh" && vm-test "$d"
set -u
S=io.github.akton1.omashaders
out=${VM_TEST_OUT:-/tmp}
shot() { grim "$out/$1.png"; }
ipc() { omarchy-shell "$S" "$@"; }
log() { quickshell log -p /usr/share/omarchy/shell --any-display 2>/dev/null; }
bad() { echo "FAIL: $*"; fail=1; }
ok() { echo "ok: $*"; }
fail=0
mark=$(log | wc -l)
st=$HOME/.local/state/omarchy/$S; mkdir -p "$st"
cf=$st/theme-categories
rm -f "$st/sections" "$cf"
for i in $(seq 1 45); do [ "$(wc -l < "$st/themes" 2>/dev/null || echo 0)" -ge 100 ] && break; sleep 2; done; sleep 6
echo "themes file lines: $(wc -l < "$st/themes" 2>/dev/null)"
omarchy-shell "$S-host" reload >/dev/null 2>&1; sleep 6
main=$(pgrep -o -x quickshell); for p in $(pgrep -x quickshell); do [ "$p" != "$main" ] && kill "$p" 2>/dev/null; done; sleep 1
ipc open; sleep 4
shot cats-1-first-view
wtype K; sleep 1; shot cats-2-new-category-prompt
wtype "Test shelf"; sleep 0.5; wtype -k Return; sleep 2
shot cats-3-new-category-made
grep -q "^cat	Test shelf$" "$cf" 2>/dev/null && ok "category saved in the state file" || bad "no 'cat' line in theme-categories"
# Previewing a theme with a wallpaper effect reloads the shell in the software-GL VM, so the move itself is not driven here; a set line is seeded instead.
printf "set\tTest shelf\tvm-seeded-base\n" >> "$cf"; sleep 3
grep -q "^set	Test shelf	" "$cf" && ok "state file holds the category and a theme in it"
wtype 3; sleep 1.5; shot cats-7-own-category
wtype -k Delete; sleep 1; wtype -k Delete; sleep 2; shot cats-8-category-deleted
! grep -q "^cat	Test shelf$" "$cf" 2>/dev/null && ok "category deleted" || bad "category still in the state file"
! grep -q "^set	Test shelf	" "$cf" 2>/dev/null && ok "its themes went back" || bad "set line still in the state file"
errs=$(log | tail -n +$((mark + 1)) | grep -E "Core.qml|ReferenceError|TypeError|is not a type|unavailable" | head -5)
[ -z "$errs" ] && ok "no menu errors in the shell log" || bad "log: $errs"
ipc close 2>/dev/null
exit $fail
