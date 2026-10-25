#!/usr/bin/env python3
"""Checks starter-theme-categories against starter-themes: every named theme has one category, no stale names."""
import os, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
names = []
for line in open(os.path.join(root, "starter-themes"), encoding="utf-8").read().split("\n"):
    f = line.split("|")
    if len(f) >= 5 and f[4]:
        names.append(f[4])
cat = {}
errors = []
for n, line in enumerate(open(os.path.join(root, "starter-theme-categories"), encoding="utf-8").read().split("\n"), 1):
    if not line or line.startswith("#"):
        continue
    if "|" not in line or line.startswith("|") or line.endswith("|"):
        errors.append("line %d: not Category|Name: %r" % (n, line))
        continue
    c, name = line.split("|", 1)
    if name in cat:
        errors.append("line %d: %s listed twice (%s and %s)" % (n, name, cat[name], c))
    cat[name] = c
for n in names:
    if n not in cat:
        errors.append("no category for built-in theme: " + n)
for n in cat:
    if n not in names:
        errors.append("category entry for a theme that does not exist: " + n)
if errors:
    print("\n".join(errors))
    sys.exit(1)
print("ok: %d built-in themes in %d categories" % (len(names), len(set(cat.values()))))
