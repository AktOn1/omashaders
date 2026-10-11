#version 300 es
// category: Comfort
// desc: Haze blue: a cool, pale blue-grey grade; colours quieten into a soft fog, shadows lean slate blue, lights stay clean and bright, and contrast is kept so text stays crisp
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
    // quiet the colours, keep a trace of the original hue
    vec3 q = mix(vec3(l), c, 0.55);
    // fog tint: slate blue in the shadows, pale grey-blue in the lights
    vec3 shadowT = vec3(0.86, 0.95, 1.10);
    vec3 lightT = vec3(0.94, 0.99, 1.06);
    vec3 tint = mix(shadowT, lightT, smoothstep(0.10, 0.80, l));
    vec3 g = q * tint;
    // a small, gentle lift of the deepest blacks toward blue-grey (never touches text edges much)
    g = mix(g, vec3(0.10, 0.13, 0.17) + g * 0.9, 0.12 * (1.0 - smoothstep(0.0, 0.25, l)));
    // hold the original luminance so contrast and legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.8);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
