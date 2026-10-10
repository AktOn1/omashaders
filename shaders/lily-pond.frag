#version 300 es
// category: Mood
// desc: Still jade pond: a soft jade-teal wash, shadows lifted to dark pond water, a gentle pale-green glow on the highlights and a faint vignette (static)
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float lp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 lp_glow(vec2 uv, float r1, float r2, float th) {
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398;
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
    float l = lp_luma(c);
    // lifted shadows: dark areas rise to deep pond water instead of black
    float dark = 1.0 - smoothstep(0.0, 0.32, l);
    c += vec3(0.018, 0.052, 0.046) * dark;
    // jade-teal wash, a little lighter at the top (sky on the water) and deeper toward the bottom
    vec3 wash = mix(vec3(0.90, 1.04, 0.98), vec3(0.84, 0.98, 0.96), uv.y);
    c = mix(c, c * wash, 0.8);
    c += vec3(0.0, 0.010, 0.008) * (1.0 - uv.y);
    // soft pale-green glow around the brightest areas
    vec3 g = lp_glow(uv, 6.0, 15.0, 0.55);
    c += g * vec3(0.55, 0.95, 0.80) * 0.85;
    // faint vignette
    float v = smoothstep(0.45, 1.1, length((uv - 0.5) * vec2(1.1, 1.0)));
    c *= 1.0 - 0.14 * v;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
