#version 300 es
// category: Retro
// desc: Polygon dither: the screen is squeezed to a 32-bit console's few colour levels with a mild posterize and a fine ordered dither, and the blacks lift to a cool console grey (static, no animation)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float pd_b2(vec2 q) { return 2.0 * q.x + 3.0 * q.y - 4.0 * q.x * q.y; }
// 4x4 ordered (Bayer) value 0..1 for this screen pixel, no tables
float pd_bayer(vec2 ip) {
    vec2 a = mod(ip, 2.0);
    vec2 b = floor(mod(ip, 4.0) * 0.5);
    return (pd_b2(a) * 4.0 + pd_b2(b) + 0.5) / 16.0;
}

void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float b = pd_bayer(floor(gl_FragCoord.xy));

    // blacks rise to a cool grey, highlights stay put
    c = mix(vec3(0.035, 0.040, 0.055), vec3(1.0), c);

    // mild posterize (about 14 to 16 levels a channel) with an ordered dither between the steps
    vec3 lv = vec3(14.0, 16.0, 14.0);
    c = floor(c * lv + b) / lv;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
