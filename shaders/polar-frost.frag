#version 300 es
// category: Mood
// desc: Polar frost: crystalline ice creeps in from the screen edges and corners with glittering facets and a cold rim light, the middle stays clear and readable (static)
// strength: 50
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float pf_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 pf_h2(vec2 p) { return vec2(pf_h(p), pf_h(p + 19.19)); }
float pf_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(pf_h(i), pf_h(i + vec2(1.0, 0.0)), f.x), mix(pf_h(i + vec2(0.0, 1.0)), pf_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float pf_fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * pf_n(p); p = p * 2.07 + 11.3; a *= 0.5; }
    return v;
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float S = STRENGTH;
    vec2 p = vec2(uv.x * 1.78, uv.y);
    // distance to the nearest edge in screen-height units; the top gets frost only in the corners, corners add up
    float dx = min(uv.x, 1.0 - uv.x) * 1.78;
    float dy = uv.y < 0.5 ? uv.y * 2.0 + 0.05 + 0.6 * smoothstep(0.0, 0.5, dx) : 1.0 - uv.y;
    float d = -log(exp(-14.0 * dx) + exp(-14.0 * dy)) / 14.0;
    // ice fingers grow inwards from the nearest edge: tangential position drives their length
    float tan_ = dx < dy ? p.y : p.x;
    float fing = pf_n(vec2(tan_ * 46.0, 3.0)) * 0.6 + pf_n(vec2(tan_ * 120.0, 8.0)) * 0.4;
    float patch_ = 0.55 + 0.9 * pf_fbm(p * 2.6 + 1.7);               // frost is thicker in some places
    float warp = (pf_fbm(p * 9.0 + 3.0) - 0.5) * 0.05;
    float f = d + warp - 0.05 * fing * fing * patch_;
    float front = (0.010 + 0.15 * S) * patch_;
    float mask = smoothstep(front, front * 0.25, f) * min(1.0, S * 5.0) * smoothstep(0.03, 0.06, uv.y + 0.0 * dx);
    // cold navy vignette, grows with strength
    float vig = smoothstep(0.50, 0.0, d + 0.03) * S;
    c = mix(c, c * vec3(0.62, 0.76, 1.0) + vec3(0.0, 0.010, 0.040), vig * 0.55);
    if (mask > 0.002) {
        // voronoi facets: random refraction per cell, fine bright cracks where cells meet
        vec2 q = p * 24.0 + (vec2(pf_n(p * 6.0), pf_n(p * 6.0 + 9.0)) - 0.5) * 2.2;   // warped, so the plates look organic
        vec2 ip = floor(q), fp = fract(q);
        float f1 = 9.0, f2 = 9.0;
        vec2 cid = vec2(0.0);
        for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
                vec2 g = vec2(float(i), float(j));
                vec2 o = pf_h2(ip + g);
                float dd = length(g + o - fp);
                if (dd < f1) { f2 = f1; f1 = dd; cid = ip + g; }
                else if (dd < f2) { f2 = dd; }
            }
        }
        vec2 rnd = pf_h2(cid + 7.7);
        float tone = pf_h(cid + 2.2);
        float crack = smoothstep(0.045, 0.0, f2 - f1);
        float deep = smoothstep(front * 0.9, 0.0, f);                   // 0 at the front, 1 well inside the ice
        // frosted glass: refract per facet and soften with four taps, more strongly deeper in the ice
        vec2 off = (rnd - 0.5) * (0.003 + 0.012 * deep);
        vec2 b = vec2(0.0022, 0.0022 * 1.78);
        vec3 fr = texture(tex, uv + off + vec2(b.x, 0.0)).rgb + texture(tex, uv + off - vec2(b.x, 0.0)).rgb
                + texture(tex, uv + off + vec2(0.0, b.y)).rgb + texture(tex, uv + off - vec2(0.0, b.y)).rgb;
        fr *= 0.25;
        fr = mix(c, fr, 0.3 + 0.6 * deep);
        float l = dot(fr, vec3(0.2126, 0.7152, 0.0722));
        // fine frost grain makes the ice milky and crystalline
        float grain = pf_n(p * 260.0) * 0.6 + pf_n(p * 90.0 + 4.0) * 0.4;
        vec3 ice = mix(vec3(0.50, 0.76, 0.93), vec3(0.90, 0.97, 1.0), 0.35 * tone + 0.65 * grain);
        fr = mix(fr, ice * (0.50 + 0.7 * l) + vec3(0.03, 0.07, 0.12), (0.16 + 0.42 * deep) * (0.6 + 0.4 * grain));
        // rim light along the front, thin cracks inside
        float rim = smoothstep(front * 0.22, 0.0, abs(f - front * 0.5));
        fr += vec3(0.32, 0.85, 0.85) * rim * 0.22 + vec3(0.80, 0.93, 1.0) * crack * (0.05 + 0.20 * deep) + vec3(0.50, 0.40, 0.95) * crack * 0.05;
        // glittering points on a few facet centres
        float spark = step(0.88, tone) * smoothstep(0.14, 0.0, f1) * (0.6 + 0.4 * rnd.x);
        fr += vec3(0.85, 0.97, 1.0) * spark * 0.55 * deep;
        c = mix(c, fr, mask);
    }
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
