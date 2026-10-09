#version 300 es
// category: Retro
// desc: Plain pixelation. The slider sets the block size, starting at 2 px so text stays readable
// strength: 20
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 s = texture(tex, v_texcoord);
    float blk = floor(1.0 + 15.0 * pow(STRENGTH, 1.7) + 0.5);
    if (blk < 1.5) { fragColor = s; return; }
    vec2 res = vec2(textureSize(tex, 0)) / blk;
    vec2 q = (floor(v_texcoord * res) + 0.5) / res;
    vec2 o = 0.25 / res;
    vec3 t = 0.25 * (texture(tex, q + o).rgb + texture(tex, q - o).rgb + texture(tex, q + vec2(o.x, -o.y)).rgb + texture(tex, q - vec2(o.x, -o.y)).rgb);
    fragColor = vec4(t, s.a);
}
