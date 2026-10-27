#version 300 es
// category: Retro
// desc: Dead signal: analog-horror VHS screen with fine grain, faint scanlines, a tiny colour split and a noisy vignette toward the edges, and every eleven seconds a horizontal tracking tear rolls up through the picture for under half a second; the centre stays clean and nothing flashes (animated)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;

float ds_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float ds_h(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}
float ds_vn(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(ds_h(i), ds_h(i + vec2(1.0, 0.0)), f.x), mix(ds_h(i + vec2(0.0, 1.0)), ds_h(i + vec2(1.0)), f.x), f.y);
}

void main() {
    vec2 uv = v_texcoord;
    vec2 sz = vec2(textureSize(tex, 0));
    vec2 px = 1.0 / sz;
    float S = STRENGTH;
    float k = S / 0.55;                       // 1.0 at the shipped default
    vec2 pc = floor(uv * sz);
    vec2 q = (uv - 0.5) * vec2(1.0, 0.75);
    float rr = length(q);
    float edge = smoothstep(0.26, 0.74, rr);

    // tracking tear: t = 6.0 .. 6.4 s of every 11 s cycle, a band rolls upward through the picture
    float tp = (mod(time, 11.0) - 6.0) * 2.5;
    float on = step(0.0, tp) * step(tp, 1.0);
    float env = sin(3.14159265 * clamp(tp, 0.0, 1.0));
    float yc = 1.1 - 1.3 * clamp(tp, 0.0, 1.0);
    float dy = uv.y - yc;
    float band = (1.0 - smoothstep(0.022, 0.050, abs(dy))) * on;
    // lines shift sideways inside the band, harder toward its middle and with a tail of small wobble just under it
    float tick = floor(time * 30.0);
    float rowH = ds_h(vec2(floor(uv.y * sz.y * 0.5), tick)) - 0.5;
    float tail = (1.0 - smoothstep(0.0, 0.22, uv.y - yc)) * step(0.0, uv.y - yc) * on;
    float shift = (band * (0.016 + 0.035 * rowH) + tail * 0.004 * rowH) * env * k;
    // a hair of head-switching noise along the very bottom rows (about one pixel)
    float bot = 1.0 - smoothstep(0.0, 0.03, 1.0 - uv.y);
    shift += bot * (ds_h(vec2(floor(uv.y * sz.y * 0.5), floor(time * 8.0))) - 0.5) * 2.2 * px.x * k;
    vec2 u2 = vec2(uv.x + shift, uv.y);

    // tiny colour split, only toward the edges (up to about 2 px), a little more inside the tear
    float cs = (1.7 * edge * edge + 5.0 * band * env) * px.x * k;
    float sgn = q.x < 0.0 ? -1.0 : 1.0;
    vec2 o = vec2(cs * (edge > 0.001 ? sgn : 1.0), 0.0);
    vec3 c = texture(tex, u2).rgb;
    if (cs > 1e-5) {
        c.r = texture(tex, clamp(u2 + o, 0.0, 1.0)).r;
        c.b = texture(tex, clamp(u2 - o, 0.0, 1.0)).b;
    }
    vec3 res = c;

    // scanlines: every third row a touch darker, never over bright text (they would crawl)
    float row = mod(pc.y, 3.0);
    float sl = (row < 1.0 ? 1.0 : 0.0);
    res *= 1.0 - sl * 0.07 * S / 0.55 * (1.0 - 0.5 * smoothstep(0.7, 1.0, ds_luma(c)));

    // grain, 12 frames a second, stronger in the shadows and toward the edges
    float gt = floor(time * 12.0);
    float g = ds_h(pc + vec2(gt * 17.3, gt * 5.1)) - 0.5;
    float g2 = ds_h(pc * 1.7 + vec2(gt * 3.7, gt * 11.3)) - 0.5;
    float lum = ds_luma(res);
    float ga = (0.030 + 0.030 * edge) * (1.0 - 0.55 * smoothstep(0.1, 0.9, lum)) * k;
    res += vec3(g + 0.25 * g2, g, g - 0.25 * g2) * ga;

    // inside the tear: static streaks and a little desaturation, no brightening of the whole band
    if (band > 0.0) {
        float streak = ds_h(vec2(floor(uv.y * sz.y * 0.5), tick + 7.0));
        float sp = step(0.93, ds_h(vec2(floor(uv.x * sz.x * 0.25), floor(uv.y * sz.y * 0.5) + tick)));
        float w = band * env * k;
        res = mix(res, vec3(lum), 0.30 * w);
        res += (sp * 0.13 + streak * 0.03) * w * vec3(0.8, 0.95, 0.85);
    }

    // noisy vignette that breathes slowly, sinks toward a green black
    float vn = ds_vn(uv * vec2(5.0, 3.0) + vec2(time * 0.03, -time * 0.02));
    float vg = smoothstep(0.30, 0.82, rr) * (0.65 + 0.7 * vn);
    res = mix(res, res * vec3(0.55, 0.70, 0.62) - vec3(0.010, 0.004, 0.008), clamp(vg * 0.55 * k, 0.0, 0.75));

    fragColor = vec4(clamp(res, 0.0, 1.0), 1.0);
}
