#version 300 es
// category: Color
// desc: Sumi and vermilion: a warm monochrome ink-and-washi grade where only red and orange survive, as vermilion; the brightness curve is kept so text stays readable
// strength: 85
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    // ink to washi ramp
    vec3 ink = vec3(0.045, 0.047, 0.055);
    vec3 mid = vec3(0.47, 0.455, 0.43);
    vec3 paper = vec3(0.95, 0.915, 0.82);
    vec3 mono = l < 0.5 ? mix(ink, mid, smoothstep(0.0, 0.5, l)) : mix(mid, paper, smoothstep(0.5, 1.0, l));
    // red / orange survive as vermilion (blue-ish reds such as pink and magenta do not)
    float red = smoothstep(0.16, 0.45, c.r - c.g) * smoothstep(0.12, -0.05, c.b - c.g);
    vec3 shu = vec3(0.88, 0.25, 0.14) * (0.45 + 0.85 * l);
    c = mix(mono, shu, red * 0.9);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
