#version 300 es
// target: window
// category: Light
// desc: Dusk glass: a soft violet-to-rose evening sky is reflected in the pane with a faint glowing horizon line near the bottom, brighter on the focused window, tiny sparkles near the pointer, every window a slightly different sky (static)
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
uniform vec2 mouse;
uniform vec4 window_box;
layout(location = 0) out vec4 fragColor;

float dg_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dg_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(dg_h(i), dg_h(i + vec2(1.0, 0.0)), f.x), mix(dg_h(i + vec2(0.0, 1.0)), dg_h(i + vec2(1.0, 1.0)), f.x), f.y);
}

// tiny four-point sparkles in jittered cells, only near the pointer
float dg_sparkles(vec2 px, vec2 mp, float sd) {
    float cell = 38.0;
    vec2 g = px / cell;
    vec2 id = floor(g);
    float acc = 0.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 cid = id + vec2(float(i), float(j));
            float h = dg_h(cid + sd * 41.0);
            if (h > 0.30) continue;
            vec2 c = (cid + 0.2 + 0.6 * vec2(dg_h(cid + 3.3), dg_h(cid + 7.7))) * cell;
            float near = exp(-length(c - mp) / 150.0);
            vec2 d = px - c;
            float r = 1.6 + 1.6 * dg_h(cid + 1.1);
            float dot_ = exp(-dot(d, d) / (r * r));
            float cross_ = exp(-abs(d.x) * 0.9) * exp(-abs(d.y) * 0.9) * 0.0;     // reserved: no streaks, keeps it calm
            float star = exp(-abs(d.x) / (r * 4.0)) * exp(-abs(d.y) / 0.7) + exp(-abs(d.y) / (r * 4.0)) * exp(-abs(d.x) / 0.7);
            acc += (dot_ + 0.35 * star + cross_) * near * (0.4 + 0.6 * dg_h(cid + 9.9));
        }
    }
    return acc;
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                              // un-premultiply; the composer re-applies alpha
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float K = mix(0.60, 1.0, act);                                    // the focused window catches more of the sky

    // the sky in the glass: violet at the top blending to rose and gold-pink toward the bottom; the tilt and the cloud bands change per window
    float tilt = (sd - 0.5) * 0.5;
    float t = clamp(uv.y + (uv.x - 0.5) * tilt, 0.0, 1.0);
    vec2 q = px / 520.0 + sd * 17.0;
    float bands = dg_n(vec2(q.x * 0.6 + q.y * 0.15, q.y * 2.4)) * 0.6 + dg_n(vec2(q.x * 1.3, q.y * 5.0 + 4.0)) * 0.4;
    t = clamp(t + (bands - 0.5) * 0.12, 0.0, 1.0);
    vec3 top = vec3(0.34, 0.26, 0.62);
    vec3 mid = vec3(0.70, 0.46, 0.80);
    vec3 low = vec3(1.00, 0.62, 0.64);
    vec3 sky = t < 0.55 ? mix(top, mid, smoothstep(0.0, 0.55, t)) : mix(mid, low, smoothstep(0.55, 1.0, t));

    // a broad soft diagonal reflection, like window glare
    float diag = (uv.x * 0.7 + uv.y * 0.3) * surface_size.x / max(surface_size.x, 1.0);
    float glare = exp(-pow((diag - (0.25 + 0.5 * sd)) / 0.16, 2.0));

    // light adds to dark pixels mostly; bright paper-like areas get only a faint tint, so dark and light text both keep their contrast
    float room = 1.0 - 0.55 * smoothstep(0.35, 0.95, l);
    c += sky * (0.080 + 0.050 * glare) * K * room;
    c = mix(c, c * vec3(1.02, 0.97, 1.05), 0.55 * K);

    // horizon glow: a thin rose-gold line near the bottom with a wide faint halo above it
    float hy = surface_size.y * (0.90 - 0.04 * sd);
    float dyh = px.y - hy;
    float line = exp(-dyh * dyh / (2.0 * 1.6 * 1.6));
    float halo = exp(-pow(min(dyh, 0.0) / 60.0, 2.0)) * step(dyh, 0.0) + exp(-pow(max(dyh, 0.0) / 20.0, 2.0)) * step(0.0, dyh);
    float fadeX = smoothstep(0.0, 0.18, uv.x) * smoothstep(1.0, 0.82, uv.x);          // the line fades out toward the sides
    c += vec3(1.0, 0.72, 0.62) * line * fadeX * 0.16 * K * room;
    c += vec3(0.95, 0.55, 0.65) * halo * fadeX * 0.045 * K * room;

    // sparkles around the pointer
    vec2 mp = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0)) * surface_size;
    if (mp.x > -80.0 && mp.y > -80.0 && mp.x < surface_size.x + 80.0 && mp.y < surface_size.y + 80.0) {
        float sp = dg_sparkles(px, mp, sd);
        c += vec3(1.0, 0.88, 0.80) * sp * 0.30 * mix(0.7, 1.0, act);
    }

    // a fine light edge on the focused window
    float edge = min(min(px.x, surface_size.x - px.x), min(px.y, surface_size.y - px.y));
    c += vec3(0.9, 0.75, 1.0) * smoothstep(2.0, 0.0, edge) * 0.07 * act;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
