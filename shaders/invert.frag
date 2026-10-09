#version 300 es
// category: Color
// desc: Inverted colours
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 c = texture(tex, v_texcoord);
    fragColor = vec4(1.0 - c.rgb, c.a);
}
