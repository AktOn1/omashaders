#version 300 es
// target: window
// category: Ambient
// desc: PCB pane: a slim, fine bundle of copper traces rings every window with bright current pulses that circulate round the whole border and light up a dense row of side branches ending in solder pins, small corner chips with blinking LEDs and chasing pads, twinkling vias in a green board margin, and a board link: wherever one of the Circuit trace wallpaper's own traces reaches the window's edge it carries on inside through a gold edge contact to a via, with the same pulse running through; the border near the pointer runs hot, and on the focused window a power-on scan line sweeps down every few seconds while idle windows dim and idle slowly; body text stays clear (animated)
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
uniform vec2 resolution;
layout(location = 0) out vec4 fragColor;

float pp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float pp_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float pp_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }
float pp_box(vec2 r, vec2 hs) { vec2 d = abs(r) - hs; return clamp(0.5 - max(d.x, d.y), 0.0, 1.0); }
// distance to a segment (x) and the position along it, 0..1 (y)
vec2 pp_seg(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
    return vec2(length(p - a - ab * h), h);
}
// (distance along, distance in) measured from one side: 1 top, 2 bottom, 3 left, 4 right
vec2 pp_frame(vec2 p, vec2 size, float sd) {
    if (sd < 1.5) return vec2(p.x, p.y);
    if (sd < 2.5) return vec2(p.x, size.y - p.y);
    if (sd < 3.5) return vec2(p.y, p.x);
    return vec2(p.y, size.x - p.x);
}

// the way a lane steps sideways along a side: levels change every Lc pixels along the side, each change a 45 degree ramp.
// returns the lane offset; slope is 1 on a ramp and 0 on a straight run
float pp_off(float s, float Lc, float sid, float sc, out float slope, out float cellId, out float fcell, out float rampLen, out float lvlNow) {
    float cell = floor(s / Lc);
    float f = s - cell * Lc;
    float lA = floor(pp_h(vec2(cell - 1.0, sid)) * 3.0) * 3.5 * sc;
    float lB = floor(pp_h(vec2(cell, sid)) * 3.0) * 3.5 * sc;
    float dl = lA - lB;
    float rem = max(abs(dl) - f, 0.0);
    slope = (abs(dl) > f && abs(dl) > 0.01) ? 1.0 : 0.0;
    cellId = cell; fcell = f; rampLen = abs(dl); lvlNow = lB;
    return lB + sign(dl) * rem;
}

// a pulse train on lane i at perimeter coordinate Pc: x = phase inside its cell (the head sits at 0.94), y = 1 if the cell carries a pulse.
// The cell count is a whole number round the border, so the pulses run on seamlessly round the corners.
vec2 pp_pl(float Pc, float i, float Ptot, float sc, float act, float sdv, float tm) {
    float n = max(floor(Ptot / ((330.0 + 90.0 * i) * sc) + 0.5), 3.0);
    float per = Ptot / n;
    float dir = (i > 0.5 && i < 1.5) ? -1.0 : 1.0;
    float spd = (0.30 + 0.07 * i + 0.10 * fract(sdv * 7.3 + i * 0.37)) * (0.30 + 0.70 * act);
    float q = dir * Pc / per - tm * spd + sdv * 5.0 + i * 0.37;
    float kk = floor(q);
    float h = pp_h(vec2(mod(kk, n) + i * 7.0, sdv * 9.0 + 3.0));
    return vec2(q - kk, step(h, 0.62));
}
float pp_prof(float u) {
    return exp(-max(0.94 - u, 0.0) * 4.2) * exp(-max(u - 0.94, 0.0) * 60.0);
}

