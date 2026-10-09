#version 300 es
// category: Motion
// desc: Slow warm brightness pulse, about 8 seconds
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float k = 0.5 + 0.5 * sin(time * 0.8);
    c *= mix(vec3(1.0), vec3(0.94, 0.92, 0.88), k);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
