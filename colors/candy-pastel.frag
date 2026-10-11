#version 300 es
// category: Color
// desc: Candy pastel: soft pinks in the shadows, mint in the mid tones and butter yellow in the lights, a sweet-shop grade (brightness kept so text stays readable)
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
    vec3 rose = vec3(0.50, 0.20, 0.38);
    vec3 pink = vec3(0.98, 0.62, 0.78);
    vec3 mint = vec3(0.62, 0.94, 0.82);
    vec3 butter = vec3(1.00, 0.97, 0.74);
    vec3 grad = mix(rose, pink, smoothstep(0.00, 0.28, l));
    grad = mix(grad, mint, smoothstep(0.24, 0.62, l));
    grad = mix(grad, butter, smoothstep(0.60, 1.00, l));
    // hold the original brightness
    float gl = max(luma(grad), 0.001);
    grad = clamp(grad * (l / gl), 0.0, 1.0);
    vec3 keep = mix(vec3(l), c, 0.40);
    c = mix(keep, grad, 0.72);
    // pastel lift: a little milk in everything, so nothing feels harsh
    c = mix(c, vec3(1.0), 0.06 * (1.0 - l));
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
