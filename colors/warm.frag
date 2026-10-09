#version 300 es
// category: Comfort
// desc: Soft amber tint, less blue light
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 c = texture(tex, v_texcoord);
    fragColor = vec4(c.rgb * vec3(1.0, 0.86, 0.66), c.a);
}
