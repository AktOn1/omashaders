#version 300 es
// category: Devices
// desc: Game Boy Pocket: cool grey, no green
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    int i = int(floor(clamp(l, 0.0, 0.999) * 4.0));
    vec3 pal[4] = vec3[4](vec3(0.075, 0.075, 0.075), vec3(0.35, 0.36, 0.34), vec3(0.64, 0.66, 0.62), vec3(0.78, 0.80, 0.76));
    c = pal[i];
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
