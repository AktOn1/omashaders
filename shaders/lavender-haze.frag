#version 300 es
// category: Mood
// desc: Lavender haze: a soft violet veil lifts the shadows a little, bright areas glow in rose-gold, gentle vignette (static, no animation)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float lh_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// wide soft glow of the bright parts only
vec3 lh_glow(vec2 uv, float r1, float r2, float th) {
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398 + 0.2;
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
    float l = lh_luma(c);

    // rose-gold halation: bright areas bleed a warm pink-gold glow (tinted, so it adds colour more than brightness)
    vec3 g = lh_glow(uv, 6.0, 15.0, 0.38);
    float gl = lh_luma(g);
    c += mix(vec3(gl), g, 0.35) * vec3(1.00, 0.74, 0.66) * 0.9;

    // violet haze lifts the shadows (deep darks float up toward a soft violet, text on dark stays clear)
    float shadow = 1.0 - smoothstep(0.0, 0.55, l);
    c += vec3(0.060, 0.040, 0.105) * shadow * shadow;
    // a touch of lavender in the mids
    c = mix(c, c * vec3(1.02, 0.97, 1.05), 0.6);

    // gentle vignette, with the corners going violet rather than black
    float vig = smoothstep(0.45, 1.15, length((uv - 0.5) * vec2(1.1, 1.0)));
    c = mix(c, c * 0.90 + vec3(0.03, 0.015, 0.06), vig * 0.8);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
