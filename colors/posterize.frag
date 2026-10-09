#version 300 es
// category: Color
// desc: Few flat colour levels
// strength: 80
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 c = texture(tex, v_texcoord);
    fragColor = vec4(floor(c.rgb * 6.0 + 0.5) / 6.0, c.a);
}
