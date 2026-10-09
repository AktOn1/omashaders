#version 300 es
// category: Motion
// desc: Slowly drifting colour wash
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    vec2 p = v_texcoord;
    vec3 w = 0.5 + 0.5 * vec3(sin(time * 0.30 + p.x * 3.0), sin(time * 0.37 + p.y * 3.0 + 2.0), sin(time * 0.23 + (p.x + p.y) * 2.0 + 4.0));
    c *= 0.90 + 0.20 * w;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
