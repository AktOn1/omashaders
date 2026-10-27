#version 300 es
// category: Color
// desc: Dial-up pink: midnight-navy shadows, electric blue lower mids, hot pink in the upper mids and a pale lavender-white for highlights, a late-nineties chat-window grade that keeps your picture's own light and dark
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
    vec3 k0 = vec3(0.035, 0.025, 0.110);
    vec3 k1 = vec3(0.150, 0.250, 0.560);
    vec3 k2 = vec3(0.930, 0.340, 0.660);
    vec3 k3 = vec3(0.990, 0.930, 1.000);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.38, l));
    grad = mix(grad, k2, smoothstep(0.38, 0.74, l));
    grad = mix(grad, k3, smoothstep(0.72, 1.00, l));
    vec3 keep = mix(vec3(l), c, 0.45);
    vec3 g = mix(keep, grad, 0.62);
    float lumg = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / lumg), 0.0, 1.0), 0.55);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
