#version 300 es
// target: window
// category: Glass
// desc: Chrome sweep: a brushed-metal band runs around the window edge with a thin bright bevel line, and a soft reflective sweep leans toward the pointer across the glass; the focused window is polished brighter, text keeps its contrast (static)
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

float cw_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cw_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                              // un-premultiply; the composer re-applies alpha
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    float D = max(surface_size.x, surface_size.y);
    float lum = cw_lum(c);
    float room = 1.0 - 0.88 * smoothstep(0.38, 0.95, lum);            // light areas and text get far less
    float K = mix(0.55, 1.0, act);

    // ---- the edge band: a strip of brushed steel wrapped around the window
    float dx = min(px.x, surface_size.x - px.x);
    float dy = min(px.y, surface_size.y - px.y);
    float edge = min(dx, dy);
    float bandW = clamp(D * 0.020, 9.0, 26.0);
    float band = smoothstep(bandW, 0.0, edge);
    // brushing runs along the nearer edge, so the grain turns the corner
    float along = dx < dy ? px.y : px.x;
    float fibre = 0.62 + 0.38 * cw_h(vec2(floor(along * 0.85), floor(edge * 0.5) * 0.17 + 3.0));
    // light/dark steel gradient across the band
    float g = edge / bandW;
    vec3 steel = mix(vec3(0.86, 0.91, 0.99), vec3(0.13, 0.16, 0.22), smoothstep(0.05, 0.95, g));
    c = mix(c, steel * (0.72 + 0.46 * fibre), band * 0.42 * K);
    // a thin bright bevel line a little inside the edge
    float bevel = exp(-pow((edge - bandW * 0.82) / max(bandW * 0.10, 0.7), 2.0));
    c += vec3(0.80, 0.88, 1.00) * bevel * (0.10 + 0.10 * act);

    // ---- the reflective sweep: a wide soft band of polish that leans toward the pointer
    vec2 mp = clamp((mouse - window_box.xy) / max(window_box.zw, vec2(1.0)), -0.6, 1.6);
    float ang = 1.05 + 0.30 * (sd - 0.5);                             // each window is polished at its own angle
    vec2 dir = vec2(cos(ang), sin(ang));
    float proj = dot(px, dir) / D;
    float centre = dot(vec2(mp.x, mp.y) * surface_size, dir) / D;
    float sweep = exp(-pow((proj - centre) / 0.30, 2.0));
    float sweep2 = exp(-pow((proj - centre - 0.22) / 0.045, 2.0)) * 0.6;
    float grain = 0.80 + 0.20 * cw_h(vec2(floor(dot(px, vec2(-dir.y, dir.x)) * 0.33), 9.0));
    float pol = (sweep * 0.095 + sweep2 * 0.080) * grain * K;
    c += vec3(0.72, 0.82, 1.00) * pol * room;
    // on a bright window the polish reads the other way round, as a faint cool shade, so it is visible without touching the text
    float bright = smoothstep(0.45, 0.95, lum);
    c *= 1.0 - pol * 0.55 * bright;

    // ---- a very light cool cast on the dark parts, so the glass reads as metal-backed
    float dark = 1.0 - smoothstep(0.08, 0.46, lum);
    c = mix(c, c * vec3(0.95, 0.99, 1.05) + vec3(0.003, 0.007, 0.014), 0.45 * dark * K);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
