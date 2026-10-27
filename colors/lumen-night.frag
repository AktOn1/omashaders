#version 300 es
// category: Color
// desc: Lumen night: greens are pulled toward teal and magentas toward violet while reds and skin tones stay put, shadows lift into a deep teal-indigo, mids lean cyan, highlights keep a little amber, and only cyan and amber get more colour; whites stay white and text stays crisp
// strength: 70
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float ln_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 ln_rgb2hsv(vec3 c) {
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float d = mx - mn;
    float h = 0.0;
    if (d > 1e-5) {
        if (mx == c.r)      h = mod((c.g - c.b) / d, 6.0);
        else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
        else                h = (c.r - c.g) / d + 4.0;
        h /= 6.0;
    }
    return vec3(h, mx > 1e-5 ? d / mx : 0.0, mx);
}

vec3 ln_hsv2rgb(vec3 c) {
    vec3 k = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z * mix(vec3(1.0), k, c.y);
}

void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l0 = ln_luma(c);

    // hue-selective part: only coloured pixels move, grey and near-grey are left alone
    vec3 hsv = ln_rgb2hsv(c);
    float h = hsv.x;
    float colourful = smoothstep(0.06, 0.30, hsv.y) * smoothstep(0.04, 0.20, hsv.z);

    // greens (about 70 to 160 deg) slide toward teal (about 176 deg); yellow-greens and reds are not touched
    float gw = smoothstep(0.17, 0.26, h) * (1.0 - smoothstep(0.40, 0.48, h));
    float dh = (0.49 - h) * 0.68 * gw;
    // magentas and pinks (about 285 to 345 deg) slide toward violet (about 266 deg)
    float mw = smoothstep(0.76, 0.83, h) * (1.0 - smoothstep(0.93, 0.98, h));
    dh += (0.74 - h) * 0.60 * mw;
    hsv.x = fract(h + dh * colourful);

    // more colour for cyan (about 150 to 210 deg) and amber (about 20 to 50 deg) only
    float cw = smoothstep(0.40, 0.48, hsv.x) * (1.0 - smoothstep(0.56, 0.62, hsv.x));
    float aw = smoothstep(0.075, 0.10, hsv.x) * (1.0 - smoothstep(0.125, 0.15, hsv.x));
    hsv.y = min(hsv.y * (1.0 + 0.24 * cw + 0.20 * aw), 1.0);

    vec3 g = ln_hsv2rgb(hsv);
    // the turned hues change the brightness a little: bring most of it back so contrast and text keep their weight
    float l1 = max(ln_luma(g), 0.001);
    g = mix(g, clamp(g * (l0 / l1), 0.0, 1.0), 0.7 * colourful);

    float l = ln_luma(g);
    // shadows: lifted off black into a deep teal-indigo
    vec3 lift = vec3(0.020, 0.038, 0.070);
    g = lift + g * (1.0 - lift);
    float shad = 1.0 - smoothstep(0.0, 0.42, l);
    g += vec3(-0.010, 0.006, 0.030) * shad;
    // mids lean cyan
    float mid = smoothstep(0.12, 0.45, l) * (1.0 - smoothstep(0.55, 0.88, l));
    g += vec3(-0.030, 0.010, 0.024) * mid;
    // highlights keep a little amber, but the very brightest stay white
    float high = smoothstep(0.55, 0.85, l) * (1.0 - smoothstep(0.92, 1.0, l));
    g += vec3(0.034, 0.014, -0.030) * high;

    // gentle contrast, nothing crushed
    g = clamp(g, 0.0, 1.0);
    g = mix(g, g * g * (3.0 - 2.0 * g), 0.12);

    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
