#version 300 es
// target: window
// category: Glass
// desc: DOS box: a thin double-line frame sits just inside the window like an old text-mode dialog, in an EGA colour that each window picks for itself (cyan, yellow, light green, light magenta), with a dithered stipple shadow along the lower and right inner edges; bright on the focused window, dim on the others, text stays crisp (static)
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
uniform vec2 mouse;
uniform vec4 window_box;
layout(location = 0) out vec4 fragColor;

float db_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float db_bayer(vec2 p) {                              // 4x4 ordered dither threshold
    vec2 q = mod(floor(p), 4.0);
    float a = mod(q.x, 2.0), b = floor(q.x / 2.0);
    float c = mod(q.y, 2.0), d = floor(q.y / 2.0);
    float i0 = abs(a - c), i1 = abs(b - d);
    return (i0 * 8.0 + c * 4.0 + i1 * 2.0 + d + 0.5) / 16.0;
}
vec3 db_accent(float sd) {
    if (sd < 0.25) return vec3(0.33, 1.0, 1.0);      // light cyan
    if (sd < 0.50) return vec3(1.0, 1.0, 0.33);      // yellow
    if (sd < 0.75) return vec3(0.33, 1.0, 0.33);     // light green
    return vec3(1.0, 0.33, 1.0);                     // light magenta
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                              // un-premultiply; the composer re-applies alpha
    float act = is_active;
    vec2 px = uv * surface_size;
    float lum = db_luma(c);
    float darkBg = 1.0 - smoothstep(0.14, 0.32, lum);
    float lightBg = smoothstep(0.76, 0.90, lum);
    float K = mix(0.55, 1.0, act);

    vec2 toEdge = min(px, surface_size - px);
    float dl = min(toEdge.x, toEdge.y);
    // two 1-pixel rules, 3 px apart, 4 px in from the edge
    float l1 = step(4.0, dl) * step(dl, 5.0);
    float l2 = step(7.0, dl) * step(dl, 8.0);
    float lines = max(l1, l2);
    vec3 acc = db_accent(fract(seed * 3.7));

    // stipple shadow: a 2 px dither that thickens toward the lower and right edges
    vec2 fromRB = surface_size - px;
    float sh = max(1.0 - smoothstep(0.0, 22.0, fromRB.x), 1.0 - smoothstep(0.0, 22.0, fromRB.y));
    sh *= step(9.0, dl);
    float dots = step(db_bayer(px * 0.5), sh * 0.55);

    // a dark background takes a bright frame and a darker stipple; a light one takes a deep blue frame
    vec3 dk = c;
    dk = mix(dk, acc * 0.80, lines * 0.55 * K);
    dk *= 1.0 - dots * 0.35 * K;
    vec3 lt = c;
    lt = mix(lt, mix(vec3(0.0, 0.0, 0.55), acc * vec3(0.45, 0.45, 0.45), 0.35), lines * 0.50 * K);
    lt *= 1.0 - dots * 0.14 * K;
    float w = darkBg + lightBg;
    vec3 outc = mix(dk, lt, lightBg / max(w, 0.001));
    c = mix(c, outc, min(w, 1.0));
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
