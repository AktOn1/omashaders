#version 300 es
// category: Mood
// desc: Golden porch: late-afternoon sun haze, a soft honey wash that is strongest in the upper left, gentle bloom on the highlights and a light warm vignette (static, text stays sharp)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float gp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// soft bloom: only the bright parts of the picture are gathered on a golden-angle disc and spread a little
vec3 gp_bloom(vec2 uv, vec2 px, float radius) {
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 12; i++) {
        float fi = float(i) + 0.5;
        float a = fi * 2.39996;
        float r = sqrt(fi / 12.0) * radius;
        vec3 t = texture(tex, uv + vec2(cos(a), sin(a)) * r * px).rgb;
        float w = smoothstep(0.55, 0.98, gp_luma(t));
        acc += t * w;
        wsum += 1.0;
    }
    return acc / wsum;
}

void main() {
    vec2 uv = v_texcoord;
    vec2 size = vec2(textureSize(tex, 0));
    vec2 px = 1.0 / size;
    float asp = size.x / size.y;
    float S = STRENGTH;
    float K = S * 1.8182;                                   // 1.0 at the default strength
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;

    // 1. warm honey light: a gentle tint over everything, a touch more where the sun comes from
    vec2 d = (uv - vec2(0.02, 0.0)) * vec2(asp, 1.0);
    float sun = exp(-dot(d, d) * 0.55);                     // wide: strongest upper left, still some at the far corner
    c = mix(c, c * vec3(1.07, 0.98, 0.80) + vec3(0.010, 0.004, 0.0), 0.55 * K);

    // 2. soft bloom on the highlights, two radii, warm
    vec3 b = gp_bloom(uv, px, 10.0) * 0.6 + gp_bloom(uv + 0.3 * px, px, 30.0) * 0.8;
    c += b * vec3(1.0, 0.86, 0.58) * 0.30 * K * (1.0 - smoothstep(0.25, 0.65, gp_luma(c)));   // less on bright areas: small dark text on a light window stays crisp

    // 3. sun haze: a soft glowing veil lifts the shadows near the sun, never more than a few percent
    c = mix(c, c * 0.94 + vec3(1.0, 0.80, 0.50) * 0.09, sun * 0.34 * K);
    c += vec3(1.0, 0.82, 0.52) * 0.05 * sun * K;

    // 4. light warm vignette in the corners (brown, not black)
    float e = pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
    c = mix(c, c * vec3(0.80, 0.66, 0.52), clamp(e * 0.50, 0.0, 0.40) * min(K, 1.4));

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
