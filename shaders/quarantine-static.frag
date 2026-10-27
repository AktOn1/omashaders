#version 300 es
// category: Mood
// desc: Quarantine static: a calm sealed-deck screen with a cool steel vignette, a barely moving power hum, a hair of colour split at the edges, fine grain and very faint horizontal banding, and about every seventeen seconds one brief soft power dip (a quarter of a second, a few percent darker, no flashing); the centre and the text stay clean (animated)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;

float qs_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float qs_h(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}

void main() {
    vec2 uv = v_texcoord;
    vec2 sz = vec2(textureSize(tex, 0));
    vec2 px = 1.0 / sz;
    float S = STRENGTH;
    float k = S / 0.55;                         // 1.0 at the shipped default
    vec2 pc = floor(uv * sz);
    vec2 q = (uv - 0.5) * vec2(1.0, 0.75);
    float rr = length(q);
    float edge = smoothstep(0.28, 0.76, rr);

    // tiny colour split, only toward the edges (about 1.5 px in the far corners)
    float cs = 1.5 * edge * edge * px.x * k;
    float sgn = q.x < 0.0 ? -1.0 : 1.0;
    vec3 c = texture(tex, uv).rgb;
    if (cs > 1e-5) {
        c.r = texture(tex, vec2(clamp(uv.x + sgn * cs, 0.0, 1.0), uv.y)).r;
        c.b = texture(tex, vec2(clamp(uv.x - sgn * cs, 0.0, 1.0), uv.y)).b;
    }
    vec3 res = c;
    float lum = qs_luma(res);

    // power hum: a very slow luminance drift (at most 2.5 %), two incommensurate waves so it never loops visibly
    float hum = 0.6 * sin(time * 0.71) + 0.4 * sin(time * 0.37 + 1.7 + uv.y * 1.5);
    res *= 1.0 + 0.025 * hum * k;

    // very faint horizontal banding, drifting up slowly (a soft dark bar about every 140 px, about 1 %)
    float bandw = 0.5 + 0.5 * sin((pc.y + time * 6.0) * 0.045);
    res *= 1.0 - 0.010 * bandw * k * (1.0 - 0.6 * smoothstep(0.6, 1.0, lum));

    // fine grain at 12 steps a second, a little more in the shadows and toward the edges
    float gt = floor(time * 12.0);
    float g = qs_h(pc + vec2(gt * 17.3, gt * 5.1)) - 0.5;
    float ga = (0.016 + 0.020 * edge) * (1.0 - 0.6 * smoothstep(0.1, 0.9, lum)) * k;
    res += vec3(g * 0.9, g, g * 1.1) * ga;

    // steel-cool vignette: the corners sink toward a dark blue-teal, never to pure black
    float vg = smoothstep(0.30, 0.86, rr);
    vg *= vg;
    res = mix(res, res * vec3(0.62, 0.78, 0.92) + vec3(-0.004, 0.003, 0.010), clamp(vg * 0.50 * k, 0.0, 0.7));

    // rare power dip: every 17 s, 0.25 s long, one smooth dip (at most 8 % darker, a little cold, no flicker)
    float dp = (mod(time, 17.0) - 13.0) * 4.0;
    float env = (dp > 0.0 && dp < 1.0) ? pow(sin(3.14159265 * dp), 2.0) : 0.0;
    res *= 1.0 - 0.08 * env * k;
    res = mix(res, res * vec3(0.94, 0.99, 1.04), env * k);

    fragColor = vec4(clamp(res, 0.0, 1.0), 1.0);
}
