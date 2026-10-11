#version 300 es
// category: Mood
// desc: Overcast: a cool grey-blue veil lifts the shadows, highlights bloom very softly and the corners sink into a deep blue vignette; a still, rainy-afternoon mood (static, text stays sharp)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float oc_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 oc_bloom(vec2 uv, vec2 px, float radius) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 10; i++) {
        float fi = float(i) + 0.5;
        float a = fi * 2.39996;
        float r = sqrt(fi / 10.0) * radius;
        vec3 t = texture(tex, uv + vec2(cos(a), sin(a)) * r * px).rgb;
        acc += t * smoothstep(0.6, 1.0, oc_luma(t));
    }
    return acc / 10.0;
}

void main() {
    vec2 uv = v_texcoord;
    vec2 size = vec2(textureSize(tex, 0));
    vec2 px = 1.0 / size;
    float K = STRENGTH * 1.8182;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = oc_luma(c);

    // 1. cool desaturating veil: colours drift toward grey-blue, most in the shadows
    vec3 grey = vec3(l) * vec3(0.90, 0.97, 1.08);
    c = mix(c, grey, 0.38 * K);
    // 2. lifted shadows: a pale blue haze behind the dark parts
    c += vec3(0.020, 0.032, 0.062) * (1.0 - smoothstep(0.0, 0.5, l)) * K;
    // 3. very soft bloom on highlights, cold white
    c += oc_bloom(uv, px, 22.0) * vec3(0.80, 0.90, 1.0) * 0.30 * K * (1.0 - smoothstep(0.25, 0.65, l));
    // 4. a deeper blue vignette in the corners
    float e = pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
    c = mix(c, c * vec3(0.50, 0.60, 0.86), clamp(e * 0.60, 0.0, 0.5) * min(K, 1.4));
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
