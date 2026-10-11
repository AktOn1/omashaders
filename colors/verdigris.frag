#version 300 es
// category: Color
// desc: Verdigris: dark bronze-brown shadows, green patina mid tones, aged-brass lights and warm lamplit highlights; an old clockwork-brass grade that holds contrast so text stays crisp
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
    vec3 k0 = vec3(0.030, 0.026, 0.016);
    vec3 k1 = vec3(0.140, 0.260, 0.200);
    vec3 k2 = vec3(0.620, 0.640, 0.380);
    vec3 k3 = vec3(1.000, 0.910, 0.680);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.35, l));
    grad = mix(grad, k2, smoothstep(0.30, 0.72, l));
    grad = mix(grad, k3, smoothstep(0.68, 1.00, l));
    // keep a faint trace of the original hue
    vec3 keep = mix(vec3(l), c, 0.34) * vec3(0.97, 1.02, 0.96);
    vec3 g = mix(keep, grad, 0.72);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.65);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
