#version 300 es
// category: Mood
// desc: Nave glow: bright areas bloom softly like light through incense haze, shadows lean violet-blue and a faint pale shaft falls from the top edge; a soft vignette keeps the middle clear and text readable (static)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float ng_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = ng_luma(c);

    // violet-blue shadows, a touch of warm gold in the lights; the middle of the range is left alone so text keeps its colour
    float sh = 1.0 - smoothstep(0.0, 0.45, l);
    float hi = smoothstep(0.60, 0.98, l);
    c = mix(c, c * vec3(0.90, 0.88, 1.12) + vec3(0.012, 0.004, 0.034), sh * 0.85);
    c = mix(c, c * vec3(1.05, 1.02, 0.95), hi * 0.5);

    // soft bloom, as if the highlights glowed in haze: wide, faint, only in the transition zone around bright shapes
    vec2 r1 = vec2(0.0050, 0.0050 * 1.78);
    vec2 r2 = r1 * 2.9;
    vec3 g = vec3(0.0);
    for (int i = 0; i < 12; i++) {
        float a = float(i) * 0.523599 + 0.4;
        vec2 d = vec2(cos(a), sin(a));
        vec2 d2 = vec2(cos(a + 0.26), sin(a + 0.26));
        g += texture(tex, uv + d * r1).rgb * 0.7 + texture(tex, uv + d2 * r2).rgb * 0.55;
    }
    g /= 15.0;
    float gl = ng_luma(g);
    float band = smoothstep(0.15, 0.40, gl) * (1.0 - smoothstep(0.52, 0.76, gl));
    c += g * vec3(1.00, 0.88, 0.82) * band * 0.26;

    // a faint pale shaft of light slanting down from the top edge (a window high in the nave), kept out of bright areas
    float sx = (uv.x - 0.30) - uv.y * 0.22;
    float shaft = exp(-sx * sx / 0.018) * (1.0 - smoothstep(0.0, 0.85, uv.y));
    c += vec3(0.060, 0.050, 0.075) * shaft * (1.0 - hi);

    // vignette toward violet-black
    float vig = smoothstep(0.38, 1.05, length((uv - 0.5) * vec2(1.1, 1.0)));
    c = mix(c, c * vec3(0.66, 0.62, 0.82) + vec3(0.004, 0.0, 0.012), vig * 0.55);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
