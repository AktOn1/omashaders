#version 300 es
// target: window
// category: Retro
// desc: Bevel pane: every window becomes a mid-nineties desktop window with a thick grey 3D frame, a navy to blue title strip with tiny pixel title text and minimise, maximise and close boxes (the close box turns red as the pointer nears it, the strip goes grey when the window is not focused), a marching-ants dotted focus rectangle running around the focused window, a sand timer in the bottom corner that drains and turns over, a dithered teal glow around the pointer, 8-bit dither shading near the edges and now and then a quick redraw smear sweeping down the window. Body text stays clear (animated)
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

float bp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float bp_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// 4x4 Bayer threshold in 0..1
float bp_bayer(vec2 ip) {
    int x = int(mod(ip.x, 4.0));
    int y = int(mod(ip.y, 4.0));
    int i = x ^ y;
    int idx = ((i & 1) << 3) | ((y & 1) << 2) | (i & 2) | ((y & 2) >> 1);
    return (float(idx) + 0.5) / 16.0;
}

// premultiplied sample un-premultiplied, uv clamped
vec3 bp_tap(vec2 uv) {
    vec4 t = texture(tex, clamp(uv, vec2(0.001), vec2(0.999)));
    return t.rgb / max(t.a, 0.001);
}

// raised grey box with a 1 unit bevel; l = local px inside the box, bs = box size
vec3 bp_box(vec2 l, vec2 bs, float u, vec3 base) {
    vec3 c = base;
    float tl = min(l.x, l.y);
    float br = min(bs.x - 1.0 - l.x, bs.y - 1.0 - l.y);
    if (tl < u) c = vec3(1.0);
    if (br < u) c = vec3(0.03);
    if (tl >= u && tl < 2.0 * u && br >= 2.0 * u) c = vec3(0.88);
    if (br >= u && br < 2.0 * u && tl >= u) c = vec3(0.5);
    return c;
}

// one cell of the sand timer sprite (9 x 13 cells): returns rgba, a = 0 outside
vec4 bp_glass(vec2 q, float phase, float tm) {
    float cx = floor(q.x);
    float cy = floor(q.y);
    if (cx < 0.0 || cx > 8.0 || cy < 0.0 || cy > 12.0) return vec4(0.0);
    float dx = abs(cx - 4.0);
    if (cy < 0.5 || cy > 11.5) return vec4(0.12, 0.12, 0.16, 1.0);           // caps
    float hw = floor(0.5 + 3.0 * abs(cy - 6.0) / 5.0);
    if (dx > hw) return vec4(0.0);
    float ly = 12.0 - 5.0 * phase;                                            // lower sand surface
    float yu = 1.0 + 5.0 * phase;                                             // upper sand surface
    vec3 sand = vec3(1.0, 0.82, 0.08);
    if (dx > hw - 0.5 && cy != 6.0) return vec4(0.05, 0.05, 0.10, 1.0);      // glass wall
    if (cy < 6.0) {
        if (cy >= yu && phase < 0.999) return vec4(sand, 1.0);
        return vec4(0.78, 0.94, 1.0, 1.0);
    }
    if (cy > 6.0) {
        if (cy >= ly - 0.01 && phase > 0.001) return vec4(sand * (0.9 + 0.1 * step(0.5, fract(cx * 0.5 + cy * 0.37))), 1.0);
        if (dx == 0.0 && phase > 0.001 && phase < 0.999 && cy < ly) {
            return vec4(mix(sand, vec3(0.78, 0.94, 1.0), step(0.5, fract(cy * 0.5 - tm * 7.0))), 1.0);   // falling stream
        }
        return vec4(0.78, 0.94, 1.0, 1.0);
    }
    // neck row
    if (phase > 0.001 && phase < 0.999) return vec4(sand, 1.0);
    return vec4(0.05, 0.05, 0.10, 1.0);
}

