#version 300 es
// target: window
// category: Ambient
// desc: Rune Hall: a frame of carved Elder Futhark style runes and a Greek-key meander runs around the window, with a rotating interlaced knot in each corner; on the focused window two embers travel round the frame, each rune igniting amber, cooling to ice blue and fading, and now and then a bright ring of light races once around, while runes near the pointer flare and a slow ring of runes turns around the pointer; idle windows keep only dim carved stone, and body text stays clear (animated)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
uniform vec2 mouse;
uniform vec4 window_box;
layout(location = 0) out vec4 fragColor;

float rh_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float rh_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float rh_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }
float rh_seg(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float u = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return length(p - (a + ab * u));
}

// a small Elder Futhark style rune: q in units of the glyph height, y up, about +-0.5 tall and +-0.3 wide.
// returns the distance to the nearest stroke (in the same units); the kind comes from the hash hh
float rh_glyph(vec2 q, float hh) {
    if (fract(hh * 17.31) > 0.5) q.x = -q.x;
    float kk = floor(hh * 12.0);
    float d = 9.0;
    vec2 t = vec2(0.0, 0.5);
    vec2 b = vec2(0.0, -0.5);
    if (kk < 0.5) {            // fehu
        d = min(rh_seg(q, b, t), min(rh_seg(q, vec2(0.0, 0.5), vec2(0.32, 0.28)), rh_seg(q, vec2(0.0, 0.14), vec2(0.32, -0.08))));
    } else if (kk < 1.5) {     // thurisaz
        d = min(rh_seg(q, b, t), min(rh_seg(q, vec2(0.0, 0.3), vec2(0.3, 0.05)), rh_seg(q, vec2(0.3, 0.05), vec2(0.0, -0.2))));
    } else if (kk < 2.5) {     // uruz
        d = min(rh_seg(q, vec2(-0.26, -0.5), vec2(-0.26, 0.5)), min(rh_seg(q, vec2(-0.26, 0.5), vec2(0.26, 0.22)), rh_seg(q, vec2(0.26, 0.22), vec2(0.26, -0.5))));
    } else if (kk < 3.5) {     // raido
        d = min(rh_seg(q, b, t), min(rh_seg(q, t, vec2(0.3, 0.24)), min(rh_seg(q, vec2(0.3, 0.24), vec2(0.0, 0.0)), rh_seg(q, vec2(0.0, 0.0), vec2(0.3, -0.5)))));
    } else if (kk < 4.5) {     // kenaz
        d = min(rh_seg(q, vec2(0.28, 0.4), vec2(-0.2, 0.0)), rh_seg(q, vec2(-0.2, 0.0), vec2(0.28, -0.4)));
    } else if (kk < 5.5) {     // gebo
        d = min(rh_seg(q, vec2(-0.3, -0.4), vec2(0.3, 0.4)), rh_seg(q, vec2(-0.3, 0.4), vec2(0.3, -0.4)));
    } else if (kk < 6.5) {     // nauthiz
        d = min(rh_seg(q, b, t), rh_seg(q, vec2(-0.3, 0.2), vec2(0.3, -0.2)));
    } else if (kk < 7.5) {     // hagalaz
        d = min(rh_seg(q, vec2(-0.24, -0.5), vec2(-0.24, 0.5)), min(rh_seg(q, vec2(0.24, -0.5), vec2(0.24, 0.5)), rh_seg(q, vec2(-0.24, 0.16), vec2(0.24, -0.16))));
    } else if (kk < 8.5) {     // sowilo
        d = min(rh_seg(q, vec2(0.2, 0.5), vec2(-0.16, 0.16)), min(rh_seg(q, vec2(-0.16, 0.16), vec2(0.16, -0.16)), rh_seg(q, vec2(0.16, -0.16), vec2(-0.2, -0.5))));
    } else if (kk < 9.5) {     // berkano
        d = min(rh_seg(q, b, t), min(rh_seg(q, t, vec2(0.3, 0.25)), min(rh_seg(q, vec2(0.3, 0.25), vec2(0.0, 0.0)), min(rh_seg(q, vec2(0.0, 0.0), vec2(0.3, -0.25)), rh_seg(q, vec2(0.3, -0.25), b)))));
    } else if (kk < 10.5) {    // tiwaz
        d = min(rh_seg(q, b, t), min(rh_seg(q, vec2(-0.3, 0.2), t), rh_seg(q, t, vec2(0.3, 0.2))));
    } else {                   // algiz
        d = min(rh_seg(q, b, t), min(rh_seg(q, vec2(0.0, 0.0), vec2(-0.3, 0.4)), rh_seg(q, vec2(0.0, 0.0), vec2(0.3, 0.4))));
    }
    return d;
}

