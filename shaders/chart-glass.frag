#version 300 es
// category: Ambient
// desc: Chart glass: a cool midnight tint, a soft indigo vignette and a very sparse scatter of tiny fixed stars that show only in the darkest parts of the screen, like a night sky behind the glass (static, no animation)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float cg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float cg_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
    vec2 uv = v_texcoord;
    vec2 sz = vec2(textureSize(tex, 0));
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = cg_luma(c);

    // midnight tint: shadows lean deep blue, the picture keeps its own colour
    vec3 tint = mix(vec3(0.020, 0.030, 0.110), vec3(0.78, 0.84, 1.00), smoothstep(0.0, 0.8, l));
    c = mix(c, c * tint / max(cg_luma(tint), 0.05) * 0.92, 0.35);

    // tiny fixed stars in the darkest areas only, one per 60 px cell at most
    float sc = clamp(sz.y / 1080.0, 0.75, 2.0);
    vec2 px = uv * sz;
    float cell = 60.0 * sc;
    vec2 ci = floor(px / cell);
    float dark = 1.0 - smoothstep(0.05, 0.22, l);
    float starsum = 0.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 cc = ci + vec2(float(i), float(j));
            if (cg_h(cc + 3.7) > 0.30) continue;
            vec2 sp = (cc + 0.15 + 0.7 * vec2(cg_h(cc), cg_h(cc + 9.1))) * cell;
            vec2 d = px - sp;
            float m = 0.5 + 0.5 * cg_h(cc + 5.5);
            starsum += exp(-dot(d, d) / (0.8 * sc * 0.8 * sc)) * m;
        }
    }
    c += vec3(0.80, 0.88, 1.00) * starsum * dark * 0.55;

    // the corners close in, deep indigo
    float vig = smoothstep(0.45, 1.20, length((uv - 0.5) * vec2(sz.x / sz.y, 1.0) * 0.9));
    c = mix(c, c * 0.74 + vec3(0.004, 0.006, 0.030), vig * 0.85);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
