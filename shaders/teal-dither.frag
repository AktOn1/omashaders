#version 300 es
// category: Retro
// desc: Teal dither: a mid-nineties desktop look. Colours are gently reduced to a 256-colour-style palette with a fine ordered dither, saturation eases back a little, shadows lean teal and highlights cool toward silver. Text stays sharp (static, no animation)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float td_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// 4x4 ordered-dither threshold from the pixel position, no tables
float td_idx2(ivec2 p) {
    int a = p.x & 1;
    int b = p.y & 1;
    return float((a ^ b) * 2 + b);
}
float td_bayer(vec2 fc) {
    ivec2 p = ivec2(fc);
    return (td_idx2(p) * 4.0 + td_idx2(p >> 1) + 0.5) / 16.0;
}

void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = td_luma(c);

    // a little less saturated, like a reduced palette
    c = mix(vec3(l), c, 0.86);

    // shadows lean teal, highlights cool toward silver; dark text stays readable
    float sh = 1.0 - smoothstep(0.0, 0.45, l);
    c = mix(c, c * vec3(0.88, 1.00, 1.00) + vec3(0.000, 0.022, 0.026), sh * 0.8);
    float hi = smoothstep(0.65, 1.0, l);
    c = mix(c, c * vec3(0.96, 0.98, 1.00) + vec3(-0.01, 0.0, 0.0), hi * 0.5);

    // 6 levels per channel (the classic 216-colour cube) with an ordered dither; the
    // dither is a light touch so the steps look like fine screen grain, not a filter
    float th = td_bayer(gl_FragCoord.xy) - 0.5;
    vec3 q = floor(c * 5.0 + 0.5 + th * 0.9) / 5.0;
    c = mix(c, q, 0.75);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
