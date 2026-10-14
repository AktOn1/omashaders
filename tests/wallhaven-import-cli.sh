#!/usr/bin/env bash
# CLI checks for share codes with a Wallhaven id. Needs the network (one 2.5 MB download into a scratch state). Fakes omarchy-theme-bg-set / omarchy-shell so nothing touches the desktop.
SCRATCH_DIR=${SCRATCH_DIR:-$(mktemp -d)}
cd "$(dirname "$0")/.."
T=$SCRATCH_DIR/cli; rm -rf $T; mkdir -p $T/fakebin $T/s1 $T/s2
cat > $T/fakebin/omarchy-theme-bg-set <<'F'
#!/bin/bash
echo "$1" >> "$FAKELOG"
F
cat > $T/fakebin/omarchy-shell <<'F'
#!/bin/bash
echo "shell $*" >> "$FAKELOG"
F
chmod +x $T/fakebin/*
export PATH=$T/fakebin:$PATH FAKELOG=$T/fake.log 
TC="python3 bin/theme-code"
printf '|neonrain||neon-noir|WH Share||||fx=60,wall=65,wh=jelj7w\n|neonrain||neon-noir|Plain Share||||fx=50\n' > $T/s1/themes
echo "== share with wh"; OMASHADERS_STATE_DIR=$T/s1 $TC share 1 --json | python3 -c "import sys,json; d=json.load(sys.stdin); print({k:v for k,v in d.items() if k!='code'})"
CODEWH=$(OMASHADERS_STATE_DIR=$T/s1 $TC share 1)
echo "== share without wh"; OMASHADERS_STATE_DIR=$T/s1 $TC share 2 --json | python3 -c "import sys,json; d=json.load(sys.stdin); print({k:v for k,v in d.items() if k!='code'})"
CODEPL=$(OMASHADERS_STATE_DIR=$T/s1 $TC share 2)
echo "== check, not cached"; OMASHADERS_STATE_DIR=$T/s2 $TC check "$CODEWH" --json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['wh'], d['wh_cached'])"
OMASHADERS_STATE_DIR=$T/s2 $TC check "$CODEWH" | head -3
echo "== check, code without wh"; OMASHADERS_STATE_DIR=$T/s2 $TC check "$CODEPL" --json | python3 -c "import sys,json; d=json.load(sys.stdin); print(repr(d['wh']), d['wh_cached'])"
echo "== import offline failure (curl proxy to dead port)"
OMASHADERS_STATE_DIR=$T/s2 https_proxy=http://127.0.0.1:9 ALL_PROXY=http://127.0.0.1:9 $TC import "$CODEWH" --wallpaper --json | python3 -c "import sys,json; d=json.load(sys.stdin); print({k:d.get(k) for k in ('ok','number','wallpaper','wallpaper_error')})"
echo "themes file:"; cat $T/s2/themes; echo "fake log:"; cat $FAKELOG 2>/dev/null || echo "(empty)"
echo "== import without --wallpaper (hint)"; OMASHADERS_STATE_DIR=$T/s2 $TC import "$CODEWH" | head -4
echo "== import --wallpaper real download into scratch"
OMASHADERS_STATE_DIR=$T/s2 $TC import "$CODEWH" --wallpaper --json | python3 -c "import sys,json; d=json.load(sys.stdin); print({k:d.get(k) for k in ('ok','existed','wallpaper','wallpaper_error','wh_cached')})"
ls -la $T/s2/wallhaven/full $T/s2/wallhaven/used; echo "fake log:"; cat $FAKELOG
echo "== check now cached"; OMASHADERS_STATE_DIR=$T/s2 $TC check "$CODEWH" --json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['wh'], d['wh_cached'])"
OMASHADERS_STATE_DIR=$T/s2 $TC check "$CODEWH" | sed -n 2,3p
echo "== hostile wh values"
for v in '../../etc/passwd' 'https://evil.example/x' 'ABCDEF' 'abc12' 'abc1234' '$(id)a'; do
 H=$(python3 - "$v" <<'PYEND'
import sys,json,zlib,base64
d={"v":1,"n":"Hostile","s":"neonrain","o":{"wh":sys.argv[1]}}
print("OMS1:"+base64.urlsafe_b64encode(zlib.compress(json.dumps(d).encode())).decode().rstrip("="))
PYEND
)
 printf '%-26s ' "$v"; OMASHADERS_STATE_DIR=$T/s2 $TC import "$H" --wallpaper --json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['ok'], d.get('error','')[:90])"
done
echo "themes after hostile:"; wc -l < $T/s2/themes
echo "== apply flag with fake shell"; OMASHADERS_STATE_DIR=$T/s2 $TC import "$CODEPL" --apply --json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['ok'],d.get('applied'))"; tail -2 $FAKELOG
