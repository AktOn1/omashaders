#version 300 es
// category: Devices
// desc: CGA palette: black, cyan, magenta, white
// strength: 70
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    vec3 pal[4] = vec3[4](vec3(0.0), vec3(0.333, 1.0, 1.0), vec3(1.0, 0.333, 1.0), vec3(1.0));
    int i = int(floor(clamp(l, 0.0, 0.999) * 4.0));
    float ang = c.b - c.r;
    if (i == 1 || i == 2) i = ang > 0.0 ? 1 : 2;
    if (sat < 0.1 && i > 0 && i < 3) i = l > 0.5 ? 3 : 0;
    c = pal[i];
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
