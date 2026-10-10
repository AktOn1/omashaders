#version 300 es
// category: Mood
// desc: Pine mist: cool dawn haze that lifts the blacks and thickens toward the bottom, a soft desaturated green-blue wash and a gentle glow on the highlights (static, text stays sharp)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float pm_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// gentle glow: only the bright parts of the picture are gathered on a golden-angle disc
vec3 pm_glow(vec2 uv, vec2 px, float radius) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 10; i++) {
        float fi = float(i) + 0.5;
        float a = fi * 2.39996;
        float r = sqrt(fi / 10.0) * radius;
        vec3 t = texture(tex, uv + vec2(cos(a), sin(a)) * r * px).rgb;
        acc += t * smoothstep(0.55, 0.98, pm_luma(t));
    }
    return acc / 10.0;
}

void main() {
    vec2 uv = v_texcoord;
    vec2 size = vec2(textureSize(tex, 0));
    vec2 px = 1.0 / size;
    float S = STRENGTH;
    float K = S * 1.8182;                                   // 1.0 at the default strength
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = pm_luma(c);

    // 1. quiet colour: a little desaturated and pulled toward soft green-blue, nothing harsh
    c = mix(c, vec3(l) * vec3(0.90, 1.02, 1.04), 0.26 * K);
    c = mix(c, c * vec3(0.95, 1.02, 1.04), 0.6 * K);

    // 2. gentle glow on the highlights (cool white), strongest next to bright areas and not on top of them
    vec3 g = pm_glow(uv, px, 16.0) * 0.55 + pm_glow(uv + 0.3 * px, px, 38.0) * 0.55;
    c += g * vec3(0.86, 1.0, 0.96) * 0.30 * K * (1.0 - smoothstep(0.25, 0.65, pm_luma(c)));

    // 3. morning mist: lifted blacks everywhere, thicker toward the bottom (cool, pale grey-green)
    float low = smoothstep(0.30, 1.0, uv.y);
    float lift = (0.030 + 0.075 * low * low) * K;
    vec3 mist = vec3(0.62, 0.74, 0.76);
    c = c * (1.0 - lift) + mist * lift;
    // the mist also flattens contrast a hair at the very bottom
    c = mix(c, vec3(pm_luma(c)) * vec3(0.92, 1.02, 1.04) + vec3(0.01), 0.10 * low * low * K);

    // 4. soft cool vignette, bluer than black
    float e = pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
    c = mix(c, c * vec3(0.78, 0.88, 0.90), clamp(e * 0.50, 0.0, 0.38) * min(K, 1.4));

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
