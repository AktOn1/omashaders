#version 300 es
// category: Mood
// desc: Dial-up glow: a late-night chat window feel. Bright spots bloom a soft hot pink, shadows sink to deep plum-navy instead of black, mid tones lean lavender, the far corners pick up a faint pink and cyan edge light, and a very fine scanline shimmer sits over everything (static, no animation)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float dg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 dg_bloom(vec2 uv, float r1, float r2, float th) {
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398 + 0.4;
        vec2 d = vec2(cos(a), sin(a)) * px;
        acc += max(texture(tex, uv + d * r1).rgb - th, 0.0);
        acc += max(texture(tex, uv + d * r2).rgb - th, 0.0);
    }
    return acc / 16.0;
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = dg_luma(c);

    // screen glow: only the bright parts bloom, in hot pink with a lavender fringe
    vec3 g = dg_bloom(uv, 5.0, 16.0, 0.42);
    c += vec3(dg_luma(g)) * vec3(1.00, 0.36, 0.66) * 0.85 + g * vec3(0.10, 0.06, 0.16);

    // mid tones lean lavender, highlights keep their own colour
    float mid = smoothstep(0.12, 0.45, l) * (1.0 - smoothstep(0.60, 0.95, l));
    c = mix(c, c * vec3(1.03, 0.94, 1.08), 0.55 * mid);

    // shadows sink to plum-navy, never to flat black; dark text stays clear
    float shadow = 1.0 - smoothstep(0.0, 0.38, l);
    c = mix(c, c * vec3(0.94, 0.92, 1.04) + vec3(0.030, 0.012, 0.058), shadow * 0.9);

    // far corners: pink edge light top left, cyan bottom right, a dark plum vignette around both
    vec2 q = uv - 0.5;
    float vig = smoothstep(0.42, 1.18, length(q * vec2(1.12, 1.0)));
    float side = clamp(0.5 + (q.x - q.y) * 0.9, 0.0, 1.0);
    vec3 edge = mix(vec3(0.95, 0.22, 0.56), vec3(0.18, 0.80, 1.00), side);
    c = mix(c, c * 0.82 + vec3(0.016, 0.004, 0.032), vig * 0.8);
    c += edge * vig * vig * 0.050 * (1.0 - 0.6 * l);

    // fine scanline shimmer: every other row a touch darker, a slow band of stronger lines across the picture
    float row = floor(uv.y * float(textureSize(tex, 0).y));
    float odd = mod(row, 2.0);
    float amp = 0.014 + 0.016 * (0.5 + 0.5 * sin(uv.y * 9.0 + 1.3));
    c *= 1.0 - amp * odd;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