// heat of one slot of the frame: two embers ride round the frame (s counts runes), a rune ignites when an ember
// reaches it, burns amber, cools to ice blue and fades; a third bright ring races round now and then
void rh_heat(float s, float h1, float h2, float hp, float pa, float dir, float N, float tau, float act, vec3 tail, float ramp, out float B, out vec3 col) {
    float a = min(mod(dir * (h1 - s), N), mod(dir * (h2 - s), N));
    float tl = a / tau;
    float b = smoothstep(0.0, ramp, a) * (0.55 * exp(-tl * 1.6) + 0.50 * exp(-tl * 0.45)) * act;
    float cool = smoothstep(0.25, 1.7, tl);
    vec3 hot = mix(vec3(1.0, 0.74, 0.30), tail, cool) + vec3(0.45, 0.40, 0.30) * exp(-a * 1.8);
    float ap = mod(dir * (hp - s), N);
    float bp = smoothstep(0.0, ramp * 2.0, ap) * exp(-ap / (tau * 1.3)) * pa;
    float wp = bp / (bp + b + 0.001);
    col = mix(hot, vec3(0.78, 0.94, 1.0), wp);
    B = max(b, bp);
}

// paint a stroke mask: carved stone, or lit by its heat
vec3 rh_paint(vec3 c, float ink, float B, vec3 hot, float gate, float lg, float act, float k) {
    vec3 stone = mix(vec3(0.38, 0.40, 0.46), vec3(0.30, 0.22, 0.14), lg) * (0.62 + 0.38 * act);
    vec3 hotc = mix(hot, hot * hot * 0.7, lg);
    vec3 col = mix(stone, hotc, clamp(B * 1.25, 0.0, 1.0));
    float al = clamp((0.52 + 0.14 * act + 0.5 * B) * k, 0.0, 0.95) * ink * gate;
    return mix(c, col, al);
}

