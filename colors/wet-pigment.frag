#version 300 es
// category: Color
// desc: Wet pigment: a watercolour grade; colours gain the depth wet paint has over dry, shadows sink into a cool blue-violet wash that never reaches black and highlights dry out to warm paper white, with the original luminance kept so text stays crisp
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float wp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = wp_luma(c);
    vec3 wet = clamp(mix(vec3(l), c, 1.38), 0.0, 1.0);                       // wet paint is deeper than dry paint
    vec3 tint = mix(vec3(0.58, 0.66, 0.96), vec3(1.05, 0.99, 0.91), smoothstep(0.10, 0.78, l));
    vec3 g = wet * tint;
    g += vec3(0.034, 0.030, 0.052) * (1.0 - smoothstep(0.0, 0.34, l));       // a wash never dries to black
    g = mix(g, g * vec3(0.99, 1.00, 1.01) + vec3(0.012, 0.012, 0.008), smoothstep(0.72, 1.0, l) * 0.6);
    float gl = max(wp_luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.58);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
