#version 300 es
// category: Art
// desc: Paper tooth: a fine cold-press paper grain, strongest in the light tones and barely visible in text, a warm cream lift in the shadows and soft paper-brown corners (static, text stays sharp)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float pt_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pt_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(pt_h(i), pt_h(i + vec2(1.0, 0.0)), f.x), mix(pt_h(i + vec2(0.0, 1.0)), pt_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float pt_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec2 size = vec2(textureSize(tex, 0));
    vec2 px = uv * size;
    float S = STRENGTH;
    float K = S * 1.818;                                   // 1.0 at the default strength
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = pt_luma(c);

    // 1. cold-press tooth: two scales of grain plus a few long fibres, as a gentle light/dark ripple
    float tooth = pt_n(px / 2.2) * 0.55 + pt_n(px / 5.0 + 3.0) * 0.45;
    float fibre = pt_n(vec2(px.x / 28.0, px.y / 1.4)) * pt_n(vec2(px.x / 1.4, px.y / 28.0));
    float grain = (tooth - 0.5) + 0.7 * (fibre - 0.25);
    float room = smoothstep(0.08, 0.55, l) * (1.0 - 0.7 * smoothstep(0.75, 1.0, l));    // light mid tones take it, black text and white paper take little
    c *= 1.0 + grain * 0.16 * K * (0.35 + 0.65 * room);

    // 2. paper behind the darks: shadows are lifted toward a warm cream-grey (a wash never reaches black)
    vec3 paper = vec3(0.30, 0.27, 0.25);
    float lift = (1.0 - smoothstep(0.0, 0.30, l)) * 0.16 * K;
    c = mix(c, c * 0.8 + paper * 0.35, lift);

    // 3. very faint warm tone over everything
    c = mix(c, c * vec3(1.03, 1.0, 0.95), 0.6 * min(K, 1.3));

    // 4. paper-brown corners (never black)
    vec2 d = (uv - 0.5) * vec2(1.0, 1.1);
    float e = clamp(pow(length(d), 2.6) * 0.8, 0.0, 0.5);
    c = mix(c, c * vec3(0.80, 0.72, 0.62), e * min(K, 1.3));

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
