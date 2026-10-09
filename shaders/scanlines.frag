#version 300 es
// category: Retro
// desc: Light dark lines on every second row
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float row = mod(floor(gl_FragCoord.y), 2.0);
    c *= mix(1.0, 0.86, row);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
