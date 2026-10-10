#version 300 es
// category: Color
// desc: Pulse night: deep indigo shadows, neon magenta mid tones and cyan highlights, with the original brightness kept so text stays readable
// strength: 75
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    vec3 shadow = vec3(0.025, 0.012, 0.11);   // deep indigo
    vec3 pink = vec3(0.95, 0.16, 0.66);       // neon magenta
    vec3 cyan = vec3(0.30, 0.92, 1.0);        // neon cyan
    vec3 grad = l < 0.45 ? mix(shadow, pink, smoothstep(0.08, 0.6, l) * 0.8) : mix(pink * 0.85, cyan, smoothstep(0.45, 0.95, l));
    grad = mix(grad, vec3(0.90, 0.96, 1.0), smoothstep(0.85, 1.0, l) * 0.55);   // near-white text stays white
    // keep a little of the original hue so photos do not go flat
    vec3 keep = mix(vec3(l), c, 0.35) * vec3(0.9, 0.82, 1.2);
    c = mix(keep, grad, 0.7);
    // gentle contrast so the darks are deep
    c = mix(c, c * c * 1.25, 0.3);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
