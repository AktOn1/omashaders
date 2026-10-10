#version 300 es
// category: Ambient
// desc: Dome night: the inside of an observatory dome with the slot open to the sky, a cold wash of starlight falls in from the top centre, fine star dust twinkles in the dark, slow cold haze drifts and the edges sink into blue-black (animated)
// strength: 45
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;

float dn_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dn_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(dn_h(i), dn_h(i + vec2(1.0, 0.0)), f.x), mix(dn_h(i + vec2(0.0, 1.0)), dn_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float dn_fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * dn_n(p); p = p * 2.03 + 5.3; a *= 0.5; }
    return v;
}
// star dust on a fine grid (cells in screen-height units): tiny points that twinkle, each at its own rate
float dn_dust(vec2 p, float scale, float sd) {
    vec2 q = p * scale;
    vec2 id = floor(q), f = fract(q) - 0.5;
    float h = dn_h(id + sd);
    if (h < 0.80) return 0.0;
    vec2 o = (vec2(dn_h(id + sd + 3.1), dn_h(id + sd + 7.7)) - 0.5) * 0.5;
    float r = 0.17 + 0.12 * dn_h(id + sd + 1.3);
    float tw = 0.5 + 0.5 * sin(time * (0.5 + 2.5 * dn_h(id + sd + 5.5)) + h * 90.0);
    float b = dn_h(id + sd + 9.9);
    return smoothstep(r, r * 0.15, length(f - o)) * (0.25 + 0.75 * b * b) * (0.3 + 0.7 * tw);
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float S = STRENGTH / 0.45;                                             // 1.0 at the default 45 %
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float dark = 1.0 - smoothstep(0.10, 0.45, lum);                        // star dust and haze only live on dark pixels
    vec2 p = vec2(uv.x * 1.78, uv.y);
    vec2 q = uv - vec2(0.5, 0.0);                                          // x relative to the centre line of the slot

    // the dome slot: a tall opening at the top centre, widest at the top and narrowing as it falls
    float width = mix(0.15, 0.045, smoothstep(0.0, 0.95, uv.y));
    float sway = (dn_n(vec2(uv.y * 2.0 + time * 0.03, 1.0)) - 0.5) * 0.02;  // the edges of the slot wobble very slightly
    float slot = smoothstep(width, width * 0.15, abs(q.x + sway));
    float slotFall = pow(1.0 - uv.y, 1.7);
    float inSlot = slot * slotFall;

    // dome interior: cold blue-black vignette, strongest at the sides and corners, and tall (the slot keeps it open)
    vec2 v = (uv - vec2(0.5, 0.42)) * vec2(1.25, 1.0);
    float edge = smoothstep(0.18, 0.95, length(v * vec2(1.0, 0.85)));
    float vig = clamp(edge * (1.0 - 0.7 * inSlot), 0.0, 1.0);
    float side = smoothstep(0.30, 0.52, abs(uv.x - 0.5)) * (1.0 - 0.8 * slot);
    vig = clamp(vig + side * 0.25, 0.0, 1.0);
    c = mix(c, c * vec3(0.55, 0.64, 0.86) + vec3(0.0, 0.003, 0.014), vig * 0.65 * S * (1.0 - 0.45 * smoothstep(0.3, 0.8, lum)));

    // everything is a touch cooler under the dome
    c = mix(c, c * vec3(0.90, 0.96, 1.05), 0.55 * S);

    // starlight pouring in through the slot: a faint pale-blue wash, drifting a little
    float drift = 0.75 + 0.25 * dn_fbm(vec2(p.x * 3.0, p.y * 2.0 - time * 0.02) + 3.0);
    vec3 wash = vec3(0.30, 0.44, 0.80) * inSlot * drift;
    c += wash * 0.17 * S * (0.03 + 0.97 * dark);
    // a thin cool-white core line down the middle of the slot (the sky itself)
    c += vec3(0.55, 0.65, 0.95) * smoothstep(width * 0.30, 0.0, abs(q.x + sway)) * slotFall * 0.05 * S * dark;

    // slow cold haze: faint drifting cloud on dark areas, thicker near the floor of the dome
    float haze = dn_fbm(p * 2.2 + vec2(time * 0.012, -time * 0.006)) * 0.65 + dn_fbm(p * 5.0 - vec2(time * 0.02, 0.0) + 9.0) * 0.35;
    haze = smoothstep(0.35, 0.8, haze) * (0.45 + 0.55 * uv.y);
    c += vec3(0.07, 0.10, 0.20) * haze * 0.16 * S * dark;

    // star dust: very fine, twinkling, brighter inside the slot where you see more sky; never on text
    vec2 dp = vec2(uv.x * 1.78, uv.y);
    float st = dn_dust(dp, 190.0, 0.0) * 0.55 + dn_dust(dp + 0.3, 110.0, 5.0) * 0.8 + dn_dust(dp + 0.6, 60.0, 11.0);
    st *= 0.55 + 0.9 * inSlot + 0.25 * (1.0 - vig);
    vec3 starCol = mix(vec3(0.75, 0.86, 1.0), vec3(1.0, 0.88, 0.70), step(0.93, dn_h(floor(dp * 110.0))));
    c += starCol * st * 0.42 * S * dark;

    // blue-black edge shadow: the dome wall closes in at the very edges
    float wall = smoothstep(0.35, 0.0, min(min(uv.x, 1.0 - uv.x) * 1.0, min(uv.y * 0.6 + 0.08, 1.0 - uv.y)));
    c *= 1.0 - wall * 0.35 * S;
    c += vec3(0.0, 0.004, 0.016) * wall * S;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