// the wallpaper's board (circuit-trace effect): the same cell hash and routing rules, so a trace that reaches this window's edge can be found here
float pp_pk(vec2 c) {
    float r = pp_h(c + 0.37);
    if (r < 0.05) return 1.0;
    if (r < 0.085) return 2.0;
    if (r < 0.115) return 3.0;
    if (r < 0.135) return 4.0;
    if (r < 0.165) return 5.0;
    return 0.0;
}
float pp_pa(float k, float horiz) {
    if (k < 0.5) return 1.0;
    if (k > 4.5) return 1.0;
    if (k > 2.5 && k < 3.5) return horiz < 0.5 ? 1.0 : 0.0;
    return horiz > 0.5 ? 1.0 : 0.0;
}
float pp_pe(vec2 c, float kA, float kB, float horiz) {
    if (pp_pa(kA, horiz) < 0.5 || pp_pa(kB, horiz) < 0.5) return 0.0;
    float comp = (kA > 0.5 || kB > 0.5) ? 0.88 : 0.47;
    if (pp_h(c * 1.31 + horiz * 17.3 + 5.1) > comp) return 0.0;
    bool two = (kA > 1.5 && kA < 4.5) || (kB > 1.5 && kB < 4.5);
    return (pp_h(c * 0.77 + horiz * 9.1 + 2.9) < 0.32 && !two) ? 3.0 : 1.0;
}
// the pulses riding a run of the wallpaper's traces: a = position along the run in cells, id = row or column
float pp_cp(float a, float id, float dirH, float t, float wake) {
    float sgn = pp_h(vec2(id * 3.1 + dirH * 7.7, 11.0)) < 0.5 ? -1.0 : 1.0;
    float ph = t * 0.34 - sgn * a / 3.0 + pp_h(vec2(id, dirH + 2.0));
    float k = floor(ph);
    float u = ph - k;
    float on = step(pp_h(vec2(id * 1.7 + k * 0.73, dirH * 5.0)), 0.34 + 0.40 * wake);
    float f = on * exp(-u * 12.0) * smoothstep(1.0, 0.97, u);
    float ph2 = t * 1.05 - sgn * a / 2.0 + pp_h(vec2(id + 4.0, dirH + 9.0));
    float k2 = floor(ph2);
    float u2 = ph2 - k2;
    float on2 = step(pp_h(vec2(id * 2.3 + k2 * 0.91, dirH * 3.0 + 6.0)), 0.95 * wake);
    return max(f, on2 * exp(-u2 * 9.0) * smoothstep(1.0, 0.97, u2));
}

