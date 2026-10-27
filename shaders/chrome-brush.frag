#version 300 es
// category: Lens
// desc: Brushed chrome: bright spots smear sideways along a fine brushed-metal grain into a cool silver streak, and a whisper of steel dust lies over the whole screen (static)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float cb_h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float cb_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec4 s = texture(tex, v_texcoord);
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec2 sz = vec2(textureSize(tex, 0));

    // the brush runs almost horizontally, tipped a few degrees, the way a polished panel is finished
    vec2 dir = normalize(vec2(0.985, 0.174));
    vec2 across = vec2(-dir.y, dir.x);

    // local mean: only what stands out above its own neighbourhood is allowed to smear
    vec3 mean = 0.25 * (texture(tex, v_texcoord + across * 34.0 * px).rgb + texture(tex, v_texcoord - across * 34.0 * px).rgb
                      + texture(tex, v_texcoord + dir * 46.0 * px).rgb + texture(tex, v_texcoord - dir * 46.0 * px).rgb);

    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    for (int i = -12; i <= 12; i++) {
        float fi = float(i);
        float w = exp(-fi * fi / 52.0);
        vec3 t = texture(tex, v_texcoord + dir * (fi * 6.0) * px).rgb;
        acc += max(t - mean - 0.26, 0.0) * w;
        wsum += w;
    }
    vec3 streak = acc / wsum;

    // the grain of the brushing: fine lines across the sweep that break the streak into metal fibres
    float lane = dot(v_texcoord * sz, across);
    float fibre = 0.68 + 0.32 * cb_h(vec2(floor(lane * 0.9), 3.0));
    float fibre2 = 0.80 + 0.20 * sin(lane * 1.9 + cb_h(vec2(floor(lane * 0.18), 7.0)) * 6.28);
    streak *= fibre * fibre2;

    vec3 c = s.rgb + streak * vec3(0.78, 0.88, 1.12) * 4.2 * STRENGTH;

    // steel dust: a still, very fine grain, strongest in the mid tones so text edges keep their contrast
    float l = cb_lum(s.rgb);
    float mid = 1.0 - abs(l - 0.45) * 1.7;
    float g = (cb_h(v_texcoord * sz * 0.97 + 11.3) - 0.5) + 0.5 * (cb_h(v_texcoord * sz * 0.41 + 5.0) - 0.5);
    c += vec3(0.95, 0.98, 1.05) * g * 0.030 * clamp(mid, 0.0, 1.0) * STRENGTH;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
