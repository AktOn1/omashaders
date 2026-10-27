#version 300 es
// category: Art
// desc: Wet paper: the screen sits on a damp sheet of cold-press watercolour paper, its tooth clumping where the sheet is wettest, a cool granulation in the blotches, a soft bloom around the brightest places and damp blue corners (static, text stays sharp)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float wpg_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wpg_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wpg_h(i), wpg_h(i + vec2(1.0, 0.0)), f.x), mix(wpg_h(i + vec2(0.0, 1.0)), wpg_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wpg_fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * wpg_n(p); p = p * 2.07 + 19.0; a *= 0.5; }
    return v;
}
float wpg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec2 size = vec2(textureSize(tex, 0));
    vec2 px = uv * size;
    float S = STRENGTH;
    float K = S * 1.818;                                   // 1.0 at the default strength
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = wpg_luma(c);

    // 1. where the sheet is still wet: slow damp patches that the water has not left yet
    float damp = wpg_fbm(px / 110.0);
    // light tones carry the paper, black text and white paper take very little
    float room = smoothstep(0.07, 0.52, l) * (1.0 - 0.75 * smoothstep(0.78, 1.0, l));

    // 2. cold-press tooth, clumping in the damp parts instead of lying evenly
    float tooth = wpg_n(px / 2.6) * 0.5 + wpg_n(px / 6.2 + 3.0) * 0.5;
    float grain = (tooth - 0.5) * (0.50 + 1.00 * damp);
    c *= 1.0 + grain * 0.15 * K * (0.30 + 0.70 * room);

    // 3. granulation: pigment settles in the damp blotches, a touch cooler and deeper
    float blot = smoothstep(0.42, 0.72, damp);
    c = mix(c, c * vec3(0.92, 0.97, 1.07) * 0.95, blot * 0.32 * K * room);

    // 4. the wet sheet blooms: the brightest places spread a soft glow into the paper
    float hi = smoothstep(0.60, 1.0, l);
    c += vec3(0.050, 0.062, 0.080) * hi * 0.95 * min(K, 1.4);

    // 5. the water ran to the edges of the sheet and dried there, cool and a little darker
    vec2 d = (uv - 0.5) * vec2(1.0, 1.08);
    float e = clamp(pow(length(d), 2.4) * 0.85, 0.0, 0.5);
    c = mix(c, c * vec3(0.79, 0.84, 0.94), e * min(K, 1.3));

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
