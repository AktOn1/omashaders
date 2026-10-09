#version 300 es
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;
void main() {
    vec2 uv = v_texcoord;
    float k = uv.y;
    uv.x += 0.0012 * sin(uv.y * 38.0 + time * 2.3) * (0.4 + 0.6 * k);
    uv.y += 0.0008 * sin(uv.x * 52.0 + time * 1.7) * (0.4 + 0.6 * k);
    vec4 c = texture(tex, uv);
    fragColor = vec4(c.rgb * vec3(1.03, 1.0, 0.96), c.a);
}
