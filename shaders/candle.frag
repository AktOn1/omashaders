#version 300 es
// category: Comfort
// desc: Strong amber, very little blue light
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    c *= vec3(1.0, 0.74, 0.46);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
