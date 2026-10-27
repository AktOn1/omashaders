#version 300 es
// category: Mood
// desc: Hollow dusk: a quiet lamplit night. Bright spots bloom a soft candle amber, shadows sink to cold ink-teal instead of black, mid tones cool a little toward slate, and the corners close in with a faint teal-black vignette (static, no animation)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float hd_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 hd_bloom(vec2 uv, float r1, float r2, float th) {
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
    float l = hd_luma(c);

    // lamp bloom: only the bright parts glow, in candle amber
    vec3 g = hd_bloom(uv, 6.0, 18.0, 0.45);
    c += vec3(hd_luma(g)) * vec3(1.00, 0.70, 0.36) * 0.9 + g * 0.12;

    // mid tones cool toward slate, highlights keep their own colour
    float mid = smoothstep(0.12, 0.45, l) * (1.0 - smoothstep(0.60, 0.95, l));
    c = mix(c, c * vec3(0.90, 0.96, 1.04), 0.55 * mid);

    // shadows sink to ink-teal instead of black; dark text stays clear
    float shadow = 1.0 - smoothstep(0.0, 0.40, l);
    c = mix(c, c * vec3(0.90, 0.98, 1.02) + vec3(0.006, 0.026, 0.034), shadow * 0.9);

    // the corners close in, cold and dark
    float vig = smoothstep(0.42, 1.18, length((uv - 0.5) * vec2(1.12, 1.0)));
    c = mix(c, c * 0.80 + vec3(0.0, 0.012, 0.022), vig * 0.8);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
