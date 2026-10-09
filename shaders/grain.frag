#version 300 es
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
    vec4 c = texture(tex, v_texcoord);
    float n = h(v_texcoord * 900.0 + fract(time) * 37.0) - 0.5;
    fragColor = vec4(c.rgb + n * 0.06, c.a);
}
