#version 300 es
// category: Color
// desc: Starship bridge: cold navy-cyan shadows and midtones, hot orange highlights, magenta pulled toward blue
// strength: 80
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    // pink and magenta (red and blue high, green low) slide toward cyan-blue
    float mag = clamp(min(c.r, c.b) - c.g, 0.0, 1.0);
    c = mix(c, vec3(c.r * 0.55, c.g + mag * 0.45, c.b), clamp(mag * 2.2, 0.0, 0.8));
    float l = luma(c);
    vec3 shadow = vec3(0.02, 0.07, 0.15);
    vec3 mid = vec3(0.30, 0.78, 0.95);
    vec3 high = vec3(1.0, 0.62, 0.24);
    vec3 grad = mix(shadow, mid, smoothstep(0.0, 0.55, l));
    grad = mix(grad, high, smoothstep(0.55, 0.95, l));
    c = mix(c, grad * (0.55 + 0.9 * l), 0.5);
    c = mix(vec3(luma(c)), c, 1.2);
    c = (c - 0.5) * 1.08 + 0.5;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
