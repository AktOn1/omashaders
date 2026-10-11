#version 300 es
// category: Mood
// desc: Crimson vignette: a soft deep-red vignette closes in from the corners while the centre stays neutral, with a gentle warm bloom around the bright parts (static, text stays sharp)
// strength: 50
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float cv_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// gentle bloom: only the bright parts of the picture are gathered on a golden-angle disc
vec3 cv_glow(vec2 uv, vec2 px, float radius) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 10; i++) {
        float fi = float(i) + 0.5;
        float a = fi * 2.39996;
        float r = sqrt(fi / 10.0) * radius;
        vec3 t = texture(tex, uv + vec2(cos(a), sin(a)) * r * px).rgb;
        acc += t * smoothstep(0.60, 0.98, cv_luma(t));
    }
    return acc / 10.0;
}

void main() {
    vec2 uv = v_texcoord;
    vec2 size = vec2(textureSize(tex, 0));
    vec2 px = 1.0 / size;
    float S = STRENGTH;
    float K = S * 2.0;                                      // 1.0 at the default strength
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;

    // 1. warm bloom around the highlights (ember-white), strongest beside bright areas, not on top of them
    vec3 g = cv_glow(uv, px, 14.0) * 0.55 + cv_glow(uv + 0.3 * px, px, 34.0) * 0.55;
    c += g * vec3(1.0, 0.80, 0.66) * 0.30 * K * (1.0 - smoothstep(0.25, 0.70, cv_luma(c)));

    // 2. the vignette: nothing happens in the middle, the edges are pulled toward deep red
    vec2 d = (uv - 0.5) * vec2(1.0, 1.05);
    float e = pow(length(d) * 1.35, 2.6);
    float v = clamp(e, 0.0, 1.0) * min(K, 1.5);
    float l = cv_luma(c);
    vec3 wine = vec3(0.50, 0.035, 0.07);
    c = mix(c, c * vec3(1.0, 0.50, 0.52) + wine * 0.10, v * 0.68);   // red-tinted, clearly red but not black at the very corner
    c = mix(c, c * vec3(0.80, 0.55, 0.58), v * 0.25);
    // a wine-dark lift in the deepest shadows near the rim keeps the edge from going pure black
    c += wine * 0.07 * v * (1.0 - smoothstep(0.0, 0.30, l));

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
