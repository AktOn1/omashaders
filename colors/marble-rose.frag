#version 300 es
// category: Color
// desc: Marble rose: shadows cool to Aegean blue, mid tones to soft rose, lights to cream marble; luminance held so text stays crisp
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
    vec3 k0 = vec3(0.05, 0.09, 0.17);
    vec3 k1 = vec3(0.45, 0.36, 0.45);
    vec3 k2 = vec3(0.93, 0.74, 0.74);
    vec3 k3 = vec3(1.00, 0.96, 0.90);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.40, l));
    grad = mix(grad, k2, smoothstep(0.35, 0.78, l));
    grad = mix(grad, k3, smoothstep(0.75, 1.00, l));
    vec3 keep = mix(vec3(l), c, 0.45);
    vec3 g = mix(keep, grad, 0.70);
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.70);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
