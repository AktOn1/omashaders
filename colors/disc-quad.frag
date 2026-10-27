#version 300 es
// category: Retro
// desc: Disc quad: four-colour split toning in the spirit of a mid-nineties console logo: deep shadows lean blue, the low tones green, the mid tones yellow and the highlights a warm red, all very subtle so your picture keeps its own colour
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    float wB = 1.0 - smoothstep(0.02, 0.28, l);
    float wG = smoothstep(0.04, 0.26, l) * (1.0 - smoothstep(0.30, 0.52, l));
    float wY = smoothstep(0.28, 0.50, l) * (1.0 - smoothstep(0.56, 0.78, l));
    float wR = smoothstep(0.56, 0.86, l);
    vec3 tone = vec3(0.00, 0.10, 0.28) * wB + vec3(0.02, 0.22, 0.10) * wG + vec3(0.26, 0.20, 0.00) * wY + vec3(0.26, 0.06, 0.04) * wR;
    vec3 g = c + tone * 0.9;
    // keep the picture's own lightness
    float lg = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / lg), 0.0, 1.0), 0.6);
    // a hint of console grey in the darkest tones
    g = mix(g, g * vec3(0.96, 0.97, 1.03), wB * 0.5);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
