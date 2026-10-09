#version 300 es
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;
float h(float x) { return fract(sin(x * 91.345) * 43758.5453); }
void main() {
    vec2 uv = v_texcoord;
    float band = smoothstep(0.0, 1.0, sin(uv.y * 6.0 + time * 1.3));
    float wob = 0.0008 * sin(uv.y * 400.0 + time * 8.0) + 0.0025 * band * step(0.96, h(floor(time * 6.0)));
    uv.x += wob;
    float s = 0.0018;
    vec3 c = vec3(texture(tex, uv + vec2(s, 0.0)).r, texture(tex, uv).g, texture(tex, uv - vec2(s, 0.0)).b);
    c *= 0.94 + 0.06 * sin(uv.y * 1080.0 * 3.14159 + time * 20.0);
    float roll = smoothstep(0.0, 0.05, abs(fract(uv.y - time * 0.08) - 0.5) - 0.45);
    c += 0.03 * (1.0 - roll);
    fragColor = vec4(c, 1.0);
}
