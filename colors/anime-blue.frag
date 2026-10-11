#version 300 es
// category: Color
// desc: Anime blue: clear saturated blues from navy shadows to cerulean mid tones with cream whites in the lights, like a painted summer sky (static, brightness kept so text stays crisp)
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
    // navy -> ultramarine -> cerulean -> cream white
    vec3 navy = vec3(0.030, 0.070, 0.250);
    vec3 ultra = vec3(0.100, 0.260, 0.760);
    vec3 cerul = vec3(0.280, 0.640, 0.960);
    vec3 cream = vec3(1.000, 0.965, 0.860);
    vec3 grad = mix(navy, ultra, smoothstep(0.00, 0.30, l));
    grad = mix(grad, cerul, smoothstep(0.25, 0.65, l));
    grad = mix(grad, cream, smoothstep(0.62, 1.00, l));
    // keep the original brightness, so contrast and text legibility are unchanged
    float gl = max(luma(grad), 0.001);
    grad = clamp(grad * (l / gl), 0.0, 1.0);
    // a little of the original hue survives (warm things stay a hint warm)
    vec3 keep = mix(vec3(l), c, 0.35);
    c = mix(keep, grad, 0.74);
    // clear, slightly more saturated blues
    float lc = luma(c);
    c = mix(vec3(lc), c, 1.10);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
