#version 300 es
// category: Color
// desc: Fleet blue: deep navy shadows, steel-blue mid tones, pale steel highlights and a hint of cyan; a cool bridge-lit grade with luminance held for easy reading
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
    vec3 k0 = vec3(0.010, 0.025, 0.080);
    vec3 k1 = vec3(0.070, 0.150, 0.300);
    vec3 k2 = vec3(0.480, 0.600, 0.740);
    vec3 k3 = vec3(0.900, 0.960, 1.000);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.30, l));
    grad = mix(grad, k2, smoothstep(0.28, 0.72, l));
    grad = mix(grad, k3, smoothstep(0.70, 1.00, l));
    // a hint of cyan in the upper mid tones, like instrument light
    grad += vec3(-0.02, 0.07, 0.09) * smoothstep(0.30, 0.55, l) * smoothstep(0.95, 0.65, l);
    // keep a faint trace of the original hue so warnings and accents stay recognisable
    vec3 keep = mix(vec3(l), c, 0.35) * vec3(0.92, 0.98, 1.08);
    vec3 g = mix(keep, grad, 0.78);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.65);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
