#version 300 es
// category: Mood
// desc: Ash sky: colour drained toward a warm grey, a soft dusty-orange haze lifting the shadows, gentle bloom on the lights and a light vignette at the corners; a dust-storm dusk that stays legible (static)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float as_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 as_bloom(vec2 uv, vec2 px, float radius) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 10; i++) {
        float fi = float(i) + 0.5;
        float a = fi * 2.39996;
        float r = sqrt(fi / 10.0) * radius;
        vec3 t = texture(tex, uv + vec2(cos(a), sin(a)) * r * px).rgb;
        acc += t * smoothstep(0.40, 0.90, as_luma(t));
    }
    return acc / 10.0;
}

void main() {
    vec2 uv = v_texcoord;
    vec2 size = vec2(textureSize(tex, 0));
    vec2 px = 1.0 / size;
    float K = STRENGTH * 1.8182;                      // 1.0 at the default strength
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = as_luma(c);

    // drain the colour toward a warm ash grey
    vec3 grey = vec3(l) * vec3(1.04, 0.98, 0.90);
    c = mix(c, grey, min(0.38 * K, 0.6));
    // dust haze: shadows lifted toward a brown-orange, strongest in the dark parts and toward the bottom of the screen
    float haze = (1.0 - smoothstep(0.0, 0.5, l)) * (0.6 + 0.4 * uv.y);
    c += vec3(0.060, 0.040, 0.024) * haze * K;
    // soft bloom on the lights, kept off bright backgrounds so dark text stays crisp
    c += as_bloom(uv, px, 14.0) * vec3(1.0, 0.82, 0.58) * 0.24 * K * (1.0 - smoothstep(0.25, 0.65, l));
    // a low dusty glow from the horizon (the bottom edge)
    c += vec3(0.95, 0.55, 0.25) * smoothstep(0.55, 1.0, uv.y) * 0.045 * K;
    // light vignette: only the very corners
    vec2 d = (uv - 0.5) * vec2(1.0, 1.0);
    c *= 1.0 - 0.20 * K * smoothstep(0.30, 0.75, length(d));
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
