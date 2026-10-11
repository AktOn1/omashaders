#version 300 es
// category: Color
// desc: Bleached tan: sun-washed colours, saturation drawn out toward dry sand and chalk, shadows lifted into warm khaki and highlights left clean; the look of a poster that has hung in a shop window for years
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    // wash out most of the colour toward a tan monochrome
    vec3 tan_ = vec3(l) * vec3(1.06, 0.98, 0.84) + vec3(0.02, 0.012, 0.0);
    vec3 g = mix(c, tan_, 0.62);
    // sun-bleach: shadows climb a little, a soft S-curve keeps the middle clear
    g = mix(g, vec3(0.20, 0.17, 0.12) + g * 0.86, 0.45 * (1.0 - smoothstep(0.0, 0.45, l)));
    g = mix(g, g * g * (3.0 - 2.0 * g), 0.25);
    // hold luminance close to the original so text and borders do not wash out
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.55);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
