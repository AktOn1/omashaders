#version 300 es
// category: Color
// desc: Silvery, gritty film look: low saturation, high contrast
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    float g = luma(c);
    vec3 over = g < 0.5 ? 2.0 * c * vec3(g) : 1.0 - 2.0 * (1.0 - c) * (1.0 - g);
    c = mix(c, over, 0.6);
    c = mix(vec3(luma(c)), c, 0.55);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
