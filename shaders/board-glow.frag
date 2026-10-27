#version 300 es
// category: Ambient
// desc: Board glow: the screen looks like a lit circuit board seen through its casing: a green-black vignette closes in from the corners, a very faint solder-mask grid and a few tiny pad dots show only in the margins, and the brightest points give off a soft warm LED bloom that stays weak in the middle so text keeps its edge (static, no animation)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float bg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float bg_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
    vec2 uv = v_texcoord;
    vec2 sz = vec2(textureSize(tex, 0));
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = bg_luma(c);
    float sc = clamp(sz.y / 1080.0, 0.75, 2.0);
    vec2 px = uv * sz;
    vec2 q = (uv - 0.5) * vec2(sz.x / sz.y, 1.0);

    // how far out towards the margins we are: 0 in the middle, 1 at the rim
    vec2 e = abs(uv - 0.5) * 2.0;
    float box = max(e.x, e.y);
    float margin = smoothstep(0.50, 1.0, box);
    float vig = smoothstep(0.42, 1.15, length(q * 0.95));

    // shadows lean towards board green, the picture keeps its colour
    vec3 tint = mix(vec3(0.012, 0.045, 0.028), vec3(0.88, 0.98, 0.90), smoothstep(0.0, 0.7, l));
    c = mix(c, c * tint / max(bg_luma(tint), 0.05) * 0.94, 0.38);
    c += vec3(0.0, 0.010, 0.004) * (1.0 - smoothstep(0.0, 0.25, l));

    // soft warm bloom from the brightest points, weak in the centre where the text is
    vec2 st1 = vec2(9.0 * sc) / sz;
    vec2 st2 = vec2(21.0 * sc) / sz;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7853982 + 0.3;
        vec2 d = vec2(cos(a), sin(a));
        vec3 a1 = texture(tex, uv + d * st1).rgb;
        vec3 a2 = texture(tex, uv + d * st2).rgb;
        acc += a1 * smoothstep(0.62, 0.95, bg_luma(a1)) * 1.0 + a2 * smoothstep(0.62, 0.95, bg_luma(a2)) * 0.7;
    }
    acc *= 0.125;
    float bloomK = 0.07 + 0.30 * margin + 0.10 * vig;
    c += mix(acc, vec3(bg_luma(acc)), 0.4) * vec3(1.0, 0.74, 0.40) * bloomK * (1.0 - smoothstep(0.30, 0.62, l));

    // solder-mask texture in the margins: a hairline grid, and a few tiny gold pad dots on the grid crossings
    float cell = 8.0 * sc;
    vec2 g = px / cell;
    vec2 fg = abs(fract(g) - 0.5);
    float grid = 1.0 - smoothstep(0.0, 1.1 * sc, min(0.5 - fg.x, 0.5 - fg.y) * cell);
    vec2 gc = floor(px / (cell * 6.0));
    vec2 pdv = px - (gc + 0.5) * cell * 6.0;
    float pad = 0.0;
    if (bg_h(gc + 3.1) < 0.22) pad = exp(-dot(pdv, pdv) / (1.3 * sc * 1.3 * sc));
    float tex_ = (grid * 0.050 + pad * 0.10) * (0.25 + 0.75 * (1.0 - smoothstep(0.30, 0.75, l)));
    c += vec3(0.30, 0.95, 0.55) * tex_ * margin * margin;
    c += vec3(0.85, 0.60, 0.25) * pad * 0.10 * margin * margin;

    // the corners close in, green-black
    c = mix(c, c * 0.62 + vec3(0.000, 0.012, 0.006), vig * 0.85);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
