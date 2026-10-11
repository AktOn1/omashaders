#version 300 es
// category: Mood
// desc: Manor gloom: a cool, slightly desaturated night with teal-tinted shadows, a soft vignette and a faint pale moon bloom in the upper right corner; mid tones and text stay clear (static)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float mg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = mg_luma(c);

    // desaturate a little: the world loses its warmth at night
    c = mix(c, vec3(l), 0.24);
    // teal shadows, pale cool-white highlights (highlights stay neutral so text stays crisp)
    float sh = 1.0 - smoothstep(0.0, 0.42, l);
    float hi = smoothstep(0.55, 0.95, l);
    c = mix(c, c * vec3(0.84, 1.00, 1.04) + vec3(0.000, 0.012, 0.020), sh * 0.85);
    c = mix(c, c * vec3(0.97, 1.0, 1.02), hi * 0.6);
    // keep the mid tones from sinking: a tiny lift in the dark half
    c += vec3(0.004, 0.010, 0.012) * (1.0 - hi);

    // faint moon bloom: a wide cool halo spilling from the bright pixels (never inside bright panels, so small text stays sharp)
    vec2 r1 = vec2(0.0050, 0.0050 * 1.78);
    vec2 r2 = r1 * 2.8;
    vec3 g = vec3(0.0);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398 + 0.2;
        vec2 d = vec2(cos(a), sin(a));
        g += texture(tex, uv + d * r1).rgb * 0.7 + texture(tex, uv + d * r2).rgb * 0.5;
    }
    g /= 9.6;
    float gl = mg_luma(g);
    float band = smoothstep(0.16, 0.40, gl) * (1.0 - smoothstep(0.50, 0.72, gl));
    c += g * vec3(0.62, 0.84, 0.92) * band * 0.26;

    // a pale moon far off the upper right corner
    vec2 mp = vec2((uv.x - 1.02) * 1.78, uv.y + 0.06);
    float moon = exp(-dot(mp, mp) * 2.0);
    c += vec3(0.030, 0.048, 0.060) * moon * (1.0 - hi);

    // vignette toward teal-black
    float vig = smoothstep(0.38, 1.05, length((uv - 0.5) * vec2(1.1, 1.0)));
    c = mix(c, c * vec3(0.62, 0.78, 0.82) + vec3(0.0, 0.004, 0.008), vig * 0.55);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
