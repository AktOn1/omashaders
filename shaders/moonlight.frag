#version 300 es
// category: Mood
// desc: Moonlight: a cool silver-blue wash as if the screen were lit by the moon, soft bloom around highlights and a gentle vignette that keeps the middle clear and text readable (static)
// strength: 50
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float ml_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = ml_luma(c);

    // silver-blue wash: the picture loses a little warmth and saturation and takes on moonlight
    vec3 grey = vec3(l);
    c = mix(c, grey, 0.22);
    c = c * vec3(0.88, 0.95, 1.04) + vec3(0.004, 0.008, 0.020);
    // bright pixels (text, windows) lean toward silver-white instead of blue, so they stay crisp
    float hi = smoothstep(0.55, 0.95, l);
    c = mix(c, c * vec3(1.06, 1.04, 1.02), hi * 0.6);

    // soft bloom, as if the moon lit the highlights: a wide, faint halo that only spills from bright pixels
    vec2 r1 = vec2(0.0045, 0.0045 * 1.78);
    vec2 r2 = r1 * 2.7;
    vec3 g = vec3(0.0);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398 + 0.3;
        vec2 d = vec2(cos(a), sin(a));
        g += texture(tex, uv + d * r1).rgb * 0.7 + texture(tex, uv + d * r2).rgb * 0.5;
    }
    g /= 9.6;
    // band-pass: the halo lives in the transition zone around bright shapes, never inside a bright window (small text stays crisp)
    float gl = ml_luma(g);
    float band = smoothstep(0.16, 0.40, gl) * (1.0 - smoothstep(0.50, 0.72, gl));
    c += g * vec3(0.55, 0.70, 0.95) * band * 0.30;

    // a faint cool light from above, strongest near the top centre where the moon would hang
    vec2 mp = vec2((uv.x - 0.5) * 1.78, uv.y + 0.12);
    float moon = exp(-dot(mp, mp) * 1.3);
    c += vec3(0.020, 0.032, 0.060) * moon * (1.0 - hi);

    // gentle vignette toward cold dark blue
    float vig = smoothstep(0.38, 1.05, length((uv - 0.5) * vec2(1.1, 1.0)));
    c = mix(c, c * vec3(0.66, 0.76, 0.92) + vec3(0.0, 0.003, 0.012), vig * 0.55);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
