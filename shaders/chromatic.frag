#version 300 es
// category: Lens
// desc: Lens colour fringing that grows toward the screen edges; the centre stays sharp
// strength: 40
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec2 d = v_texcoord - 0.5;
    vec2 off = d * dot(d, d) * STRENGTH * 0.07;
    vec4 s = texture(tex, v_texcoord);
    vec3 c = vec3(texture(tex, v_texcoord + off).r, s.g, texture(tex, v_texcoord - off).b);
    fragColor = vec4(c, s.a);
}
