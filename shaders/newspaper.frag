#version 300 es
// category: Devices
// desc: Newsprint: grey on yellowed paper with faint halftone
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    vec2 g = gl_FragCoord.xy * 0.5;
    float h = 0.5 + 0.5 * sin(g.x + g.y) * sin(g.x - g.y);
    l = mix(l, step(h * 0.8 + 0.1, l), 0.22);
    c = mix(vec3(0.13, 0.12, 0.11), vec3(0.93, 0.89, 0.78), l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
