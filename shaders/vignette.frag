#version 300 es
// category: Mood
// desc: Dark corners, focus on the middle
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 c = texture(tex, v_texcoord);
    vec2 d = v_texcoord - 0.5;
    float v = smoothstep(0.85, 0.25, length(d * vec2(1.0, 0.9)));
    fragColor = vec4(c.rgb * mix(0.55, 1.0, v), c.a);
}
