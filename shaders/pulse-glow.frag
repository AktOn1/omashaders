#version 300 es
// category: Mood
// desc: Pulse club glow: magenta and cyan light spills in from the screen edges, a faint 3 px scanline, a soft neon bloom on bright spots and lifted indigo blacks; the middle stays clear and text stays crisp (static, pairs with the audio-pulse wallpaper)
// strength: 65
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec2 sz = vec2(textureSize(tex, 0));
    vec2 uv = v_texcoord;
    vec2 px = 1.0 / sz;
    float S = STRENGTH;
    vec3 pink = vec3(1.0, 0.18, 0.62);
    vec3 cyan = vec3(0.16, 0.88, 1.0);

    // tiny lens fringe, only near the corners
    vec2 cc = (uv - 0.5) * vec2(sz.x / sz.y, 1.0);
    float rim = smoothstep(0.55, 1.0, length(cc));
    vec2 off = (uv - 0.5) * rim * 0.0030 * S;
    vec4 mid = texture(tex, uv);
    vec3 c = vec3(texture(tex, uv + off).r, mid.g, texture(tex, uv - off).b);
    float l = luma(c);

    // soft bloom: eight taps at a small radius pick up bright spots and tint them neon
    vec3 acc = vec3(0.0);
    float around = 0.0;
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7854;
        vec2 d = vec2(cos(a), sin(a)) * px * 7.0;
        vec3 t = texture(tex, uv + d).rgb;
        acc += max(t - 0.62, 0.0);
        around += luma(t);
    }
    // no bloom inside bright areas (dark text on a white page must not get lit up), only the halo at their edge
    acc *= 0.125 * clamp(1.6 - around * 0.2, 0.0, 1.0);
    float gl = luma(acc);
    c += (mix(pink, cyan, smoothstep(0.0, 0.6, uv.x * 0.7 + (1.0 - uv.y) * 0.3 + gl)) * gl * 2.2 + acc * 0.6) * S;

    // light spilling in from the edges: magenta from the bottom-left, cyan from the top-right; bright pixels (text) are left alone
    float e = min(min(uv.x, 1.0 - uv.x) * sz.x / sz.y, min(uv.y, 1.0 - uv.y));    // distance to the nearest edge, in screen heights
    float spill = exp(-e * 22.0) * 0.55 + exp(-e * 6.0) * 0.12;
    float mixc = clamp(0.5 + (uv.x - 0.5) * 0.9 + (0.5 - uv.y) * -0.9, 0.0, 1.0);   // 0 bottom-left, 1 top-right
    vec3 spillCol = mix(pink, cyan, mixc);
    c += spillCol * spill * 0.42 * S * (1.0 - 0.8 * smoothstep(0.2, 0.7, l));

    // lifted indigo blacks and a faint scanline (period 3 px)
    c += vec3(0.016, 0.006, 0.045) * S * (1.0 - l);
    float scan = 0.5 + 0.5 * sin(floor(gl_FragCoord.y) * 2.0944);
    c *= 1.0 - 0.07 * S * scan * (1.0 - 0.6 * smoothstep(0.5, 0.9, l));
    fragColor = vec4(clamp(c, 0.0, 1.0), mid.a);
}
