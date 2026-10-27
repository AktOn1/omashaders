#version 300 es
// target: window
// category: Glass
// desc: Bubble pane: the window is skinned with a soap film, a broad iridescent sheen that leans toward the pointer, a thin prism along every edge and a pearl highlight in one corner; much stronger on the focused window, text keeps its contrast (static)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
uniform vec2 mouse;
uniform vec4 window_box;
layout(location = 0) out vec4 fragColor;

float bp_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bp_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(bp_h(i), bp_h(i + vec2(1.0, 0.0)), f.x), mix(bp_h(i + vec2(0.0, 1.0)), bp_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float bp_fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * bp_n(p); p = p * 2.03 + 11.0; a *= 0.5; }
    return v;
}
float bp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// thin-film interference: an extra optical path D (nm) between the film's two
// faces cancels some wavelengths and doubles others, which is a bubble's colour
vec3 bp_film(float D) {
    float d = max(D, 0.0);
    vec3 l = vec3(612.0, 549.0, 464.0);
    vec3 a = sin(3.14159265 * d / l);
    vec3 b = sin(3.14159265 * (d * 1.10 + 34.0) / l);
    return (a * a + b * b) * 0.5;
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                          // un-premultiply; the composer re-applies alpha
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    float D0 = max(surface_size.x, surface_size.y);
    float lum = bp_luma(c);
    // text and bright plates get almost nothing: the film is a veil over the glass
    float room = 1.0 - 0.66 * smoothstep(0.38, 0.95, lum);
    float K = mix(0.42, 1.0, act);                                // the focused window carries the film

    // where the pointer is inside the window, 0..1 (it stays sane when it is outside)
    vec2 mp = clamp((mouse - window_box.xy) / max(window_box.zw, vec2(1.0)), -1.0, 2.0);

    // ---- the film's thickness: a broad slope that leans toward the pointer, plus a slow crease
    vec2 g = (uv - clamp(mp, 0.0, 1.0));
    float lean = dot(g, normalize(vec2(0.72, -0.69))) ;
    float crease = bp_fbm(px / 190.0 + sd * 17.0) - 0.5;
    float th = 0.52 + 0.46 * lean + 0.30 * crease + 0.22 * (uv.y - 0.5);   // it drains downward too
    vec3 film = bp_film(260.0 + 520.0 * clamp(th, 0.0, 1.6));

    // the hue is laid on without moving the brightness, so contrast is untouched
    float fl = dot(film, vec3(0.3333));
    vec3 chroma = film - fl;
    float sheen = (0.44 + 0.56 * smoothstep(0.05, 0.40, lum)) * room * K;
    c += chroma * sheen * 0.44;
    c += film * sheen * 0.060;                                    // a whisper of the reflection itself

    // ---- a thin prism along the window's edges: warm just inside, cool just outside
    float dEdge = min(min(px.x, surface_size.x - px.x), min(px.y, surface_size.y - px.y));
    float lip = exp(-dEdge / 2.2);
    float band = exp(-pow((dEdge - 3.2) / 2.4, 2.0));
    vec3 prism = bp_film(300.0 + 640.0 * (0.5 + 0.5 * sin(dot(px, vec2(0.012, 0.009)) + sd * 6.0)));
    c += prism * band * (0.16 + 0.22 * act);
    c += vec3(0.80, 0.90, 1.0) * lip * (0.07 + 0.13 * act);

    // ---- a pearl highlight in one corner, as on the shoulder of a bubble
    vec2 corner = vec2(sd < 0.5 ? surface_size.x * 0.16 : surface_size.x * 0.84, surface_size.y * 0.14);
    float dc = length(px - corner) / D0;
    c += vec3(0.93, 0.97, 1.0) * exp(-dc * dc / (2.0 * 0.17 * 0.17)) * 0.075 * K * room;

    // the unfocused window keeps a quiet cool wash so the focused one clearly stands out
    c = mix(c, c * vec3(0.965, 0.985, 1.015), (1.0 - act) * 0.65);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
