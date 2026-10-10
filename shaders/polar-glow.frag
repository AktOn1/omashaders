#version 300 es
// category: Mood
// desc: Polar glow: a still blue-green night wash with a very soft glow around highlights, a faint teal lift in the shadows near the top and a gentle vignette; calm and text-safe (static)
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float pg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = pg_luma(c);
    float top = 1.0 - uv.y;

    // night wash: shadows and mids slide toward deep blue-green, bright pixels (text) keep most of their colour
    vec3 night = c * vec3(0.74, 0.93, 0.97) + vec3(0.000, 0.014, 0.024);
    float keep = smoothstep(0.55, 0.95, l);
    c = mix(night, c * vec3(0.94, 1.0, 1.0), keep * 0.7);

    // soft glow around highlights: two rings of taps, only the bright part spills over
    vec2 r1 = vec2(0.0045, 0.0045 * 1.78);
    vec2 r2 = r1 * 2.6;
    vec3 g = vec3(0.0);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398 + 0.3;
        vec2 d = vec2(cos(a), sin(a));
        g += texture(tex, uv + d * r1).rgb * 0.7 + texture(tex, uv + d * r2).rgb * 0.5;
    }
    g /= 9.6;
    // band-pass: the glow lives in the transition zone around bright shapes, never inside a bright window (small text stays crisp)
    float gl = pg_luma(g);
    float band = smoothstep(0.16, 0.40, gl) * (1.0 - smoothstep(0.50, 0.72, gl));
    c += g * vec3(0.30, 0.66, 0.60) * band * 0.30;

    // faint teal lift in the shadows near the top, like green light on the dark sky
    float dark = 1.0 - smoothstep(0.05, 0.38, l);
    float lift = smoothstep(0.35, 1.0, top);
    float sway = 0.8 + 0.2 * sin(uv.x * 4.2 + 1.0);                   // a lazy, fixed unevenness (no animation)
    c += vec3(0.010, 0.060, 0.050) * lift * sway * (0.2 + 0.8 * dark);

    // gentle vignette toward deep blue-green
    float vig = smoothstep(0.38, 1.05, length((uv - 0.5) * vec2(1.1, 1.0)));
    c = mix(c, c * vec3(0.62, 0.80, 0.86) + vec3(0.0, 0.004, 0.010), vig * 0.55);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
