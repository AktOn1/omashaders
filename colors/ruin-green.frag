#version 300 es
// category: Color
// desc: Ruin green: shadows sink to mossy forest green, mid tones go fern and olive, lights turn warm sun-on-stone cream; luminance held so text stays readable
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
    vec3 k0 = vec3(0.03, 0.08, 0.06);
    vec3 k1 = vec3(0.24, 0.40, 0.22);
    vec3 k2 = vec3(0.80, 0.76, 0.52);
    vec3 k3 = vec3(1.00, 0.95, 0.80);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.42, l));
    grad = mix(grad, k2, smoothstep(0.40, 0.80, l));
    grad = mix(grad, k3, smoothstep(0.78, 1.00, l));
    vec3 keep = mix(vec3(l), c, 0.40);
    vec3 g = mix(keep, grad, 0.72);
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.70);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
