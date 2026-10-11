#version 300 es
// category: Color
// desc: Wet amber: blue-grey shadows and cool mid tones with warm amber lights, like street lamps on a rainy pavement; text keeps its original brightness
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
    vec3 k0 = vec3(0.020, 0.035, 0.075);
    vec3 k1 = vec3(0.20, 0.27, 0.38);
    vec3 k2 = vec3(0.96, 0.66, 0.28);
    vec3 k3 = vec3(1.0, 0.90, 0.72);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.38, l));
    grad = mix(grad, k2, smoothstep(0.34, 0.74, l));
    grad = mix(grad, k3, smoothstep(0.70, 1.00, l));
    // keep a trace of the original hue so syntax colours and images stay readable
    vec3 keep = mix(vec3(l), c, 0.32) * vec3(0.99, 1.0, 1.02);
    vec3 g = mix(keep, grad, 0.72);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.72);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
