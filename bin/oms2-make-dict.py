#!/usr/bin/env python3
"""oms2-make-dict: made bin/oms2-dict-1.txt, the preset dictionary of OMS2 share codes (bin/omscode2.py).

  oms2-make-dict.py ID [--write]     print the size and sha256 of the dictionary this script builds from the shaders in this
                                     plugin folder; with --write save it as bin/oms2-dict-ID.txt (refuses to overwrite)

How dictionary 1 was built (run once, then committed; the committed file is the source of truth and is never rebuilt at run time,
because the shipped shaders change over time and old codes must keep decoding with the dictionary they were made with):
  1. every shipped .frag in shaders/ colors/ wallpaper-effects/ cursor-shaders/ mouse-effects/ is shortened with
     omscode2.minify (preprocessor, uniform, layout and precision lines left out), one statement per line;
  2. lines of 12+ characters that occur in at least 2 different files are kept, ranked by how often they occur times their
     length; the best ones go last, because the closest bytes are the cheapest to point at;
  3. after them: the shortened lines of rich-examples/*.glsl (function bodies written the way the AI writes them), the helper
     functions of bin/aigen.py, typical function-body idioms, a short word list for names and descriptions and the JSON skeleton
     of a payload with a frame example;
  4. the result is cut to 32,768 bytes (the deflate window) keeping the end.
A new dictionary is a new id (and a new file); an old file is never edited.
"""
import sys
sys.dont_write_bytecode = True
import collections
import glob
import hashlib
import os
import re

HERE = os.path.dirname(os.path.realpath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import omscode2 as C  # noqa: E402
import aigen as G  # noqa: E402

LIMIT = 32768
FOLDERS = ("shaders", "colors", "wallpaper-effects", "cursor-shaders", "mouse-effects")

IDIOMS = """vec3 c=texture(tex,v_texcoord).rgb;
vec2 uv=v_texcoord;
float t=time*0.12;
float v=smoothstep(1.0,0.3,length(uv-0.5));
vec3 col=mix(c,c*vec3(0.8118,0.9373,0.9137)*1.12,0.28);
fragColor=vec4(col,1.0);
fragColor=vec4(clamp(col,0.0,1.0),1.0);
vec3 overlay(vec2 uv,vec3 base,vec2 m,float react){
vec4 cursorFx(vec2 p,vec2 m){
float d=length(p-m);
float d=length(uv-m);
return base+vec3(1.0,0.85,0.7)*band;
return vec4(vec3(1.0,0.85,0.7)*k,k);
float a=noise(uv*vec2(5.0,3.2)+vec2(t,-t*0.6));
float b=noise(uv*vec2(9.0,6.0)+vec2(-t*0.8,t)+7.0);
float k=smoothstep(0.52,0.80,a*0.65+b*0.35);
for(int i=0;i<4;i++){
for(int i=0;i<8;i++){
float fi=float(i);
col+=vec3(1.0,0.9569,0.7843)*k*0.15*(1.1-0.6*luma(c));
col*=0.84+0.16*v;
vec3 g=vec3(luma(c));
col=mix(g,col,1.1);
float edge=smoothstep(0.0,400.0,min(min(v_texcoord.x,1.0-v_texcoord.x)*surface_size.x,min(v_texcoord.y,1.0-v_texcoord.y)*surface_size.y));
float pulse=0.5+0.5*sin(time*2.0);
vec2 p=uv*res/res.y;
const float PI=3.14159265;
if(is_active>0.5){
}else{
}
return vec4(0.0);
"""

WORDS = ("soft warm cool cold glow gentle slow subtle light dark deep bright pale clear fresh quiet calm misty hazy foggy golden amber teal "
         "blue green red pink purple orange violet silver sand stone water pond river lake sea ocean wave ripple rain snow dust smoke "
         "ember fire spark star night day dawn dusk sunset sunrise morning evening moon sun sky cloud wind drift float fade pulse shimmer "
         "sparkle grain scanline vignette edge corner border frame window cursor trail comet streak ring bloom haze tint shade grade "
         "neon retro film paper ink glass frost crystal leaf moss forest garden lotus mountain desert city road track pane screen "
         "wallpaper colour color with and the that over across on of in a to for from near around slightly lightly drifting moving "
         "rounded corners thin thick shadow teal-green border and a soft ")

SKELETON = ('{"v":2,"tv":1,"t":{"n":"","s":"","w":"","m":"","c":"","wf":"","wc":"","wr":"","o":{"fx":65,"col":65,"wall":80,"cur":80,'
            '"wspeed":55,"wzoom":47,"wh":""}},"custom":[{"id":"ai-","k":"screen","name":"","desc":"","code":""},'
            '{"id":"ai-","k":"window","name":"","desc":"","code":""},{"id":"ai-","k":"color","name":"","desc":"","code":""},'
            '{"id":"ai-","k":"wallpaper","name":"","desc":"","code":""},{"id":"ai-","k":"cursor","name":"","desc":"","code":""},'
            '{"id":"ai-","k":"frame","name":"","desc":"","set":{"rounding":16,"border_size":2,"border_angle":45,"shadow_range":28,'
            '"shadow_power":2,"border_colors":"5cc8b5ff,33917eff,6899edff","shadow_color":"2d5d55ff","spin":25}}],"st":65,"p":"rich"}')


def minified_lines(path):
    text = open(path, encoding="utf-8", errors="replace").read()
    text = "\n".join(l for l in text.split("\n") if not re.match(r"\s*(#|uniform\b|layout\b|precision\b|in\s|out\s)", l))
    return C.minify(text).split("\n")


def build():
    count = collections.Counter()
    for folder in FOLDERS:
        for path in sorted(glob.glob(os.path.join(ROOT, folder, "*.frag"))):
            try:
                lines = {l for l in minified_lines(path) if len(l) >= 12}
            except ValueError:
                continue
            count.update(lines)
    keep = [l for l, n in count.items() if n >= 2]
    keep.sort(key=lambda l: (count[l] * len(l), l))
    helpers = "".join(C.minify(src) for _n, _d, src, _k in G.helper_table(True))
    seen, examples = set(), ""
    for path in sorted(glob.glob(os.path.join(ROOT, "rich-examples", "*.glsl"))):
        for l in C.minify(open(path, encoding="utf-8", errors="replace").read()).split("\n"):
            if len(l) >= 8 and l not in seen:
                seen.add(l)
                examples += l + "\n"
    tail = examples + helpers + IDIOMS + WORDS + "\n" + SKELETON
    room = LIMIT - len(tail.encode())
    body = ""
    for l in reversed(keep):
        if len(body.encode()) + len(l) + 1 > room:
            break
        body = l + "\n" + body
    return (body + tail).encode("utf-8")[-LIMIT:]


def main():
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"):
        print(__doc__.strip())
        return 0
    data = build()
    print("%d bytes, sha256 %s" % (len(data), hashlib.sha256(data).hexdigest()))
    if "--write" in a:
        path = os.path.join(HERE, "oms2-dict-%d.txt" % int(a[0]))
        if os.path.exists(path):
            print("refusing to overwrite %s: dictionaries are never edited, add a new id" % path, file=sys.stderr)
            return 1
        with open(path, "wb") as f:
            f.write(data)
        print("wrote " + path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
