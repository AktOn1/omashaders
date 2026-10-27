#version 300 es
// target: window
// category: Glass
// desc: Dread pane: grimy, fogged glass; fine condensation, beads and dirt gather in the margins and corners (the middle and the text stay clear), a few thin drips crawl down near the side edges and a hairline crack runs out of one corner; the focused window carries a slow two-beat blood-red heartbeat in its rim, unfocused windows get only a cold, pale edge light and a faint green-grey wash (animated)
// strength: 65
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
layout(location = 0) out vec4 fragColor;

float dp_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float dp_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(dp_h(i), dp_h(i + vec2(1.0, 0.0)), f.x), mix(dp_h(i + vec2(0.0, 1.0)), dp_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float dp_fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int k = 0; k < 3; k++) { s += a * dp_n(p); p = p * 2.03 + 7.1; a *= 0.5; }
    return s;                                                         // 0 .. ~0.875
}
vec2 dp_seg(vec2 p, vec2 a, vec2 b) {
    vec2 ba = b - a;
    float h = clamp(dot(p - a, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
    return vec2(length(p - a - ba * h), h);
}

// beads of water: a cell holds at most one; returns (glint, dark underside) of the bead
vec2 dp_beads(vec2 px, float cell, float dens, float rmin, float rmax, float lyr, float sd) {
    vec2 g = px / cell;
    vec2 id = floor(g);
    vec2 f = fract(g);
    float h = dp_h(id + lyr * 23.0 + sd * 11.0);
    if (h > dens) return vec2(0.0);
    float h2 = dp_h(id + 4.7 + lyr * 5.0), h3 = dp_h(id + 8.3 + lyr * 9.0);
    vec2 m = vec2(0.30 + 0.40 * h2, 0.30 + 0.40 * h3);
    float rad = (rmin + (rmax - rmin) * h3 * h2) * cell;
    vec2 d = (f - m) * cell;
    float r = length(d);
    float body = smoothstep(rad, rad - 0.9, r);
    float glint = exp(-pow(length(d - vec2(-0.35, -0.35) * rad) / (0.30 * rad + 0.35), 2.0)) * body;   // pale spot, upper left
    float under = body * smoothstep(-0.1, 0.9, d.y / rad) * 0.9 + smoothstep(rad + 0.9, rad, r) * (1.0 - body) * 0.5;
    return vec2(glint, under);
}

// a slow drip: a thin wet line that slides down, with a bead at its head (returns line, bead)
vec2 dp_drip(vec2 px, vec2 sz, float cw, float t, float sd) {
    float ix = floor(px.x / cw);
    float h = dp_h(vec2(ix, sd * 7.0 + 1.0));
    if (h > 0.34) return vec2(0.0);
    float h2 = dp_h(vec2(ix, 3.3 + sd)), h3 = dp_h(vec2(ix, 6.1 + sd)), h4 = dp_h(vec2(ix, 9.7 + sd));
    float x0 = (ix + 0.2 + 0.6 * h2) * cw + 1.0 * sin(px.y * 0.045 + h * 40.0);
    float y0 = (0.05 + 0.40 * h3) * sz.y;
    float len = (0.18 + 0.35 * h4) * sz.y;
    float ph = fract(t * (0.010 + 0.012 * h2) + h4 * 3.0);
    float hy = y0 + len * ph;
    float dx = px.x - x0;
    float inY = smoothstep(y0, y0 + 20.0, px.y) * (1.0 - smoothstep(hy - 1.0, hy, px.y));
    float life = 1.0 - smoothstep(0.82, 1.0, ph);
    float line = exp(-dx * dx / (2.0 * 0.55 * 0.55)) * inY * (0.35 + 0.65 * smoothstep(y0, hy, px.y)) * life;
    vec2 e = vec2(dx, (px.y - hy) * 0.55);
    float bead = exp(-dot(e, e) / (2.0 * 2.0 * 2.0)) * life;
    return vec2(line, bead);
}

// a hairline crack running out of the corner at the origin of q, with one branch; returns the distance to it
float dp_crack(vec2 q, float L, float sd) {
    float d = 1e4;
    vec2 a = vec2(0.0, L * (0.8 + 1.6 * dp_h(vec2(sd, 1.0))));
    float ang = 0.30 + 0.5 * dp_h(vec2(sd, 2.0));
    vec2 bo = a; float bang = ang;
    for (int k = 0; k < 8; k++) {
        ang += (dp_h(vec2(float(k) + 3.0, sd)) - 0.5) * 1.0;
        vec2 b = a + L * (0.7 + 0.6 * dp_h(vec2(float(k) + 11.0, sd))) * vec2(cos(ang), sin(ang));
        d = min(d, dp_seg(q, a, b).x);
        a = b;
        if (k == 2) { bo = a; bang = ang; }
    }
    a = bo; ang = bang + (dp_h(vec2(sd, 5.0)) > 0.5 ? 0.75 : -0.75);
    for (int k = 0; k < 5; k++) {
        ang += (dp_h(vec2(float(k) + 21.0, sd)) - 0.5) * 1.1;
        vec2 b = a + L * 0.75 * (0.7 + 0.6 * dp_h(vec2(float(k) + 31.0, sd))) * vec2(cos(ang), sin(ang));
        d = min(d, dp_seg(q, a, b).x);
        a = b;
    }
    return d;
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    vec2 sz = surface_size;
    float sc = clamp(min(sz.x, sz.y) / 620.0, 0.7, 2.0);
    float lum = dp_luma(c);
    float t = time;

    // keep the text area clear: next to glyphs and icons almost nothing happens
    vec2 st = vec2(1.7, 1.7) / max(sz, vec2(1.0));
    float a1 = dp_luma(texture(tex, uv + st).rgb);
    float a2 = dp_luma(texture(tex, uv - st).rgb);
    float a3 = dp_luma(texture(tex, uv + vec2(st.x, -st.y)).rgb);
    float a4 = dp_luma(texture(tex, uv - vec2(st.x, -st.y)).rgb);
    float busy = max(max(a1, a2), max(a3, a4)) - min(min(a1, a2), min(a3, a4));
    float clear = (1.0 - 0.90 * smoothstep(0.04, 0.26, busy)) * (1.0 - 0.45 * smoothstep(0.70, 0.95, lum));

    float dE = min(min(px.x, sz.x - px.x), min(px.y, sz.y - px.y));
    float mn = min(sz.x, sz.y);
    float mw = 0.09 * mn;
    float inMargin = 1.0 - smoothstep(mw * 0.5, mw * 1.2, dE);
    float inWide = 1.0 - smoothstep(mw * 1.0, mw * 2.2, dE);
    vec2 cd = vec2(min(px.x, sz.x - px.x), min(px.y, sz.y - px.y));
    float corner = exp(-length(cd) / (0.22 * mn));                    // 1 in a corner, fading along the edges

    vec3 cold = vec3(0.62, 0.78, 0.72);                                // cold green-grey light
    vec3 bone = vec3(0.90, 0.88, 0.80);
    vec3 blood = vec3(0.90, 0.04, 0.03);

    vec3 L = vec3(0.0);                                                // light that is added (or tints on pale windows)
    float D = 0.0;                                                     // dirt that darkens

    // ---- fog and grime: slow noise in the margins, thicker in the corners
    float fogK = inWide * (0.45 + 0.55 * corner);
    if (fogK > 0.0) {
        float n = dp_fbm(px / (46.0 * sc) + vec2(sd * 13.0, sd * 5.0) + vec2(t * 0.012, 0.0));
        float m = smoothstep(0.30, 0.75, n);
        L += vec3(0.46, 0.55, 0.50) * m * fogK * 0.30 * clear;
        float g = smoothstep(0.42, 0.80, dp_fbm(px / (17.0 * sc) + 31.0 + sd * 9.0));
        D += g * fogK * 0.34 * (0.4 + 0.6 * corner) * clear;
        // fine condensation: a fine grain of tiny beads
        vec2 fb = dp_beads(px, 5.5 * sc, 0.38, 0.14, 0.24, 2.0, sd);
        vec2 fc = dp_beads(mat2(0.82, -0.57, 0.57, 0.82) * px + 40.0, 8.0 * sc, 0.28, 0.12, 0.24, 3.0, sd);
        fb += fc;
        L += cold * fb.x * 0.60 * fogK * clear;
        D += fb.y * 0.30 * fogK * clear;
    }

    // ---- beads of water, larger, sparse, mostly in the corners
    if (inWide > 0.0) {
        float dens = 0.40 * (0.25 + 0.75 * corner) * inWide;
        vec2 b1 = dp_beads(px, 17.0 * sc, dens, 0.14, 0.34, 0.0, sd);
        vec2 b2 = dp_beads(px + vec2(9.0, 5.0), 10.0 * sc, dens * 1.3, 0.16, 0.34, 1.0, sd);
        L += mix(cold, bone, 0.4) * (b1.x * 0.50 + b2.x * 0.40) * clear;
        D += (b1.y * 0.38 + b2.y * 0.30) * clear;
    }

    // ---- a few slow drips near the side edges
    {
        float dxE = min(px.x, sz.x - px.x);
        float band = 1.0 - smoothstep(mw * 1.5, mw * 2.6, dxE);
        if (band > 0.0) {
            vec2 dr = dp_drip(px, sz, 23.0 * sc, t, sd);
            L += cold * (dr.x * 0.34 + dr.y * 0.70) * band * clear;
            D += (dr.x * 0.18 + dr.y * 0.30) * band * clear;
        }
    }

    // ---- hairline crack in one corner (the seed picks which)
    {
        float cxr = step(0.5, fract(sd * 7.31)), cyr = step(0.5, fract(sd * 3.17 + 0.3));
        vec2 q = vec2(cxr > 0.5 ? sz.x - px.x : px.x, cyr > 0.5 ? sz.y - px.y : px.y);
        if (q.x < 0.42 * mn && q.y < 0.42 * mn) {
            float dk = dp_crack(q, 0.036 * mn, sd * 9.0 + 0.5);
            float line = exp(-dk * dk / (2.0 * 0.55 * 0.55));
            float shadow = exp(-pow((dk - 1.4) / 0.6, 2.0));
            float cl = 0.45 + 0.55 * clear;
            L += bone * line * 0.40 * cl;
            D += shadow * 0.12 * cl + line * 0.06;
        }
    }

    // ---- the rim: blood-red heartbeat on the focused window, cold pale edge on the others
    {
        float ph = fract(t / 3.6 + sd * 0.37);
        float lub = exp(-pow((ph - 0.10) / 0.045, 2.0));
        float dub = 0.65 * exp(-pow((ph - 0.27) / 0.055, 2.0));
        float beat = lub + dub;                                        // two beats, then a long rest
        float edge = exp(-dE / 1.1) * 0.55 + exp(-dE / 9.0) * 0.20;
        float low = 0.7 + 0.3 * smoothstep(0.2, 1.0, px.y / sz.y);
        L += blood * edge * (0.10 + 0.50 * beat) * low * act;
        L += blood * exp(-dE / 22.0) * 0.07 * beat * act;
        L += cold * (exp(-dE / 0.9) * 0.34 + exp(-dE / 7.0) * 0.05) * (1.0 - act) * (0.8 + 0.2 * corner);
    }

    // ---- lay it on: on dark glass it adds, on pale glass it tints so it does not vanish
    float tot = max(L.r, max(L.g, L.b));
    float pale = smoothstep(0.45, 0.9, lum);
    vec3 lit = c * (1.0 - clamp(D, 0.0, 0.6)) + L * (1.0 - 0.75 * pale);
    vec3 tint = c * (vec3(1.0) - (vec3(1.0) - normalize(L + 1e-4) * 1.15) * clamp(tot * 2.2, 0.0, 0.40)) * (1.0 - clamp(D, 0.0, 0.5));
    c = mix(lit, tint, pale * 0.85);

    // unfocused: a faint green-grey wash and a little less colour
    float l2 = dp_luma(c);
    c = mix(c, vec3(l2) * vec3(0.92, 1.0, 0.96), 0.14 * (1.0 - act));

    fragColor = vec4(clamp(c, 0.0, 0.99), s.a);
}
