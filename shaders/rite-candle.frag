#version 300 es
// category: Mood
// desc: Rite candle: the screen lit by one candle, the corners fall into deep warm black with a faint oxblood tinge, a very slight amber lift sits low in the centre, fine film grain, and only the very brightest points bleed a small warm halation; the centre stays sharp for text (static)
// strength: 60
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float rc_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float rc_h(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}

void main() {
    vec2 uv = v_texcoord;
    vec2 sz = vec2(textureSize(tex, 0));
    vec2 px = 1.0 / sz;
    float k = STRENGTH / 0.60;                   // 1.0 at the shipped default
    vec3 c = texture(tex, uv).rgb;
    float lum = rc_luma(c);

    // distance from the candle: the flame sits a little below the middle
    vec2 q = (uv - vec2(0.5, 0.56)) * vec2(1.0, 0.80);
    float rr = length(q);
    float edge = smoothstep(0.20, 0.78, length((uv - 0.5) * vec2(1.0, 0.80)));

    // halation: 16 taps on two rings, only the brightest points bleed, a warm red-amber, none onto already bright pixels
    // and weaker in the middle of the screen so text there stays crisp
    vec3 acc = vec3(0.0);
    float ring = 0.0;
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398 + 0.3927;
        vec2 d = vec2(cos(a), sin(a)) * px;
        vec3 ta = texture(tex, uv + d * 8.0).rgb;
        vec3 tb = texture(tex, uv + d * 21.0).rgb;
        acc += max(ta - 0.74, 0.0) * 1.2 + max(tb - 0.74, 0.0) * 0.8;
        ring += rc_luma(ta) + rc_luma(tb);
    }
    float hg = dot(acc, vec3(0.333)) * 0.125;
    // a bright page around dark text is not a point of light: the glow needs a dark surround
    float ownfree = (1.0 - smoothstep(0.45, 0.85, lum)) * clamp(1.0 - ring * 0.0625 * 1.6, 0.0, 1.0);
    float hmask = (0.30 + 0.70 * edge) * ownfree;
    vec3 halo = vec3(1.0, 0.36, 0.12) * hg * 3.2 + vec3(0.30, 0.10, 0.04) * hg;
    c += halo * hmask * k;

    // amber lift: a faint warm pool low in the middle, added in screen fashion so whites cannot clip
    float pool = exp(-rr * rr * 7.0);
    vec3 lift = vec3(1.0, 0.55, 0.18) * 0.085 * pool * k;
    c = 1.0 - (1.0 - c) * (1.0 - lift);
    c *= 1.0 + 0.035 * pool * k * vec3(1.0, 0.86, 0.60);

    // candle vignette: the corners sink into black lacquer with a faint oxblood tinge in what is left
    float vg = smoothstep(0.20, 0.78, rr);
    vg *= vg * (1.5 - 0.5 * vg);
    float v = clamp(vg * 1.0 * k, 0.0, 0.92);
    vec3 dark = c * vec3(0.46, 0.25, 0.26) + vec3(0.020, 0.003, 0.005);
    c = mix(c, dark, v);

    // fine film grain, static, a little more in the shadows and toward the edges
    vec2 pc = floor(uv * sz);
    float g = rc_h(pc) - 0.5;
    float g2 = rc_h(pc + 71.7) - 0.5;
    float ga = (0.014 + 0.016 * edge) * (1.0 - 0.65 * smoothstep(0.1, 0.9, lum)) * k;
    c += vec3(g * 1.0, (g + g2) * 0.45, g2 * 0.8) * ga;

    fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
