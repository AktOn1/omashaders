#version 300 es
// category: Mood
// desc: Snug cabin: light frost haze creeps in from the screen corners and edges while a warm amber glow fills the middle, with a gentle vignette; the centre stays clear and text-safe (static)
// strength: 50
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float cf_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cf_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(cf_h(i), cf_h(i + vec2(1.0, 0.0)), f.x), mix(cf_h(i + vec2(0.0, 1.0)), cf_h(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float K = STRENGTH * 2.0;                                          // 1.0 at the default strength
    vec2 p = vec2(uv.x * 1.78, uv.y);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));

    // warm amber glow from the middle of the room, as if a stove were burning just out of sight
    float r = length((uv - vec2(0.5, 0.55)) * vec2(1.1, 1.0));
    float warm = 1.0 - smoothstep(0.0, 0.85, r);
    c = mix(c, c * vec3(1.07, 1.01, 0.84), warm * 0.55 * min(K, 1.5));
    c += vec3(0.060, 0.030, 0.004) * warm * warm * (1.0 - 0.6 * l) * K;

    // frost: how far it has crept in from the nearest edge, much further into the corners; a ragged, crystalline front
    float dx = min(uv.x, 1.0 - uv.x) * 1.78;
    float dy = min(uv.y, 1.0 - uv.y);
    float dEdge = min(dx, dy);
    float dc = length(vec2(dx, dy));
    float tang = dx < dy ? p.y : p.x;
    float fing = cf_n(vec2(tang * 30.0, 2.0)) * 0.6 + cf_n(vec2(tang * 80.0, 6.0)) * 0.4;
    float warp = (cf_n(p * 14.0 + 3.0) - 0.5) * 0.020 + (cf_n(p * 38.0) - 0.5) * 0.008;
    // reach: a thin rim of frost along the edges, growing into deep feathery drifts in the four corners
    float reach = 0.022 + 0.15 * exp(-dc * 4.8) * (0.75 + 0.5 * cf_n(p * 2.6 + 1.3)) + 0.012 * fing;
    float f = smoothstep(reach, reach * 0.25, dEdge + warp + 0.5 * reach * fing * fing * 0.6);   // 1 inside the frost, 0 in the clear middle
    float grainy = cf_n(p * 260.0) * 0.5 + cf_n(p * 620.0) * 0.5;                    // fine rime texture, static
    float veins = 1.0 - abs(2.0 * cf_n(p * 130.0 + warp * 90.0) - 1.0);
    veins = pow(veins, 8.0);
    vec3 frost = vec3(0.82, 0.91, 1.0);
    float haze = f * (0.085 + 0.06 * grainy) + f * f * 0.11 * veins;
    c = mix(c, frost, clamp(haze, 0.0, 0.32) * K);
    c += vec3(0.02, 0.035, 0.05) * f * K * (1.0 - l);                              // cool blue shade in the frosted corners

    // gentle vignette, a touch cooler toward the edges
    float vig = smoothstep(0.40, 1.05, length((uv - 0.5) * vec2(1.1, 1.0)));
    c *= 1.0 - 0.10 * vig * K;
    c = mix(c, c * vec3(0.93, 0.98, 1.05), vig * 0.35 * K);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
