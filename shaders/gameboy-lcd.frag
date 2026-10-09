#version 300 es
// category: Devices
// desc: Game Boy with chunky pixels and an LCD grid
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    vec2 res = vec2(textureSize(tex, 0)) / 5.0;
    vec2 q = (floor(v_texcoord * res) + 0.5) / res;
    float l = luma(texture(tex, q).rgb);
    int i = int(floor(clamp(l, 0.0, 0.999) * 4.0));
    vec3 pal[4] = vec3[4](vec3(0.059, 0.220, 0.059), vec3(0.188, 0.384, 0.188), vec3(0.545, 0.675, 0.059), vec3(0.608, 0.737, 0.059));
    vec2 f = fract(v_texcoord * res);
    float grid = 1.0 - 0.18 * (step(f.x, 0.12) + step(f.y, 0.12));
    c = pal[i] * grid;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
