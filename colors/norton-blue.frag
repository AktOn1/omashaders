#version 300 es
// category: Retro
// desc: Norton blue: shadows become the deep DOS-shell blue, mid tones cyan, highlights bright white; the old file-manager look on everything, text keeps its brightness so it stays readable
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
    vec3 k0 = vec3(0.015, 0.020, 0.340);       // text-mode blue
    vec3 k1 = vec3(0.040, 0.420, 0.640);       // teal-cyan
    vec3 k2 = vec3(0.700, 0.940, 0.960);       // pale cyan
    vec3 k3 = vec3(1.000, 1.000, 0.860);       // warm white (the yellowed highlight)
    vec3 g = mix(k0, k1, smoothstep(0.02, 0.40, l));
    g = mix(g, k2, smoothstep(0.35, 0.75, l));
    g = mix(g, k3, smoothstep(0.80, 1.00, l));
    // keep some of the original hue (EGA colours are saturated and should survive)
    g = mix(g, mix(vec3(luma(g)), c, 0.65), 0.28);
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l * 0.7 + 0.30 * gl) / gl, 0.0, 1.0), 0.40);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
