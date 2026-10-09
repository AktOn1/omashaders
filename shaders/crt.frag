#version 300 es
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec2 uv = v_texcoord;
    vec2 d = uv - 0.5;
    uv = 0.5 + d * (1.0 + 0.04 * dot(d, d));
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    float s = 0.0006;
    vec3 c = vec3(texture(tex, uv + vec2(s, 0.0)).r, texture(tex, uv).g, texture(tex, uv - vec2(s, 0.0)).b);
    c *= 0.92 + 0.08 * sin(uv.y * 1080.0 * 3.14159);
    c *= 1.0 - 0.35 * dot(d, d) * 2.0;
    fragColor = vec4(c, 1.0);
}
