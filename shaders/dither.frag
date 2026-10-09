#version 300 es
// category: Retro
// desc: Ordered dither with few colour levels
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
const float bayer[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    ivec2 p = ivec2(mod(gl_FragCoord.xy, 4.0));
    float b = (bayer[p.y * 4 + p.x] + 0.5) / 16.0;
    c = floor(c * 5.0 + b) / 5.0;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
