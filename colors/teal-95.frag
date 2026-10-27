#version 300 es
// category: Retro
// desc: Teal 95: lights and darks are pulled toward a mid-nineties desktop palette. Deep shadows become navy, the mid tones sit on desktop teal and the highlights turn to bevel silver, with your picture's own hues kept underneath
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
    vec3 k0 = vec3(0.00, 0.00, 0.22);
    vec3 k1 = vec3(0.00, 0.34, 0.38);
    vec3 k2 = vec3(0.00, 0.62, 0.60);
    vec3 k3 = vec3(0.75, 0.76, 0.78);
    vec3 k4 = vec3(1.00, 1.00, 1.00);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.30, l));
    grad = mix(grad, k2, smoothstep(0.28, 0.58, l));
    grad = mix(grad, k3, smoothstep(0.55, 0.85, l));
    grad = mix(grad, k4, smoothstep(0.88, 1.00, l));
    vec3 keep = mix(vec3(l), c, 0.50);
    vec3 g = mix(keep, grad, 0.58);
    float gl2 = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl2), 0.0, 1.0), 0.50);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
