#version 300 es
// category: Mood
// desc: Soft sky: very gentle peach and powder-blue split toning, a soft bloom on highlights that does not add brightness, a light airy vignette (static, no animation)
// strength: 50
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float ss_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// soft blur of the whole picture (two rings), used for a bloom that spreads light around instead of adding it
vec3 ss_blur(vec2 uv, float r1, float r2) {
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398 + 0.4;
        vec2 d = vec2(cos(a), sin(a)) * px;
        acc += texture(tex, uv + d * r1).rgb + texture(tex, uv + d * r2).rgb;
    }
    return acc / 16.0;
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = ss_luma(c);

    // bloom: highlights bleed softly into their surroundings, and the same amount is taken back out of the centre,
    // so the picture gets a gentle glow but not a brighter overall level
    vec3 b = ss_blur(uv, 5.0, 12.0);
    float bl = ss_luma(b);
    float hi = smoothstep(0.45, 0.95, l);
    c = mix(c, mix(c, b, 0.55), smoothstep(0.30, 0.85, bl));
    c += (b - c) * 0.40 * smoothstep(0.5, 1.0, bl) * (1.0 - hi);

    // split toning: powder blue in the shadows, soft peach in the highlights
    float sh = 1.0 - smoothstep(0.05, 0.55, l);
    float hl = smoothstep(0.45, 1.0, l);
    c = mix(c, c * vec3(0.95, 0.98, 1.05) + vec3(0.00, 0.012, 0.03), sh * 1.0);
    c = mix(c, c * vec3(1.04, 0.995, 0.93) + vec3(0.012, 0.004, 0.0), hl * 0.9);

    // light vignette: the corners soften toward a hazy powder blue, never dark
    float vig = smoothstep(0.50, 1.20, length((uv - 0.5) * vec2(1.1, 1.0)));
    c = mix(c, c * 0.94 + vec3(0.012, 0.022, 0.04), vig * 0.8);

    // keep the very brightest areas from going glaring white
    c = min(c, vec3(0.985, 0.975, 0.965) + 0.0 * c);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
