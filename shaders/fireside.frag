#version 300 es
// category: Ambient
// desc: Fireside: the screen is the room lit only by the hearth, a flickering warm pool from the lower left falls off into deep brown shadow, with embers drifting up and faint smoke wisps at the top (animated)
// strength: 45
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;

float fs_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fs_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fs_h(i), fs_h(i + vec2(1.0, 0.0)), f.x), mix(fs_h(i + vec2(0.0, 1.0)), fs_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fs_fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * fs_n(p); p = p * 2.03 + 7.1; a *= 0.5; }
    return v;
}
// smooth firelight level around 1.0, a few sines and a slow noise, never strobing
float fs_flicker(float t) {
    return 1.0 + 0.045 * sin(t * 2.1) + 0.03 * sin(t * 3.7 + 1.3) + 0.02 * sin(t * 6.1 + 0.6)
               + 0.06 * (fs_n(vec2(t * 1.3, 4.0)) - 0.5);
}
// rising embers: cells drift up, sway, twinkle and fade with height; fuller near the fire
float fs_ember(vec2 uv, float scale, float speed, float seed, vec2 fire) {
    vec2 p = vec2(uv.x * 1.78, uv.y) * scale;
    p.y += time * speed;                                   // uv.y grows downward, so embers climb
    p.x += sin(time * 0.6 + seed + p.y * 0.8) * 0.35 + (time * speed) * 0.08;
    vec2 id = floor(p), f = fract(p) - 0.5;
    float h = fs_h(id + seed);
    vec2 cuv = vec2((id.x + 0.5) / scale / 1.78, (id.y + 0.5 - time * speed) / scale);
    float near = exp(-length((cuv - fire) * vec2(1.78, 1.0)) * 0.9);
    if (h > 0.22 * (0.22 + near)) return 0.0;
    vec2 o = (vec2(fs_h(id + seed + 3.1), fs_h(id + seed + 7.7)) - 0.5) * 0.5;
    float r = 0.04 + 0.05 * fs_h(id + seed + 1.3);
    float tw = 0.55 + 0.45 * sin(time * (3.0 + 5.0 * fs_h(id + seed + 5.5)) + h * 40.0);
    float life = smoothstep(0.0, 0.25, 1.0 - cuv.y) * smoothstep(1.05, 0.35, 1.0 - cuv.y);   // born low, burn out high
    float d = length(f - o);
    return (smoothstep(r, r * 0.15, d) + 0.25 * smoothstep(r * 4.0, 0.0, d)) * tw * clamp(life + 0.15, 0.0, 1.0);
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float S = STRENGTH;
    float k = S / 0.45;                                    // 1.0 at the shipped strength
    float t = time;

    // the hearth sits just off the lower-left corner; light falls off with distance, its reach breathes with the flames
    vec2 fire = vec2(-0.04, 1.06);
    vec2 q = (uv - fire) * vec2(1.78, 1.0);
    float fk = fs_flicker(t) * 0.5 + fs_flicker(t * 0.8 + 5.0 + length(q) * 0.7) * 0.5;   // far light lags a little
    float d = length(q) / fk;
    // flames waver the pool's edge a little so it feels alive rather than a gradient
    d += (fs_fbm(q * 2.2 + vec2(0.0, -t * 0.35)) - 0.5) * 0.14;
    float pool = exp(-d * 1.15);
    float core = exp(-d * 2.4);

    // room: deep warm shadow in the far corners, fire-tinted light in the pool
    float light = clamp(pool * 1.7, 0.0, 1.0);
    vec3 shade = vec3(0.66, 0.52, 0.46);                   // brown-black shadow multiplier
    vec3 lit = vec3(1.12, 0.92, 0.72);                     // warm light on the surface
    vec3 grade = mix(shade, lit, light);
    c = mix(c, c * grade + vec3(0.010, 0.004, 0.0) * (1.0 - light), min(k, 1.5));
    // additive firelight, mostly on darker pixels so text contrast holds
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c += vec3(1.0, 0.46, 0.14) * (pool * 0.22 + core * 0.30) * fk * k * (1.0 - 0.7 * lum);

    // faint smoke wisps curling at the top, lit warmly from below
    float top = smoothstep(0.55, 0.0, uv.y);
    vec2 sp = vec2(uv.x * 1.78, uv.y) * vec2(2.2, 3.2);
    vec2 warp = vec2(fs_fbm(sp + vec2(0.0, t * 0.05)), fs_fbm(sp + 5.0 - vec2(t * 0.04, 0.0)));
    float smoke = fs_fbm(sp * 0.9 + warp * 1.6 + vec2(t * 0.03, -t * 0.06));
    smoke = smoothstep(0.50, 0.85, smoke) * top;
    c = mix(c, c * 0.85 + vec3(0.26, 0.16, 0.10) * (0.5 + 0.6 * pool), smoke * 0.6 * k);

    // embers, two depths
    float e = fs_ember(uv, 13.0, 0.04, 0.0, fire) + 0.7 * fs_ember(uv + 0.31, 24.0, 0.065, 13.0, fire);
    c += mix(vec3(1.0, 0.38, 0.08), vec3(1.0, 0.72, 0.32), clamp(e, 0.0, 1.0)) * e * 0.55 * min(k, 1.4);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