void main() {
    vec4 s = texture(tex, v_texcoord);
    float a = s.a;
    vec3 c = s.rgb / max(a, 0.001);
    float k = min(STRENGTH / 0.55, 1.3);
    float act = is_active;
    vec2 size = max(surface_size, vec2(1.0));
    vec2 px = v_texcoord * size;
    float sc = clamp(size.y / 560.0, 0.85, 1.8);
    float W = size.x;
    float H = size.y;
    float lum = rh_luma(c);

    float dark = 1.0 - smoothstep(0.16, 0.50, lum);
    float lg = smoothstep(0.70, 0.90, lum);
    float gate = max(dark, lg);

    vec2 pm = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0)) * size;
    float dx = min(px.x, W - px.x);
    float dy = min(px.y, H - px.y);
    float e = min(dx, dy);

    // layout of the frame: corner knots, then rune cells along every side, clockwise from the top-left corner
    float K = 36.0 * sc;
    float P = 20.0 * sc;
    float nh = max(1.0, floor((W - 2.0 * K) / P));
    float nv = max(1.0, floor((H - 2.0 * K) / P));
    float cellh = (W - 2.0 * K) / nh;
    float cellv = (H - 2.0 * K) / nv;
    float N = 4.0 + 2.0 * nh + 2.0 * nv;
    float tau = 6.0 + 0.04 * N;

    // each window has its own direction, pace, phase and cold tint
    float dirS = rh_h(vec2(seed * 5.3, 1.7)) > 0.5 ? 1.0 : -1.0;
    float lap = 18.0 + 9.0 * rh_h(vec2(seed * 9.1, 2.3));
    float h1 = seed * N * 3.7 + dirS * time * (N / lap);
    float h2 = h1 + 0.5 * N;
    vec3 tail = mix(vec3(0.30, 0.72, 1.00), vec3(0.30, 0.95, 0.85), step(0.5, rh_h(vec2(seed * 3.1, 4.4))));
    float cyc = 13.0;
    float loc = mod(time + seed * 41.0, cyc);
    float xp = min(loc / 1.8, 1.0);
    float hp = dirS > 0.0 ? xp * N : N - xp * N;
    float pa = act * smoothstep(0.0, 0.15, loc) * (1.0 - smoothstep(1.8, 2.6, loc));

    float ink = 0.0;
    float inkB = 0.0;
    vec3 inkHot = vec3(1.0, 0.74, 0.3);
    float inkAmt = 1.0;
    vec3 glow = vec3(0.0);
    float outl = 0.0;
    float fsig = 90.0 * sc;

    if (e < 62.0 * sc) {
        float B0 = 0.0;
        vec3 col0 = vec3(1.0);
        if (dx < K && dy < K) {
            // corner knot: two interlaced strands of a three-lobed rose, over and under, slowly turning and breathing
            float cid = (px.x > W * 0.5 ? 1.0 : 0.0) + (px.y > H * 0.5 ? 2.0 : 0.0);
            float idx = cid < 0.5 ? 0.0 : (cid < 1.5 ? 1.0 + nh : (cid < 2.5 ? 3.0 + 2.0 * nh + nv : 2.0 + nh + nv));
            rh_heat(idx + 0.5, h1, h2, hp, pa, dirS, N, tau, act, tail, 0.5, B0, col0);
            vec2 cc = vec2(px.x > W * 0.5 ? W - K * 0.5 : K * 0.5, px.y > H * 0.5 ? H - K * 0.5 : K * 0.5);
            float fl = exp(-dot(cc - pm, cc - pm) / (2.0 * fsig * fsig)) * (0.55 + 0.45 * act);
            float breathe = 0.5 + 0.5 * sin(time * 1.2 + cid * 1.7 + seed * 6.0);
            float Bk = max(max(B0, fl), (0.10 + 0.22 * breathe) * act);
            vec2 q = vec2(dx, dy) - vec2(K * 0.5);
            float r = length(q);
            float R = 10.5 * sc * (1.0 + 0.07 * sin(time * 1.1 + cid * 2.0 + seed * 5.0));
            float A = 4.2 * sc;
            float rot = time * 0.35 * (mod(cid, 2.0) < 0.5 ? 1.0 : -1.0) + cid * 1.3 + seed * 6.28;
            float psi = 3.0 * atan(q.y, q.x) + rot;
            float cs = cos(psi);
            float sn = sin(psi);
            float fac = 1.0 / sqrt(1.0 + pow(3.0 * A * sn / max(r, 1.0), 2.0));
            float w = 1.25 * sc;
            float d1 = abs(r - (R + A * cs)) * fac;
            float d2 = abs(r - (R - A * cs)) * fac;
            float mf = floor((psi - 1.5707963) / 3.1415927 + 0.5);
            float dl = abs((psi - 1.5707963) - mf * 3.1415927) / 3.0 * r;
            float odd = mod(mf, 2.0);
            float cut = smoothstep(2.4 * sc, 3.4 * sc, dl);
            float s1 = rh_aa(d1, w) * mix(1.0, cut, odd);
            float s2 = rh_aa(d2, w) * mix(cut, 1.0, odd);
            float jewel = rh_aa(r, (1.6 + 0.5 * breathe) * sc);
            ink = max(max(s1, s2), jewel * 0.9);
            outl = max(rh_aa(min(d1, d2), w + 1.2 * sc) - ink, 0.0);
            inkB = Bk;
            inkHot = col0;
            glow += col0 * (exp(-min(d1, d2) * min(d1, d2) / (9.0 * sc * sc)) * 0.26 + exp(-r * r / (130.0 * sc * sc)) * 0.10) * Bk;
        } else {
            float l; float off; float cell; float n; vec2 cpx;
            float ec = 20.0 * sc;
            float side;
            if (dy < dx) {
                cell = cellh; n = nh;
                if (px.y < H * 0.5) { l = px.x - K; off = 1.0; side = 0.0; }
                else { l = (W - px.x) - K; off = 3.0 + nh + nv; side = 2.0; }
            } else {
                cell = cellv; n = nv;
                if (px.x > W * 0.5) { l = px.y - K; off = 2.0 + nh; side = 1.0; }
                else { l = (H - px.y) - K; off = 4.0 + 2.0 * nh + nv; side = 3.0; }
            }
            float i = clamp(floor(l / cell), 0.0, n - 1.0);
            float lc = K + (i + 0.5) * cell;
            if (side < 0.5) cpx = vec2(lc, ec);
            else if (side < 1.5) cpx = vec2(W - ec, lc);
            else if (side < 2.5) cpx = vec2(W - lc, H - ec);
            else cpx = vec2(ec, H - lc);
            float sCont = off + l / cell;
            // continuous glow along the frame
            float Bc; vec3 colc;
            rh_heat(sCont, h1, h2, hp, pa, dirS, N, tau, act, tail, 5.0, Bc, colc);
            float fpix = exp(-dot(px - pm, px - pm) / (2.0 * fsig * fsig)) * (0.55 + 0.45 * act);
            Bc = max(Bc, fpix * 0.8);
            glow += colc * Bc * exp(-e / (24.0 * sc)) * 0.34;
            glow += vec3(1.0, 0.70, 0.30) * (0.025 + 0.02 * sin(time * 0.7 + sCont * 0.9)) * (1.0 - act) * exp(-e / (12.0 * sc));

            // rune
            if (e > 11.0 * sc && e < 29.0 * sc) {
                float gh = 15.0 * sc;
                float hh = rh_h(vec2(off + i, seed * 13.7));
                vec2 gq = vec2(l - i * cell - cell * 0.5, -(e - ec)) / gh;
                float d = 9.0;
                if (abs(gq.x) < 0.7 && abs(gq.y) < 0.72) d = rh_glyph(gq, hh) * gh;
                float w = 1.15 * sc;
                float Br; vec3 colr;
                rh_heat(off + i + 0.5, h1, h2, hp, pa, dirS, N, tau, act, tail, 0.5, Br, colr);
                float flr = exp(-dot(cpx - pm, cpx - pm) / (2.0 * fsig * fsig)) * (0.55 + 0.45 * act);
                float ph = rh_h(vec2(off + i, seed * 7.7)) * 6.28;
                float ember = (0.06 + 0.07 * (0.5 + 0.5 * sin(time * 0.9 + ph))) * (1.0 - act) + 0.10 * act * (0.5 + 0.5 * sin(time * 1.3 + ph));
                if (flr > Br) { colr = mix(colr, vec3(1.0, 0.86, 0.55), 0.7); }
                Br = max(max(Br, flr), ember);
                ink = rh_aa(d, w);
                outl = max(rh_aa(d, w + 1.2 * sc) - ink, 0.0);
                inkB = Br;
                inkHot = colr;
                glow += colr * exp(-d * d / (2.0 * 3.2 * sc * 3.2 * sc)) * Br * 0.34;
            } else if (e > 3.0 * sc && e < 11.0 * sc) {
                // Greek-key meander, carried by the same travelling heat
                float mcell = 8.0 * sc;
                float ph = rh_h(vec2(seed * 3.0, 9.0)) * mcell;
                float u = fract((l + ph) / mcell);
                vec2 q = vec2(u, (e - 3.5 * sc) / (7.0 * sc));
                float d = 9.0;
                d = min(d, rh_seg(q, vec2(0.0, 1.0), vec2(1.0, 1.0)));
                d = min(d, rh_seg(q, vec2(0.0, 1.0), vec2(0.0, 0.0)));
                d = min(d, rh_seg(q, vec2(0.0, 0.0), vec2(0.86, 0.0)));
                d = min(d, rh_seg(q, vec2(0.86, 0.0), vec2(0.86, 0.70)));
                d = min(d, rh_seg(q, vec2(0.86, 0.70), vec2(0.30, 0.70)));
                d = min(d, rh_seg(q, vec2(0.30, 0.70), vec2(0.30, 0.30)));
                d = min(d, rh_seg(q, vec2(0.30, 0.30), vec2(0.56, 0.30)));
                ink = rh_aa(d * 7.0 * sc, 0.65 * sc);
                inkB = Bc * 0.85 + 0.04;
                inkHot = colc;
                inkAmt = 0.8;
            }
        }
    }

    // the pointer carries a slow ring of runes
    float rink = 0.0;
    float rB = 0.0;
    vec3 rhot = vec3(1.0, 0.74, 0.3);
    float Rr = 56.0 * sc;
    vec2 pv = px - pm;
    float rr = length(pv);
    float inside = smoothstep(0.0, 26.0 * sc, min(min(pm.x, W - pm.x), min(pm.y, H - pm.y)));
    if (rr < Rr + 16.0 * sc && rr > Rr - 16.0 * sc && inside > 0.01) {
        float cellA = 0.5235988;
        float fth = (atan(pv.y, pv.x) + time * 0.22 * dirS) / cellA;
        float ri = floor(fth);
        float fr = fth - ri;
        float rim = mod(ri, 12.0);
        float gh = 13.0 * sc;
        vec2 gq = vec2((fr - 0.5) * cellA * Rr, rr - Rr) / gh;
        float d = 9.0;
        if (abs(gq.x) < 0.7 && abs(gq.y) < 0.72) d = rh_glyph(gq, rh_h(vec2(rim * 3.1, seed * 5.0 + 2.0))) * gh;
        float ra = mod(dirS * (time * 1.8 - rim), 12.0);
        float cool = smoothstep(0.3, 1.8, ra / 3.5);
        rB = 0.22 + 0.78 * exp(-ra / 3.5) * smoothstep(0.0, 0.3, ra);
        rhot = mix(vec3(1.0, 0.74, 0.30), tail, cool);
        float lines = max(rh_aa(abs(rr - (Rr - 12.0 * sc)), 0.55 * sc), rh_aa(abs(rr - (Rr + 12.0 * sc)), 0.55 * sc) * (0.5 + 0.5 * sin(atan(pv.y, pv.x) * 36.0 + time)));
        rink = max(rh_aa(d, 1.05 * sc), lines * 0.55) * inside * (0.55 + 0.45 * act);
        glow += rhot * exp(-d * d / (2.0 * 3.0 * sc * 3.0 * sc)) * rB * 0.22 * inside;
    }

    // soft light first (only on dark ground), then the carving, held back wherever the neighbourhood looks like text
    c = c + (1.0 - c) * clamp(glow * dark * k, 0.0, 1.0);
    float ia = max(ink, rink);
    if (ia > 0.004) {
        vec2 o = vec2(4.0 * sc) / size;
        float dmax = 0.0;
        dmax = max(dmax, abs(rh_luma(textureLod(tex, v_texcoord + vec2(o.x, 0.0), 0.0).rgb) - lum));
        dmax = max(dmax, abs(rh_luma(textureLod(tex, v_texcoord - vec2(o.x, 0.0), 0.0).rgb) - lum));
        dmax = max(dmax, abs(rh_luma(textureLod(tex, v_texcoord + vec2(0.0, o.y), 0.0).rgb) - lum));
        dmax = max(dmax, abs(rh_luma(textureLod(tex, v_texcoord - vec2(0.0, o.y), 0.0).rgb) - lum));
        float calm = 1.0 - smoothstep(0.07, 0.22, dmax);
        float g = gate * calm;
        c *= 1.0 - outl * 0.30 * g * lg;
        c = rh_paint(c, ink * inkAmt, inkB, inkHot, g, lg, act, k);
        c = rh_paint(c, rink, rB, rhot, g, lg, act, k * 0.9);
    }

    // idle windows sit back a little
    c = mix(c * vec3(0.975, 0.98, 1.0), c, act);

    fragColor = vec4(clamp(c, 0.0, 1.0), a);
}
