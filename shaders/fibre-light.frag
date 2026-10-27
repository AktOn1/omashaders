#version 300 es
// category: Ambient
// desc: Fibre light: your screen as a sheet of washi: long thin paper fibres crossing in the margins and faintly over the middle, soft warm light falling from the top, and a faint damp indigo stain with a darker tide line creeping in at the corners. The centre stays sharp (static, no animation)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float fl_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float fl_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float fl_noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fl_h(i), fl_h(i + vec2(1.0, 0.0)), f.x), mix(fl_h(i + vec2(0.0, 1.0)), fl_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fl_fbm(vec2 p) {
    float a = 0.5; float s = 0.0;
    for (int k = 0; k < 4; k++) { s += a * fl_noise(p); p = p * 2.03 + vec2(7.1, 3.7); a *= 0.5; }
    return s / 0.9375;
}
// one layer of long thin fibres at an angle; the line bends a little so it is not ruler straight
float fl_fibre(vec2 p, float ang, float len, float seed) {
    float ca = cos(ang); float sa = sin(ang);
    vec2 r = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y);
    r.y += 6.0 * (fl_noise(vec2(r.x / 140.0 + seed, seed)) - 0.5);
    float n = fl_noise(vec2(r.x / len + seed, r.y / 1.6 + seed * 3.1));
    return smoothstep(0.64, 0.90, n);
}

void main() {
    vec2 uv = v_texcoord;
    vec2 sz = vec2(textureSize(tex, 0));
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = fl_luma(c);
    float k = 1.0;
    float sc = clamp(sz.y / 1080.0, 0.75, 2.0);
    vec2 q = uv * sz / sc;
    vec2 cc = (uv - 0.5) * vec2(sz.x / sz.y, 1.0);
    float rc = length(cc);

    // how far from the middle: the margins carry the paper, the centre keeps its pixels clean
    float edge = smoothstep(0.22, 0.75, rc);
    float fmask = 0.30 + 0.70 * edge;

    // crossing fibres
    float f1 = fl_fibre(q, 0.30, 80.0, 1.0) + 0.8 * fl_fibre(q, 1.90, 100.0, 5.0) + 0.7 * fl_fibre(q, -0.80, 70.0, 9.0) + 0.6 * fl_fibre(q, 1.15, 120.0, 17.0);
    float f2 = fl_noise(q * 0.7) - 0.5;
    // fibres lighten dark ground and darken light ground
    float fibreAmt = 0.050 * k * fmask;
    c += (f1 - 0.35) * fibreAmt * mix(vec3(0.90, 0.95, 1.00), vec3(-0.9, -0.85, -0.7), smoothstep(0.25, 0.7, l)) * (0.5 + 0.5 * smoothstep(0.0, 0.2, l + 0.1));
    c *= 1.0 + 0.020 * k * fmask * f2;

    // soft warm light from the top
    float top = pow(1.0 - uv.y, 2.2);
    c = mix(c, c * vec3(1.06, 1.03, 0.95) + vec3(0.020, 0.014, 0.004), 0.55 * min(k, 1.3) * top * (0.5 + 0.5 * edge));

    // damp stains in the corners: a ragged blotch with a darker tide line at its edge
    vec2 cr = abs(uv - 0.5) * 2.0;
    float corner = length(cr);
    float rag = fl_fbm(q * 0.006 + vec2(3.0, 8.0)) - 0.5;
    float field = corner + rag * 0.55 + (fl_noise(q * 0.05) - 0.5) * 0.04;
    float stain = smoothstep(1.10, 1.38, field);
    float rim = exp(-pow((field - 1.10) / 0.04, 2.0)) * 0.9 + exp(-pow((field - 1.32) / 0.03, 2.0)) * 0.35;
    vec3 indigo = vec3(0.060, 0.110, 0.300);
    c = mix(c, c * vec3(0.56, 0.64, 0.86) + indigo * 0.55, clamp(stain * 0.65 * min(k, 1.3), 0.0, 0.9));
    c = mix(c, c * 0.62 + indigo * 0.25, clamp(rim * 0.45 * min(k, 1.3) * smoothstep(0.95, 1.15, corner), 0.0, 0.6));

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
