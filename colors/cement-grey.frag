#version 300 es
// category: Color
// desc: Cement grey: colour drains to neutral concrete grey, shadows a hair cool and lights a hair warm; calm, flat and fully readable
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
    // mostly grey, a little of the original colour left
    vec3 g = mix(vec3(l), c, 0.22);
    // split tone: cool shadows, warm lights
    vec3 cool = vec3(0.96, 0.985, 1.03);
    vec3 warm = vec3(1.035, 1.005, 0.95);
    g *= mix(cool, warm, smoothstep(0.25, 0.85, l));
    // a soft lift of the blacks, the way concrete never goes fully black
    g = mix(g, g * 0.94 + 0.03, 0.8);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
