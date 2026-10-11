#version 300 es
// category: Color
// desc: Brass age: verdigris-black shadows, dark bronze mid tones and polished brass lights with a warm cream highlight, like instruments in an old workshop
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
    vec3 k0 = vec3(0.02, 0.05, 0.045);    // verdigris black
    vec3 k1 = vec3(0.24, 0.17, 0.07);     // dark bronze
    vec3 k2 = vec3(0.80, 0.60, 0.26);     // polished brass
    vec3 k3 = vec3(1.00, 0.93, 0.72);     // warm cream
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.35, l));
    grad = mix(grad, k2, smoothstep(0.30, 0.72, l));
    grad = mix(grad, k3, smoothstep(0.68, 1.00, l));
    // keep a faint trace of the original hue
    vec3 keep = mix(vec3(l), c, 0.30) * vec3(1.03, 0.98, 0.90);
    vec3 g = mix(keep, grad, 0.74);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.68);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