void main() {
    vec4 s = texture(tex, v_texcoord);
    float a = s.a;
    float k = STRENGTH / 0.55;
    float kk = clamp(k, 0.0, 1.0);
    float act = is_active;
    vec2 size = max(surface_size, vec2(1.0));
    vec2 px = floor(v_texcoord * size);
    vec2 pf = v_texcoord * size;
    float sc = clamp(size.y / 560.0, 0.8, 2.0);
    float u = max(1.0, floor(sc + 0.5));                // one "pixel unit" of the chrome
    float W = size.x;
    float H = size.y;
    float bay = bp_bayer(px);

    // pointer in window pixels
    vec2 m = mouse - window_box.xy;
    float mIn = smoothstep(-40.0, 10.0, m.x) * smoothstep(W + 40.0, W - 10.0, m.x)
              * smoothstep(-40.0, 10.0, m.y) * smoothstep(H + 40.0, H - 10.0, m.y);

    // ---- redraw smear: a thin band sweeps down now and then, tears and ghosts the content sideways ----
    float cyc = 9.0 + 4.0 * fract(seed * 3.7);
    float gp = mod(time + seed * 13.0, cyc);
    float gt = gp / 1.1;
    vec2 uv = v_texcoord;
    vec3 c = s.rgb / max(a, 0.001);
    if (gt < 1.0) {
        float hb = clamp(36.0 * sc, 28.0, 40.0);
        float by = mix(-hb * 0.5, H + hb * 0.5, gt);
        float dy = abs(pf.y - by);
        if (dy < hb * 0.5) {
            float amp = mix(0.5, 1.0, act) * kk;
            float tq = floor(time * 18.0);
            float row = floor(pf.y / (3.0 * u));
            float tear = (bp_h(vec2(row, tq + seed * 9.0)) - 0.35) * 30.0 * u * amp;
            float edge = smoothstep(hb * 0.5, hb * 0.35, dy);
            vec3 c1 = bp_tap(uv + vec2(tear * edge, 0.0) / size);
            vec3 c2 = bp_tap(uv + vec2(-14.0 * u * amp * edge, 0.0) / size);
            c = mix(c, max(c1, c2 * 0.85), edge * 0.95);
            c = mix(c, c * vec3(0.8, 1.0, 1.0) + vec3(0.0, 0.05, 0.06), edge * 0.35 * amp);
        }
    }
    float lum = bp_luma(c);
    float dark = 1.0 - smoothstep(0.30, 0.85, lum);
    float text = smoothstep(0.50, 0.90, lum);
    float dEdge = min(min(pf.x, pf.y), min(W - pf.x, H - pf.y));
    float dm = length(pf - m) / sc;
    float halo = exp(-pow(dm / 85.0, 2.0)) * mIn;
    float fw = 6.0 * u;
    float th = 20.0 * u;
    float fall = 1.0 - smoothstep(fw, fw + 52.0 * sc, dEdge);
    // glyph guard: strong local contrast means text or a picture edge, leave it alone
    float tg = 1.0;
    if (fall > 0.02 || halo > 0.02) {
        vec2 o = vec2(2.0 * u, 0.0) / size;
        vec2 o2 = vec2(0.0, 2.0 * u) / size;
        float l1 = bp_luma(bp_tap(uv + o)), l2 = bp_luma(bp_tap(uv - o));
        float l3 = bp_luma(bp_tap(uv + o2)), l4 = bp_luma(bp_tap(uv - o2));
        float mx = max(max(l1, l2), max(l3, l4)), mn = min(min(l1, l2), min(l3, l4));
        tg = 1.0 - smoothstep(0.06, 0.22, max(mx - lum, lum - mn));
    }
    dark *= tg;
    text = max(text, 1.0 - tg);

    // ---- dither shading near the edges: reduced-colour look ----
    float lit = step(bay, fall * 1.05) * kk;
    vec3 teal = vec3(0.0, 0.50, 0.50);
    c = mix(c, c * 0.72, lit * (1.0 - dark) * (1.0 - 0.8 * text) * tg);
    c = mix(c, c + teal * 0.26, lit * dark * tg * (0.6 + 0.4 * act));

    // ---- pointer: dithered teal halo ----
    float hl = step(bay, halo * 1.15) * (0.6 + 0.45 * act) * kk;
    c = mix(c, c + teal * 0.34, hl * dark);
    c = mix(c, c * vec3(0.62, 0.88, 0.88), hl * (1.0 - dark) * (1.0 - 0.8 * text) * tg);

    // ---- marching-ants focus rectangle (focused window only), clockwise ----
    {
        float x0 = fw + 3.0 * u, x1 = W - fw - 3.0 * u;
        float y0 = fw + th + 3.0 * u, y1 = H - fw - 3.0 * u;
        vec2 ctr = vec2(0.5 * (x0 + x1), 0.5 * (y0 + y1));
        vec2 hs = vec2(0.5 * (x1 - x0), 0.5 * (y1 - y0));
        vec2 q = abs(px - ctr) - hs;
        float dd = max(q.x, q.y);
        if (dd > -u * 0.5 && dd < u * 0.5 + 0.01 && act > 0.01) {
            float sp;
            if (q.x > q.y) sp = (px.x > ctr.x) ? (x1 - x0) + (px.y - y0) : 2.0 * (x1 - x0) + (y1 - y0) + (y1 - px.y) + (x1 - x0) * 0.0;
            else sp = (px.y < ctr.y) ? (px.x - x0) : (x1 - x0) + (y1 - y0) + (x1 - px.x);
            float ph = fract(sp / (4.0 * u) - time * 1.6 - seed);
            float on = step(0.5, ph);
            float near = exp(-pow(length(px - m) / (140.0 * sc), 2.0)) * mIn;
            vec3 ink = (lum > 0.55) ? vec3(0.0, 0.1, 0.15) : vec3(0.85, 1.0, 1.0);
            c = mix(c, ink, on * act * kk * (0.85 + 0.15 * near));
        }
    }

    // ---- title strip ----
    float gx = clamp((pf.x - fw) / max(W - 2.0 * fw, 1.0), 0.0, 1.0);
    vec2 sp0 = vec2(fw, fw);
    vec2 sps = vec2(W - 2.0 * fw, th);
    vec2 sl = px - sp0;
    float inStrip = step(0.0, sl.x) * step(sl.x, sps.x - 1.0) * step(0.0, sl.y) * step(sl.y, sps.y - 1.0);

    // buttons (geometry in px)
    float bwd = 18.0 * u, bht = 16.0 * u, gap = 2.0 * u;
    float cx0 = W - fw - gap - bwd;
    float mx0 = cx0 - gap - bwd;
    float nx0 = mx0 - bwd;
    float by0 = fw + 2.0 * u;
    vec2 cClose = vec2(cx0 + 0.5 * bwd, by0 + 0.5 * bht);
    float dClose = length(m - cClose) / sc;
    float hv = smoothstep(110.0, 18.0, dClose) * mIn;           // near the close box
    float hvOn = smoothstep(0.55, 0.9, hv);
    float onStrip = smoothstep(th + 14.0 * sc, th - 4.0 * sc, abs(m.y - (fw + 0.5 * th)) ) * mIn;

    if (inStrip > 0.5) {
        // dithered gradient, slowly breathing
        float gg = clamp(gx * (1.0 + 0.10 * sin(time * 0.7 + seed * 6.0)), 0.0, 1.0);
        vec3 gA = mix(vec3(0.0, 0.0, 0.50), vec3(0.06, 0.52, 0.82), gg);
        vec3 gI = mix(vec3(0.50), vec3(0.76), gg);
        vec3 g = mix(gI, gA, act);
        g = floor(g * 7.0 + bay) / 7.0;                          // 8-bit style ordered dither
        // red wash near the close box as the pointer approaches
        float rw = smoothstep(120.0 * sc, 0.0, abs(px.x - cClose.x)) * hv * 0.55;
        g = mix(g, vec3(0.62, 0.05, 0.05), rw);
        // title text: 3x5 pixel glyphs of random bits, 2 px each
        float pu = max(1.0, floor(sc * 1.5 + 0.5));
        float tx = sl.x - (th + 4.0 * u);                          // after the little icon
        float ty = sl.y - 0.5 * (th - 5.0 * pu);
        if (tx >= 0.0 && ty >= 0.0 && ty < 5.0 * pu && tx < 24.0 * 4.0 * pu) {
            float ci = floor(tx / (4.0 * pu));
            float lx = floor((tx - ci * 4.0 * pu) / pu);
            float ly2 = floor(ty / pu);
            if (lx < 3.0 && mod(ci, 7.0) != 6.0 && ci < 10.0 + 8.0 * fract(seed * 5.3)) {
                int bits = int(bp_h(vec2(ci, 3.0 + floor(seed * 10.0))) * 32767.0);
                int bi = int(ly2) * 3 + int(lx);
                if (((bits >> bi) & 1) == 1) g = (act > 0.5) ? vec3(1.0) : vec3(0.82);
            }
        }
        // window icon: tiny teal bevel square with white cross
        vec2 il = sl - vec2(2.0 * u, 0.5 * (th - 12.0 * u));
        if (il.x >= 0.0 && il.y >= 0.0 && il.x < 12.0 * u && il.y < 12.0 * u) {
            vec3 ic = bp_box(il, vec2(12.0 * u), u, vec3(0.0, 0.55, 0.55));
            if (abs(il.x - 6.0 * u) < u || abs(il.y - 6.0 * u) < u) ic = vec3(0.95);
            g = ic;
        }
        c = mix(c, g, 0.96 * kk);
    }

    // buttons drawn over the strip
    {
        vec2 bl;
        // which button?
        float bx = 0.0;
        float which = 0.0;
        if (px.x >= nx0 && px.x < nx0 + bwd) { which = 1.0; bx = nx0; }
        else if (px.x >= mx0 && px.x < mx0 + bwd) { which = 2.0; bx = mx0; }
        else if (px.x >= cx0 && px.x < cx0 + bwd) { which = 3.0; bx = cx0; }
        bl = vec2(px.x - bx, px.y - by0);
        if (which > 0.5 && bl.y >= 0.0 && bl.y < bht) {
            vec3 base = vec3(0.75);
            if (which < 2.5) base = mix(base, vec3(0.88), onStrip * 0.7);
            if (which > 2.5) base = mix(base, vec3(0.85, 0.08, 0.08), hv);
            vec3 bc = bp_box(bl, vec2(bwd, bht), u, base);
            if (which > 2.5 && hvOn > 0.5) {                      // the close box looks pressed in
                bc = bp_box(bl - vec2(0.0), vec2(bwd, bht), u, base);
                if (bl.x < u || bl.y < u) bc = vec3(0.03);
            }
            vec2 gc = bl - 0.5 * vec2(bwd, bht);
            vec3 ink = (which > 2.5 && hv > 0.5) ? vec3(1.0) : vec3(0.0);
            float glyph = 0.0;
            if (which < 1.5) glyph = step(abs(gc.x), 4.0 * u) * step(abs(gc.y - 4.0 * u), 1.0 * u);              // minimise bar
            else if (which < 2.5) {                                                                             // maximise box
                float bxx = max(abs(gc.x), abs(gc.y + 0.5 * u));
                glyph = step(bxx, 4.0 * u) * step(3.0 * u - 0.01, max(abs(gc.x) * 1.0, abs(gc.y + 0.5 * u) * 1.1)) ;
                glyph = max(glyph, step(abs(gc.x), 4.0 * u) * step(abs(gc.y + 3.5 * u), 0.99 * u) * step(max(abs(gc.x), abs(gc.y + 0.5 * u)), 4.0 * u));
            } else {                                                                                            // close cross
                glyph = step(abs(abs(gc.x) - abs(gc.y)), 0.9 * u) * step(max(abs(gc.x), abs(gc.y)), 4.2 * u);
            }
            bc = mix(bc, ink, glyph);
            c = mix(c, bc, 0.97 * kk);
        }
    }

    // ---- thick grey 3D frame ----
    {
        float tlD = min(pf.x, pf.y);
        float brD = min(W - pf.x, H - pf.y);
        float dmin = min(tlD, brD);
        if (dmin < fw) {
            bool tlSide = tlD <= brD;
            float r = floor(dmin / u);
            vec3 fc = vec3(0.75);
            if (r < 0.5) fc = tlSide ? vec3(0.95) : vec3(0.03);
            else if (r < 1.5) fc = tlSide ? vec3(0.88) : vec3(0.5);
            else if (r < 2.5) fc = vec3(0.75);
            else if (r < 3.5) fc = vec3(0.75);
            else if (r < 4.5) fc = tlSide ? vec3(0.88) : vec3(0.5);
            else if (r < 5.5) fc = tlSide ? vec3(0.45) : vec3(0.95);
            else fc = tlSide ? vec3(0.03) : vec3(0.75);
            fc = mix(fc, vec3(bp_luma(fc)) * 0.92, 1.0 - act);
            // a touch of dither in the flat grey, like a dithered 16-colour grey
            if ((r > 1.5 && r < 2.5) || (r > 2.5 && r < 3.5)) fc += (bay - 0.5) * 0.04;
            c = mix(c, fc, 0.97 * kk);
        }
    }

    // ---- sand timer panel, bottom right ----
    {
        float cs = 2.0 * u;
        vec2 pbs = vec2(9.0 * cs + 6.0 * u, 13.0 * cs + 6.0 * u);
        vec2 p0 = vec2(W - fw - 6.0 * u - pbs.x, H - fw - 6.0 * u - pbs.y);
        vec2 pl = px - p0;
        if (pl.x >= 0.0 && pl.y >= 0.0 && pl.x < pbs.x && pl.y < pbs.y && W > 300.0 && H > 220.0) {
            vec3 pc = bp_box(pl, pbs, u, vec3(0.75));
            vec2 q = (pl - vec2(3.0 * u)) / cs;
            float cyc2 = 8.0;
            float tt = mod(time * mix(0.8, 1.0, act) + seed * 17.0, cyc2);
            float phase = tt < 6.6 ? tt / 6.6 : (tt < 7.6 ? 1.0 : 0.0);
            float th2 = (tt >= 6.6 && tt < 7.6) ? 3.14159265 * smoothstep(0.0, 1.0, tt - 6.6) : 0.0;
            vec2 qc = q - vec2(4.5, 6.5);
            float cs_ = cos(th2), sn_ = sin(th2);
            vec2 qr = vec2(cs_ * qc.x - sn_ * qc.y, sn_ * qc.x + cs_ * qc.y) + vec2(4.5, 6.5);
            vec4 gcl = bp_glass(qr, phase, time);
            if (gcl.a > 0.5) pc = mix(gcl.rgb, vec3(bp_luma(gcl.rgb)) * 0.9, (1.0 - act) * 0.7);
            c = mix(c, pc, 0.97 * kk);
        }
    }

    // inactive windows sit back: a touch greyer
    c = mix(mix(vec3(bp_luma(c)), c, 0.88), c, act);

    fragColor = vec4(clamp(c, 0.0, 1.0), a);
}
