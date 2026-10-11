#version 300 es
// target: window
// category: Light
// desc: Wet paper: a watercolour wash of rose, ochre, teal or lilac (one per window, by its seed) has bled in from the edges and corners with a darker pooled rim and fine paper grain; the focused window is more saturated, a pointer over the window nudges where the colour pools; the middle stays clear so text is crisp (static)
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

float wp_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wp_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wp_h(i), wp_h(i + vec2(1.0, 0.0)), f.x), mix(wp_h(i + vec2(0.0, 1.0)), wp_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wp_fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * wp_n(p); p = p * 2.03 + 11.0; a *= 0.5; }
    return v;
}
float wp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 wp_pigment(float k) {
    if (k < 0.25) return vec3(0.93, 0.45, 0.58);      // rose madder
    if (k < 0.50) return vec3(0.93, 0.68, 0.28);      // yellow ochre
    if (k < 0.75) return vec3(0.25, 0.68, 0.70);      // cerulean teal
    return vec3(0.62, 0.50, 0.88);                    // lilac
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    float D = min(surface_size.x, surface_size.y);
    float lum = wp_luma(c);
    float room = 1.0 - 0.92 * smoothstep(0.30, 0.90, lum);          // light content and text keep their look
    float K = mix(0.70, 1.0, act);

    vec2 mp = clamp((mouse - window_box.xy) / max(window_box.zw, vec2(1.0)), vec2(-0.2), vec2(1.2));

    // distance to the nearest edge, with a ragged hand-painted outline
    vec2 q = px / 28.0 + sd * 40.0;
    float rag = (wp_fbm(q) - 0.5) * 38.0;
    float dEdge = min(min(px.x, surface_size.x - px.x), min(px.y, surface_size.y - px.y)) + rag;
    float reach = clamp(D * 0.13, 30.0, 90.0) * (0.8 + 0.5 * wp_fbm(px / 160.0 + sd * 9.0));
    float wash = 1.0 - smoothstep(0.0, reach, dEdge);
    // corners hold more water: a second, softer bloom from the corner nearest the pointer-side
    vec2 cn = vec2(mp.x > 0.5 ? surface_size.x : 0.0, sd > 0.5 ? surface_size.y : 0.0);
    float dc = length(px - cn) / max(D, 1.0);
    float cornerBloom = exp(-dc * dc / (2.0 * 0.28 * 0.28)) * (0.55 + 0.45 * wp_fbm(px / 120.0 + 5.0));

    // pigment pools in a thin darker line where the wash stops
    float pool = smoothstep(7.0, 0.0, abs(dEdge - reach * 0.55)) * smoothstep(0.1, 0.5, wash) * 0.55;

    vec3 pig = wp_pigment(fract(sd * 3.7 + 0.1));
    vec3 pig2 = wp_pigment(fract(sd * 3.7 + 0.1 + 0.25));
    vec3 tint = mix(pig, pig2, smoothstep(0.35, 0.65, wp_fbm(px / 200.0 + sd * 3.0)));

    // paper tooth: granulation inside the wash
    float tooth = wp_n(px / 1.6) * 0.5 + wp_n(px / 4.0 + 7.0) * 0.5;
    float gran = 0.80 + 0.40 * tooth;

    float amt = clamp(wash * 0.85 + cornerBloom * 0.40, 0.0, 1.0) * K;
    // on light paper the pigment multiplies (text stays dark); on a dark window it glows faintly, only behind the background
    float bgDark = 1.0 - smoothstep(0.10, 0.42, lum);
    vec3 mult = c * mix(vec3(1.0), mix(tint, vec3(1.0), 0.18) * (0.88 + 0.22 * tooth), amt * 0.78 * smoothstep(0.35, 0.8, lum));
    vec3 glow = c + tint * (0.30 + 0.14 * tooth) * amt * bgDark * (0.55 + 0.45 * act);
    c = mix(mult, glow, bgDark);
    c *= 1.0 - pool * 0.10 * K * smoothstep(0.35, 0.8, lum);

    // the whole window gets the barest paper warmth in its dark parts
    float dark = 1.0 - smoothstep(0.08, 0.40, lum);
    c = mix(c, c * vec3(1.02, 1.0, 0.97) + vec3(0.006, 0.004, 0.002), dark * 0.6 * K);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
