#version 300 es
// target: window
// category: Glass
// desc: Steam fog: a faint condensation haze creeps in from the window edges and clears in a soft circle around the pointer; stronger on windows that are not focused, a few frozen droplet trails, each window fogs differently (static)
// strength: 50
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
uniform vec4 window_box;
uniform vec2 resolution;
uniform vec2 mouse;
layout(location = 0) out vec4 fragColor;

float sf_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sf_noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sf_hash(i), sf_hash(i + vec2(1.0, 0.0)), f.x), mix(sf_hash(i + vec2(0.0, 1.0)), sf_hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float sf_fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * sf_noise(p); p = p * 2.03 + 11.0; a *= 0.5; }
    return v;
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                      // un-premultiply; the composer re-applies alpha
    float S = STRENGTH;
    float K = S * 2.0;                                        // 1.0 at the default strength
    float act = is_active;
    float sd = fract(seed);

    vec2 size = max(surface_size, vec2(1.0));
    vec2 px = uv * size;
    float u = sqrt(size.x * size.y);                          // a length that scales with the window

    // how far the fog reaches in from the edge: further on unfocused windows, a different shape per window (seed)
    float reach = u * mix(0.20, 0.12, act);
    vec2 np = px / u * 3.2 + vec2(sd * 40.0, sd * 17.0);
    float n = sf_fbm(np);
    float edge = min(min(px.x, size.x - px.x), min(px.y, size.y - px.y));
    float edgeFog = 1.0 - smoothstep(0.0, reach * (0.55 + 0.9 * n), edge);
    // fog is thicker along the bottom (warm air rising) and the top, as if the steam comes from below and pools at the top
    float vert = 0.75 + 0.25 * abs(uv.y - 0.5) * 2.0;
    // soft drifting cloud patches inside, only on unfocused windows
    float patch_ = smoothstep(0.55, 0.85, sf_fbm(np * 0.7 + 5.0)) * (1.0 - act) * 0.55;
    float fog = clamp(edgeFog * vert + patch_, 0.0, 1.0);

    // droplet trails: frozen thin streaks that run down out of the fogged top, a few per window
    float col = floor(px.x / (0.022 * u));
    float ch = sf_hash(vec2(col, floor(sd * 100.0)));
    float trailX = abs(fract(px.x / (0.022 * u)) - 0.5);
    float trailLen = (0.10 + 0.20 * sf_hash(vec2(col, 9.0))) * size.y;
    float trail = step(0.86, ch) * smoothstep(0.10, 0.02, trailX) * (1.0 - smoothstep(0.0, trailLen, px.y))
                * smoothstep(0.0, 0.03 * u, px.y);
    // fine droplets: sparse tiny beads of different sizes, jittered inside their cells so no grid shows
    vec2 dg = px / (0.020 * u);
    vec2 di = floor(dg);
    vec2 jit = vec2(sf_hash(di + sd * 13.0), sf_hash(di.yx + 3.7 + sd * 7.0));
    float bsz = 0.10 + 0.16 * sf_hash(di + 8.1);
    float bead = smoothstep(bsz, bsz * 0.3, length(fract(dg) - (0.2 + 0.6 * jit))) * step(0.78, sf_hash(di + sd * 29.0 + 0.5));

    // the pointer wipes the glass clear: a soft circle, and the fog is already thin where the window is focused
    vec2 mp = mouse - window_box.xy;
    bool inside = mp.x > 0.0 && mp.y > 0.0 && mp.x < window_box.z && mp.y < window_box.w;
    float clearR = 0.17 * u;
    float wipe = inside ? 1.0 - smoothstep(0.35 * clearR, clearR, length(px - mp)) : 0.0;
    fog *= 1.0 - wipe;
    trail *= 1.0 - wipe;
    bead *= 1.0 - wipe;

    // what the fog does: it softly brightens and desaturates toward a warm steam white, never much (text stays readable)
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 steam = vec3(0.93, 0.92, 0.88);
    float f = fog * 0.30 * K * mix(1.0, 0.8, act);
    c = mix(c, mix(vec3(lum), c, 0.55), f);                   // less colour
    c = mix(c, steam * (0.55 + 0.45 * lum) + vec3(0.04), f * 0.55);   // a wash of steam white; keeps some contrast on dark windows
    c += vec3(0.95, 0.96, 0.98) * (bead * fog * 0.10 + trail * 0.06) * K;
    c -= vec3(0.05) * trail * (1.0 - lum) * K * 0.5;          // droplet trails read as clear glass: a touch darker on bright areas

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
