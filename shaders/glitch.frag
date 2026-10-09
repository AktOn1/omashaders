#version 300 es
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
    vec2 uv = v_texcoord;
    float t = floor(time * 8.0);
    float row = floor(uv.y * 40.0);
    float on = step(0.93, h(vec2(row, t)));
    float burst = step(0.85, h(vec2(t, 7.0)));
    float dx = (h(vec2(row, t + 3.0)) - 0.5) * 0.06 * on * burst;
    float s = 0.004 * on * burst;
    vec3 c = vec3(texture(tex, uv + vec2(dx + s, 0.0)).r, texture(tex, uv + vec2(dx, 0.0)).g, texture(tex, uv + vec2(dx - s, 0.0)).b);
    fragColor = vec4(c, 1.0);
}
