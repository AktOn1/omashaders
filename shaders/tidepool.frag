#version 300 es
// category: Mood
// desc: Tide pool: a soft aqua-turquoise wash over everything, pale sandy highlights glow gently like sunlit sand under clear shallow water, a light vignette (static)
// strength: 50
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float S = STRENGTH;
    float K = S * 2.0;                                                 // 1.0 at the default strength
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    float l0 = dot(c, vec3(0.2126, 0.7152, 0.0722));

    // gentle bloom: highlights spread a soft pale-sand glow (two rings of taps, no time, no per-frame state)
    vec3 acc = vec3(0.0);
    float ring = 0.0;
    for (int i = 0; i < 12; i++) {
        float a = float(i) * 0.5236 + 0.26;
        vec2 d = vec2(cos(a), sin(a)) * px;
        vec3 ta = texture(tex, uv + d * 7.0).rgb;
        vec3 tb = texture(tex, uv + d * 18.0).rgb;
        acc += max(ta - 0.6, 0.0) + max(tb - 0.6, 0.0);
        ring += dot(ta + tb, vec3(0.1667));
    }
    float inside = clamp(1.0 - l0 * 1.1, 0.0, 1.0);                      // glow spills outside bright shapes, never washes their insides out
    float g = dot(acc, vec3(0.3333)) / 24.0 * inside;
    vec3 sand = vec3(1.0, 0.93, 0.74);

    // aqua wash: clear turquoise toward the top (light from the surface), a hint of sandy warmth toward the bottom
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 wash = mix(vec3(0.62, 0.95, 0.96), vec3(0.78, 0.95, 0.88), smoothstep(0.2, 1.0, uv.y));
    vec3 tinted = mix(c, vec3(l) * wash * 1.08 + c * 0.25, 0.42);
    c = mix(c, tinted, 0.70 * min(K, 1.5));
    c += vec3(0.0, 0.020, 0.024) * (1.0 - uv.y * 0.6) * K * (1.0 - 0.6 * l);   // faint turquoise lift in the shadows, never on bright text

    c += sand * g * 1.6 * K;
    c += sand * max(l - 0.7, 0.0) * 0.04 * K;

    float vig = smoothstep(0.45, 1.1, length((uv - 0.5) * vec2(1.1, 1.0)));
    c *= 1.0 - 0.10 * vig * K;
    c = mix(c, c * vec3(0.90, 1.0, 0.98), vig * 0.35 * K);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
