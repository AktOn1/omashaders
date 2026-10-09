#version 300 es
// category: Retro
// desc: Four green shades like a handheld
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    int i = int(floor(clamp(luma(c), 0.0, 0.999) * 4.0));
    vec3 pal[4] = vec3[4](vec3(0.059, 0.220, 0.059), vec3(0.188, 0.384, 0.188), vec3(0.545, 0.675, 0.059), vec3(0.608, 0.737, 0.059));
    c = pal[i];
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
