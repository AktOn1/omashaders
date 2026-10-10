#version 300 es
// category: Ambient
// desc: Canopy light: soft diagonal sun shafts and dappled glow filter down from above, pollen motes drift and catch the light, a faint green-gold haze pools at the bottom (animated)
// strength: 45
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;

float cp_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 cp_h2(vec2 p) { return vec2(cp_h(p), cp_h(p + 19.19)); }
float cp_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(cp_h(i), cp_h(i + vec2(1.0, 0.0)), f.x), mix(cp_h(i + vec2(0.0, 1.0)), cp_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 cp_rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

// pollen / dust motes: one jittered mote per grid cell, rising slowly with a lazy sideways wobble, glinting as it turns
float cp_pollen(vec2 uv, float scale, float speed, float seed) {
    vec2 p = uv * vec2(1.78, 1.0) * scale;
    p.y += time * speed;
    p.x += sin(time * 0.17 + seed) * 0.8 + sin(p.y * 0.6 + seed) * 0.25 + time * speed * 0.35;
    vec2 id = floor(p), f = fract(p) - 0.5;
    float h = cp_h(id + seed);
    if (h < 0.60) return 0.0;
    vec2 o = (cp_h2(id + seed + 3.1) - 0.5) * 0.6;
    o += 0.12 * vec2(sin(time * 0.6 + h * 40.0), cos(time * 0.5 + h * 23.0));
    float r = 0.05 + 0.06 * cp_h(id + seed + 1.3);
    float glint = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(time * (0.6 + h * 1.4) + h * 90.0), 3.0);
    return smoothstep(r, r * 0.15, length(f - o)) * glint;
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float S = STRENGTH;
    float K = S * 2.2222;                                              // 1.0 at the default strength
    float y = 1.0 - uv.y;                                              // 1 at the top
    vec2 p = vec2(uv.x * 1.78, uv.y);

    // soft diagonal sun shafts slanting down-left from the upper right, breathing as leaves pass in front of the sun
    float sx = p.x + p.y * 0.62;
    float shafts = cp_n(vec2(sx * 2.6 + time * 0.035, 1.0)) * 0.55
                 + cp_n(vec2(sx * 6.1 - time * 0.028, 4.0)) * 0.30
                 + cp_n(vec2(sx * 13.0 + time * 0.02, 9.0)) * 0.15;
    shafts = smoothstep(0.55, 0.80, shafts);
    float along = cp_n(vec2(sx * 0.9, p.y * 3.0 - time * 0.16)) * 0.6 + 0.4;   // dapples sliding down each shaft
    float fall = pow(y, 1.05);
    float shaft = shafts * along * fall * (0.8 + 0.2 * sin(time * 0.3 + sx * 3.0));
    vec3 sunCol = vec3(1.0, 0.86, 0.50);

    // dappled glow near the top: soft sun patches drifting through the foliage
    vec2 q = cp_rot(p * 3.2 + vec2(time * 0.04, time * 0.015), 0.4);
    float dap = cp_n(q) * 0.6 + cp_n(cp_rot(q, 1.2) * 2.3 + 5.0 - time * 0.03) * 0.4;
    dap = smoothstep(0.52, 0.80, dap) * smoothstep(0.30, 0.95, y) * (0.75 + 0.25 * sin(time * 0.5 + p.x * 4.0));

    // haze: faint green-gold fog pooling at the bottom, with a slow ripple
    float haze = smoothstep(0.50, 1.0, uv.y) * (0.75 + 0.25 * cp_n(vec2(p.x * 2.0 + time * 0.02, uv.y * 5.0)));
    vec3 hazeCol = vec3(0.42, 0.50, 0.16);

    // a very gentle warm green-gold cast overall, a touch of shade in the corners
    float vig = smoothstep(0.35, 1.05, length((uv - 0.5) * vec2(1.15, 1.0)));
    c = mix(c, c * vec3(1.03, 1.04, 0.90), 0.55 * K);
    c *= 1.0 - 0.10 * vig * K;
    c = mix(c, c * 0.88 + hazeCol * 0.22, haze * 0.26 * K);

    c += sunCol * shaft * 0.36 * K;
    c += vec3(1.0, 0.88, 0.52) * dap * 0.15 * K;

    // pollen: warm specks, two depths (the near ones bigger, slower and brighter), brighter inside the light
    float lit = 0.55 + 0.9 * min(1.0, shaft * 2.0 + dap) ;
    float pol = cp_pollen(uv, 26.0, 0.012, 2.0) + 0.7 * cp_pollen(uv + 0.37, 46.0, 0.020, 11.0) + 0.6 * cp_pollen(uv + 0.71, 11.0, 0.008, 23.0);
    c += vec3(1.0, 0.82, 0.38) * pol * lit * 0.50 * K;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