void main() {
    vec4 s = texture(tex, v_texcoord);
    float a = s.a;
    vec3 c = s.rgb / max(a, 0.001);
    float k = min(STRENGTH / 0.55, 1.3);
    float act = is_active;
    vec2 size = surface_size;
    vec2 px = v_texcoord * size;
    float sc = clamp(size.y / 700.0, 0.8, 1.8) * 0.7;
    float lum = pp_luma(c);
    float dark = 1.0 - smoothstep(0.12, 0.60, lum);
    float vis = (0.55 + 0.45 * dark) * (0.40 + 0.60 * act) * k;
    float pace = 0.30 + 0.70 * act;

    // nearest side, position along it going clockwise round the border, perimeter coordinate
    vec2 dd = vec2(min(px.x, size.x - px.x), min(px.y, size.y - px.y));
    float dN = dd.x < dd.y ? dd.x : dd.y;
    bool horizSide = dd.y <= dd.x;
    float sid; float aP; float Poff; float sideLen;
    if (horizSide) {
        if (px.y < size.y * 0.5) { sid = 1.0; aP = px.x; Poff = 0.0; }
        else { sid = 3.0; aP = size.x - px.x; Poff = size.x + size.y; }
        sideLen = size.x;
    } else {
        if (px.x < size.x * 0.5) { sid = 4.0; aP = size.y - px.y; Poff = 2.0 * size.x + size.y; }
        else { sid = 2.0; aP = px.y; Poff = size.x; }
        sideLen = size.y;
    }
    float Ptot = 2.0 * (size.x + size.y);
    float P = Poff + aP;
    float W = 62.0 * sc;
    float base = 2.6 * sc;
    float ps = 3.7 * sc;
    float yIn = base + 2.0 * ps;                // distance of the innermost lane

    vec3 copper = vec3(0.92, 0.55, 0.24);
    vec3 gold = vec3(1.00, 0.84, 0.46);
    vec3 cold = vec3(0.86, 0.97, 1.00);
    vec3 amber = vec3(1.00, 0.62, 0.16);

    // pointer, kept inside the window; how close it is to the window at all
    vec2 mpRaw = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0)) * size;
    vec2 mp = clamp(mpRaw, vec2(0.0), size);
    float near = 1.0 - smoothstep(0.0, 140.0 * sc, length(mpRaw - mp));
    vec2 dmp = px - mp;
    float heat = exp(-dot(dmp, dmp) / (2.0 * 130.0 * sc * 130.0 * sc)) * near;

    // power-on scan: a line sweeps down the focused window every few seconds and the traces ignite as it passes
    float cyc = mod(time + seed * 9.0, 8.0) / 2.6;
    float ys = cyc * (size.y + 160.0 * sc) - 80.0 * sc;
    float dy = px.y - ys;
    float sweepOn = act * step(cyc, 1.0);
    float ignite = sweepOn * exp(-dy * dy / (2.0 * 34.0 * sc * 34.0 * sc));
    float scanLine = sweepOn * exp(-dy * dy / (1.4 * sc * 1.4 * sc));
    float scanTrail = sweepOn * (1.0 - smoothstep(0.0, 70.0 * sc, -dy)) * step(dy, 0.0);

    float edgeFade = 1.0 - smoothstep(W * 0.45, W, dN);
    float edgeNear = 1.0 - smoothstep(10.0 * sc, 30.0 * sc, dN);

    // the board: green-teal solder mask in the margin of dark areas, and a warm backlight that breathes
    float breathe = 0.65 + 0.35 * sin(time * 0.9 + seed * 6.28);
    c = mix(c, c * vec3(0.74, 0.96, 0.84) + vec3(0.0, 0.014, 0.008), 0.55 * dark * edgeFade * min(k, 1.0));
    c += amber * (0.05 + 0.04 * heat) * breathe * pow(edgeNear, 1.5) * dark * (0.5 + 0.5 * act) * k;

    float cuA = 0.0; float auA = 0.0; float holeA = 0.0; float pulseA = 0.0; float stubA = 0.0; float stubLit = 0.0; float dotA = 0.0; float dotTw = 0.0;
    if (dN < W) {
        float Lc = 150.0 * sc;
        float slope; float cellId; float fcell; float rampLen; float lvl;
        float off = pp_off(aP, Lc, sid + seed * 7.0, sc, slope, cellId, fcell, rampLen, lvl);
        float sf = slope > 0.5 ? 0.7071 : 1.0;
        float hw = 0.95 * sc + 0.12;
        for (int i = 0; i < 3; i++) {
            float fi = float(i);
            float dl = abs(dN - (base + fi * ps + off)) * sf;
            float ln = pp_aa(dl, hw);
            cuA = max(cuA, ln);
            vec2 pl = pp_pl(P, fi, Ptot, sc, act, seed, time);
            float f = pl.y * pp_prof(pl.x);
            float halo = exp(-dl * dl / (3.4 * sc * 3.4 * sc));
            pulseA = max(pulseA, f * (ln + 0.55 * halo));
        }

        // branches: a side trace leaves the inner lane every so often and lights up when the pulse of that lane passes
        float Ls = 36.0 * sc;
        float cellS = floor(P / Ls);
        float a0 = (cellS + 0.5) * Ls;
        float xl = P - a0;
        float a0s = a0 - Poff;
        float hs = pp_h(vec2(cellS + sid * 0.37, seed * 11.0 + 2.0));
        if (hs < 0.90 && a0s > 44.0 * sc && a0s < sideLen - 44.0 * sc && abs(xl) < 14.0 * sc && dN < yIn + 34.0 * sc) {
            float len = (8.0 + 9.0 * fract(hs * 17.3)) * sc;
            float kd = fract(hs * 31.7) < 0.5 ? -1.0 : 1.0;
            float dk = fract(hs * 5.9) < 0.6 ? len * 0.42 : 0.0;
            float l1 = len - dk;
            vec2 p2 = vec2(xl, dN - (yIn + off));
            vec2 sa = pp_seg(p2, vec2(0.0, 0.0), vec2(0.0, l1));
            vec2 sb = pp_seg(p2, vec2(0.0, l1), vec2(kd * dk, l1 + dk));
            float dsb = min(sa.x, sb.x);
            float tot = l1 + 1.4142 * dk;
            float sp = (sa.x < sb.x ? sa.y * l1 : l1 + sb.y * 1.4142 * dk) / max(tot, 0.001);
            vec2 e = vec2(kd * dk, l1 + dk);
            float padR = length(p2 - e);
            float pad = pp_aa(padR, 2.1 * sc);
            stubA = max(pp_aa(dsb, 0.8 * sc), pad);
            holeA = max(holeA, pp_aa(padR, 0.9 * sc) * 0.7);
            vec2 pl = pp_pl(a0, 2.0, Ptot, sc, act, seed, time);
            float since = max(0.94 - pl.x, 0.0);
            float front = since / 0.10;
            float lit = pl.y * step(pl.x, 0.94) * step(sp, front) * exp(-since * 3.4) * (0.65 + 0.35 * exp(-max(front - sp, 0.0) * 5.0));
            float haloS = exp(-dsb * dsb / (3.0 * sc * 3.0 * sc));
            stubLit = max(stubLit, lit * (pp_aa(dsb, 0.8 * sc) + 0.5 * haloS + 0.9 * pad));
        }

        // a via on some of the steps, at the end of the ramp on the first lane
        float vh = pp_h(vec2(cellId * 2.7, sid + seed + 21.0));
        if (vh < 0.7 && rampLen > 0.01) {
            vec2 vp = vec2(rampLen + 5.0 * sc, base + lvl + ps);
            float rv = length(vec2(fcell, dN) - vp);
            auA = max(auA, pp_aa(abs(rv - 2.6 * sc), 0.8 * sc) * (vh < 0.25 ? 0.55 + 0.45 * sin(time * 2.4 + vh * 40.0) : 1.0));
            holeA = max(holeA, pp_aa(rv, 1.2 * sc));
        }

        // vias in the board beyond the traces: a fine field of dots, a few of them twinkle
        float pitch = 9.0 * sc;
        vec2 dc = floor(px / pitch);
        vec2 dl2 = (px / pitch - dc - 0.5) * pitch;
        float dh = pp_h(dc + seed * 13.0);
        float dfade = smoothstep(yIn + 5.0 * sc, yIn + 12.0 * sc, dN) * (1.0 - smoothstep(24.0 * sc, 34.0 * sc, dN));
        dotA = pp_aa(length(dl2), 0.75 * sc) * dfade * (dh > 0.35 ? 0.0 : 1.0);
        dotTw = step(0.93, dh) * pow(0.5 + 0.5 * sin(time * (1.2 + dh * 1.5) + dh * 90.0), 3.0);
    }

    // corner chips with an LED, and a column of solder pads that run a chase
    float chipA = 0.0; float ledA = 0.0; float padA = 0.0; float chipBody = 0.0; float padLit = 0.0; float ledC = 0.0; float cidv = 0.0;
    {
        vec2 r = dd - vec2(30.0 * sc, 26.0 * sc);
        if (abs(r.x) < 26.0 * sc && abs(r.y) < 20.0 * sc) {
            float cid = (px.x < size.x * 0.5 ? 0.0 : 1.0) + (px.y < size.y * 0.5 ? 0.0 : 2.0);
            cidv = cid;
            chipBody = pp_box(r, vec2(9.0 * sc, 6.5 * sc));
            float row = clamp(floor(r.x / (4.6 * sc) + 0.5), -1.0, 1.0);
            chipA = pp_box(vec2(r.x - row * 4.6 * sc, abs(r.y) - 8.6 * sc), vec2(1.2 * sc, 2.0 * sc));
            float blink = smoothstep(0.30, 0.70, sin(time * (1.6 + 0.45 * cid) * pace + seed * 6.28 + cid * 1.9));
            ledA = pp_aa(length(r - vec2(-5.8 * sc, -3.8 * sc)), 1.4 * sc);
            ledC = blink * (0.35 + 0.65 * act) + 0.12;
            for (int j = 0; j < 3; j++) {
                float fj = float(j);
                vec2 pc = r - vec2(-15.5 * sc, (fj - 1.0) * 7.5 * sc);
                float pad = pp_box(pc, vec2(1.7 * sc, 1.7 * sc));
                padA = max(padA, pad);
                float chase = pow(max(0.0, 1.0 - fract(time * 0.7 * pace - fj * 0.27 + cid * 0.31 + seed) * 2.2), 2.0);
                padLit = max(padLit, pad * chase);
            }
        }
    }

    // the board link: wherever one of the wallpaper's own traces meets this window's edge it carries on inside, with the same current running through
    float prtCu = 0.0; float prtAu = 0.0; float prtLit = 0.0; float prtHole = 0.0;
    {
        float wsc = clamp(resolution.y / 1080.0, 0.75, 2.0);
        float wC = 80.0 * wsc;
        vec2 S = window_box.xy + px;
        float pOn = 0.0; float pAl = dN; float pLat = 0.0; float pId = 0.0; float pDir = 1.0; float pA = 0.0; float pBus = 0.0;
        if (dN < 44.0 * wsc) {
            if (!horizSide) {
                float rowC = floor(S.y / wC);
                float lat = S.y - (rowC + 0.5) * wC;
                if (abs(lat) < 10.0 * wsc) {
                    float edgeX = px.x < size.x * 0.5 ? window_box.x : window_box.x + size.x - 1.0;
                    vec2 cc = vec2(floor(edgeX / wC), rowC);
                    float kd = pp_pk(cc);
                    float nL = pp_pe(cc - vec2(1.0, 0.0), pp_pk(cc - vec2(1.0, 0.0)), kd, 1.0);
                    float nR = pp_pe(cc, kd, pp_pk(cc + vec2(1.0, 0.0)), 1.0);
                    if (kd < 0.5 && nL > 0.5 && nR > 0.5) { pOn = 1.0; pLat = lat; pId = rowC; pDir = 1.0; pA = S.x / wC; pBus = max(nL, nR); }
                }
            } else {
                float colC = floor(S.x / wC);
                float lat = S.x - (colC + 0.5) * wC;
                if (abs(lat) < 10.0 * wsc) {
                    float edgeY = px.y < size.y * 0.5 ? window_box.y : window_box.y + size.y - 1.0;
                    vec2 cc = vec2(colC, floor(edgeY / wC));
                    float kd = pp_pk(cc);
                    float nU = pp_pe(cc - vec2(0.0, 1.0), pp_pk(cc - vec2(0.0, 1.0)), kd, 0.0);
                    float nD = pp_pe(cc, kd, pp_pk(cc + vec2(0.0, 1.0)), 0.0);
                    if (kd < 0.5 && nU > 0.5 && nD > 0.5) { pOn = 1.0; pLat = lat; pId = colC; pDir = 0.0; pA = S.y / wC; pBus = max(nU, nD); }
                }
            }
        }
        if (pOn > 0.5) {
            float Pw = 0.075 * wC;
            float hwp = 0.85 * wsc;
            vec2 pq = vec2(pAl, pLat);
            float L1 = 12.0 * wsc;
            float dg = 6.0 * wsc;
            float sg = pp_h(vec2(pId, seed * 3.0 + 1.7)) < 0.5 ? -1.0 : 1.0;
            vec2 e2 = vec2(L1 + dg, sg * dg);
            vec2 s1 = pp_seg(pq, vec2(0.0), vec2(L1, 0.0));
            vec2 s2 = pp_seg(pq, vec2(L1, 0.0), e2);
            float dT = min(s1.x, s2.x);
            float cv = pp_aa(dT, hwp);
            if (pBus > 2.0) cv = max(cv, pp_aa(abs(dT - Pw), hwp));
            float padR = length(pq - e2);
            prtAu = max(pp_aa(abs(padR - 2.7 * wsc), 0.8 * wsc), pp_box(pq - vec2(3.0 * wsc, 0.0), vec2(3.0 * wsc, (pBus > 2.0 ? Pw + 2.6 * wsc : 3.4 * wsc))));
            prtHole = pp_aa(padR, 1.3 * wsc);
            prtCu = cv;
            float wkp = smoothstep(300.0 * wsc, 30.0 * wsc, length(S - mouse));
            float fp = pp_cp(pA, pId, pDir, time, wkp);
            float halo = exp(-dT * dT / (3.4 * wsc * 3.4 * wsc));
            prtLit = fp * (cv + 0.5 * halo + 0.9 * prtAu);
        }
    }

    float gate = vis * (0.2 + 0.8 * edgeFade);
    float gateC = (0.6 + 0.4 * dark) * (0.50 + 0.50 * act) * min(k, 1.0);
    float gateD = dark * dark * (0.40 + 0.60 * act) * k;

    // copper darkens on light content, and runs hotter near the pointer
    float lightK = smoothstep(0.5, 0.9, lum);
    vec3 cuCol = mix(copper, vec3(0.50, 0.27, 0.10), lightK);
    cuCol = mix(cuCol, gold, clamp(heat * 0.65 + ignite * 0.7, 0.0, 0.85));
    float cuAll = max(cuA, stubA * 0.92 * (0.25 + 0.75 * dark));
    c = mix(c, vec3(0.0, 0.01, 0.006), cuAll * 0.25 * gate);
    c = mix(c, cuCol, cuAll * (0.88 + 0.12 * heat) * gate);
    c = mix(c, gold, auA * 0.9 * min(gate * 1.3, 1.0));
    c = mix(c, vec3(0.01, 0.015, 0.012), holeA * 0.85 * min(gate * 1.3, 1.0));

    // board dots, twinkling ones in gold
    c = mix(c, copper * 0.9, dotA * 0.38 * gateD * (1.0 + 1.5 * heat));
    c += gold * dotA * dotTw * 0.9 * gateD;

    // pulses: amber body, cold white core. Hotter near the pointer and when the scan passes
    float boost = 1.0 + 0.9 * heat + 1.2 * ignite;
    float pl = clamp((pulseA + stubLit) * boost, 0.0, 1.5);
    c += (amber * pl + cold * pl * pl * 0.75) * (0.12 + 0.88 * dark) * (1.0 - 0.8 * lightK) * gate * 1.15;
    c = mix(c, vec3(0.80, 0.30, 0.02), clamp(pl, 0.0, 1.0) * lightK * 0.75 * gate);
    // the lit lanes catch the scan: a brief wash of white on the copper
    c += cold * cuAll * ignite * 0.55 * gate;

    // chips
    c = mix(c, vec3(0.020, 0.026, 0.024), chipBody * 0.92 * (0.6 + 0.4 * dark) * min(k, 1.0));
    c = mix(c, gold, chipA * 0.95 * gateC);
    c = mix(c, gold, padA * 0.6 * gateC);
    vec3 ledCol = (mod(cidv, 2.0) < 0.5) ? vec3(0.25, 1.0, 0.55) : vec3(1.0, 0.55, 0.15);
    c = mix(c, ledCol, ledA * ledC * min(1.2 * gateC, 1.0));
    c += ledCol * ledA * ledC * 0.4 * gateC;
    c += amber * padLit * gateC + cold * padLit * padLit * 0.5 * gateC;

    // the board link
    float gateP = (0.55 + 0.45 * dark) * (0.45 + 0.55 * act) * min(k, 1.0);
    c = mix(c, vec3(0.0, 0.01, 0.006), prtCu * 0.30 * gateP);
    c = mix(c, cuCol, prtCu * 0.92 * gateP);
    c = mix(c, gold, prtAu * 0.92 * gateP);
    c = mix(c, vec3(0.01, 0.015, 0.012), prtHole * 0.85 * gateP);
    float pLt = clamp(prtLit * (1.0 + 0.9 * heat + 1.2 * ignite), 0.0, 1.5);
    c += (amber * pLt + cold * pLt * pLt * 0.75) * (0.12 + 0.88 * dark) * (1.0 - 0.8 * lightK) * gateP * 1.2;
    c = mix(c, vec3(0.80, 0.30, 0.02), clamp(pLt, 0.0, 1.0) * lightK * 0.7 * gateP);

    // the scan line: crisp across the margins, only a ghost over dark content in the middle, and a soft trail above it
    float scanAmt = scanLine * (0.25 * dark + 0.9 * edgeNear * (0.4 + 0.6 * dark)) + scanTrail * 0.035 * dark * (0.3 + 0.7 * edgeFade);
    c += vec3(0.55, 0.95, 0.85) * scanAmt * k;

    // inactive windows sit back a little
    c = mix(c * vec3(0.95, 0.98, 0.96), c, act);

    fragColor = vec4(clamp(c, 0.0, 1.0), a);
}
