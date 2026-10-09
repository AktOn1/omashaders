#version 300 es
// category: Lens
// desc: Red/cyan 3D glasses split. The slider sets the separation, starting small
// strength: 12
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    float sep = STRENGTH * 12.0;
    vec4 a = texture(tex, v_texcoord + vec2(sep * px.x, 0.0));
    vec4 b = texture(tex, v_texcoord - vec2(sep * px.x, 0.0));
    fragColor = vec4(a.r, b.g, b.b, texture(tex, v_texcoord).a);
}
