#version 300 es
// category: Motion
// desc: Dark corners that slowly breathe in and out
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float edge = 0.78 + 0.10 * sin(time * 0.6);
    float v = smoothstep(edge, 0.25, length((v_texcoord - 0.5) * vec2(1.0, 0.9)));
    c *= mix(0.55, 1.0, v);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
