#version 300 es
// category: Mood
// desc: Sunlit: a clear bright morning feel, soft warm bloom on highlights, a touch more colour, shadows gently lifted and a glow of sun from the upper left; no vignette, nothing dark in the corners (static, text stays sharp)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float sl_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 sl_bloom(vec2 uv, vec2 px, float radius) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 12; i++) {
        float fi = float(i) + 0.5;
        float a = fi * 2.39996;
        float r = sqrt(fi / 12.0) * radius;
        vec3 t = texture(tex, uv + vec2(cos(a), sin(a)) * r * px).rgb;
        acc += t * smoothstep(0.45, 0.95, sl_luma(t));
    }
    return acc / 12.0;
}

void main() {
    vec2 uv = v_texcoord;
    vec2 size = vec2(textureSize(tex, 0));
    vec2 px = 1.0 / size;
    float asp = size.x / size.y;
    float K = STRENGTH * 1.8182;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = sl_luma(c);

    // more colour and a warm cast
    c = mix(vec3(l), c, 1.0 + 0.25 * K) * mix(vec3(1.0), vec3(1.025, 1.005, 0.965), min(K, 1.2));
    // shadows lifted a little, toward a warm plum
    c += vec3(0.030, 0.022, 0.040) * (1.0 - smoothstep(0.0, 0.4, l)) * K;
    // warm bloom on the highlights, less on bright areas so dark text on light windows stays crisp
    c += sl_bloom(uv, px, 16.0) * vec3(1.0, 0.90, 0.64) * 0.30 * K * (1.0 - smoothstep(0.25, 0.65, l));
    // a glow of sun from the upper left
    vec2 d = (uv - vec2(0.0, 0.0)) * vec2(asp, 1.0);
    c += vec3(1.0, 0.84, 0.50) * exp(-dot(d, d) * 1.1) * 0.07 * K;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
