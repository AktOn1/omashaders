#version 300 es
// category: Mood
// desc: Smog bloom: neon highlights bleed a magenta and cyan glow into the dark around them, a hint of colour fringing out at the screen edges and a deep violet vignette, like looking through rainy city air; the centre stays sharp (static)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float sb_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// bloom gathered on a golden-angle disc: only saturated or bright pixels contribute
vec3 sb_bloom(vec2 uv, vec2 px, float radius) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 12; i++) {
        float fi = float(i) + 0.5;
        float a = fi * 2.39996;
        float r = sqrt(fi / 12.0) * radius;
        vec3 t = texture(tex, uv + vec2(cos(a), sin(a)) * r * px).rgb;
        float mx = max(t.r, max(t.g, t.b)), mn = min(t.r, min(t.g, t.b));
        float w = smoothstep(0.45, 0.95, sb_luma(t)) * 0.7 + smoothstep(0.35, 0.8, mx - mn) * 0.3;
        acc += t * w;
    }
    return acc / 12.0;
}

void main() {
    vec2 uv = v_texcoord;
    vec2 size = vec2(textureSize(tex, 0));
    vec2 px = 1.0 / size;
    float S = STRENGTH;
    float K = S * 1.8182;                                  // 1.0 at the default strength
    vec2 d = uv - 0.5;
    float e = dot(d, d) * 4.0;                             // 0 centre .. 2 corner

    // colour fringing that grows toward the edges only
    vec2 off = d * (0.0016 * K * e);
    vec4 s = texture(tex, uv);
    vec3 c = vec3(texture(tex, uv + off).r, s.g, texture(tex, uv - off).b);

    // neon bloom: warm-magenta near, cool-cyan far
    vec3 b1 = sb_bloom(uv, px, 9.0);
    vec3 b2 = sb_bloom(uv + 0.3 * px, px, 28.0);
    float room = 1.0 - smoothstep(0.30, 0.70, sb_luma(c));  // less over light areas so dark text on a light window stays crisp
    c += (b1 * vec3(1.0, 0.45, 0.85) * 0.45 + b2 * vec3(0.55, 0.75, 1.0) * 0.55) * 0.55 * K * room;

    // deep violet vignette, lifted a little in the middle of the screen
    float v = smoothstep(0.35, 1.5, e);
    c = mix(c, c * vec3(0.55, 0.40, 0.75) + vec3(0.012, 0.0, 0.03), v * 0.60 * min(K, 1.4));

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
