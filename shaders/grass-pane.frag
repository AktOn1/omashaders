#version 300 es
// target: window
// category: Nature
// desc: Grass pane: a tall dense lawn of curved, tapered blades in several greens grows along the bottom of every window with clover, daisies, buttercups and poppies on swaying stems; a travelling wind wave bends the blades and runs a light sheen over the tips, blades lean away from the pointer and spring back, leafy vines with little blossoms creep slowly up the side edges, fireflies drift and blink above the lawn and dew glints sparkle; the focused window is greener, taller and livelier, and body text stays clear (animated)
// strength: 70
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

float gp_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float gp_aa(float d) { return clamp(0.5 - d, 0.0, 1.0); }
float gp_vn(float x) {
    float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(gp_h(vec2(i, 3.3)), gp_h(vec2(i + 1.0, 3.3)), f);
}

// travelling wind: a gust that rolls along the edge (0..1) and the sway it causes
float gp_gust(float x, float sd) {
    float g = 0.5 + 0.5 * sin(x * 0.0062 - time * 1.05 + sd * 6.0 + 0.8 * sin(x * 0.0021 - time * 0.3));
    return g * g * (0.6 + 0.4 * sin(x * 0.0017 - time * 0.37 + sd * 2.0));
}
float gp_sway(float x, float H, float amp, float sd) {
    float w = sin(x * 0.0105 - time * 1.9 + sd * 6.0) + 0.5 * sin(x * 0.027 - time * 3.1 + sd * 3.0 + 1.7);
    return (w * 0.55 + gp_gust(x, sd) * 1.35) * amp * H * 0.21;
}

// one layer of blades along an edge. a = distance from the edge (inwards), x = position along the edge.
// e0/ed = the edge base point at x = 0 and the direction of x in window pixels, pm = pointer in window pixels
vec3 gp_blades(vec3 c, float a, float x, float cellW, float hMin, float hMax, float w0, float dens, float salt,
               vec3 cBase, vec3 cTip, float amp, float lit, float sc, vec2 e0, vec2 ed, vec2 en, vec2 pm, float over, float sd) {
    float i0 = floor(x / cellW);
    for (int i = -3; i <= 3; i++) {
        float id = i0 + float(i);
        vec2 hc = vec2(id, salt + sd * 7.0);
        float h1 = gp_h(hc);
        if (h1 > dens) continue;
        float h2 = gp_h(hc + 3.1);
        float h3 = gp_h(hc + 7.7);
        float h4 = gp_h(hc + 11.3);
        float bx = (id + 0.15 + 0.7 * h2) * cellW;
        float clump = 0.72 + 0.50 * gp_vn(bx / (34.0 * sc) + salt * 5.1 + sd * 11.0);
        float H = mix(hMin, hMax, h3 * h3 * (3.0 - 2.0 * h3)) * sc * clump;
        if (a < 0.0 || a > H + 1.0) continue;
        // lean away from the pointer, measured at mid height, and get pressed down a little; a quick wobble makes it spring
        vec2 bp = e0 + ed * bx;
        vec2 dp = bp + en * H * 0.55 - pm;
        float push = exp(-dot(dp, dp) / (2.0 * 120.0 * sc * 120.0 * sc)) * over;
        float wob = 1.0 + 0.22 * sin(time * 8.0 + bx * 0.11 + h2 * 6.0) * push;
        H *= 1.0 - 0.18 * push;
        float s = a / H;
        float L = (h2 * 2.0 - 1.0) * 0.27 * H + gp_sway(bx, H, amp, sd);
        L += clamp(dot(dp, ed) / (28.0 * sc), -1.0, 1.0) * push * wob * H * 0.62;
        float curve = s * s;
        float lit2 = lit + 0.5 * push;
        float sheen = gp_gust(bx, sd);
        float cross = x - (bx + L * curve);
        float hw = w0 * sc * (1.0 - pow(s, 1.7));
        float slope = 2.0 * L * s / H;
        float d = (abs(cross) - hw) / sqrt(1.0 + slope * slope);
        float cov = gp_aa(d) * smoothstep(H + 1.0, H - 0.5, a);
        if (cov <= 0.002) continue;
        float t = cross / max(hw, 0.35);
        vec3 g = mix(cBase, cTip, smoothstep(0.0, 1.0, s));
        g *= vec3(0.86 + 0.28 * h4, 0.95 + 0.10 * h1, 0.80 + 0.40 * h2);
        // face shading: the lit side leans towards the sun at the right, the other side falls into shade
        g *= 0.72 + 0.34 * clamp(t * 0.5 + 0.5, 0.0, 1.0) * (0.6 + 0.4 * lit2);
        // pale mid-vein
        g += vec3(0.05, 0.08, 0.02) * exp(-t * t * 9.0) * smoothstep(1.2 * sc, 2.4 * sc, hw);
        // rooted in shade
        g *= 0.30 + 0.70 * smoothstep(0.0, 0.50, s);
        // sunlit rim and golden tip
        g += vec3(1.00, 0.84, 0.38) * lit2 * smoothstep(0.35, 1.0, t) * (0.12 + 0.62 * s);
        // the gust rolls a pale sheen over the blades as they bend
        g += vec3(0.22, 0.30, 0.06) * sheen * smoothstep(0.25, 1.0, s) * (0.6 + 0.6 * lit);
        g = mix(g, vec3(0.92, 0.88, 0.36), smoothstep(0.72, 1.0, s) * 0.45 * lit2);
        // dew drops on some blades
        if (h4 > 0.74) {
            float sd0 = 0.30 + 0.35 * h1;
            vec2 dd = vec2(x - (bx + L * sd0 * sd0), a - sd0 * H);
            float tw = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(time * (0.7 + 0.8 * h2) + h3 * 40.0), 3.0);
            g += vec3(0.95, 1.0, 1.0) * exp(-dot(dd, dd) / (1.0 * sc * 1.0 * sc)) * tw * 1.3;
            g *= 1.0 - 0.18 * smoothstep(2.3 * sc, 1.0 * sc, length(dd));
        }
        c = mix(c, g, cov);
    }
    return c;
}

// flowers and clover rooted at the bottom edge; x along the bottom, a = height above the bottom
vec3 gp_flowers(vec3 c, float a, float x, float sc, float amp, float lit, float sd, float act, vec2 pm, float over, float ey) {
    float cell = 66.0 * sc;
    float i0 = floor(x / cell);
    for (int i = -1; i <= 1; i++) {
        float id = i0 + float(i);
        vec2 hc = vec2(id, 31.7 + sd * 5.0);
        float h1 = gp_h(hc);
        if (h1 > 0.54) continue;
        float h2 = gp_h(hc + 2.3);
        float h3 = gp_h(hc + 5.9);
        float h4 = gp_h(hc + 9.1);
        float fx = (id + 0.2 + 0.6 * h2) * cell;
        float Hs = (46.0 + 30.0 * h3) * sc;
        vec2 fdp = vec2(fx, ey - Hs * 0.7) - pm;
        float fpush = exp(-dot(fdp, fdp) / (2.0 * 120.0 * sc * 120.0 * sc)) * over;
        float L = gp_sway(fx, Hs, amp, sd) + (h4 * 2.0 - 1.0) * 0.18 * Hs
                + clamp(fdp.x / (28.0 * sc), -1.0, 1.0) * fpush * Hs * 0.5 * (1.0 + 0.2 * sin(time * 8.0 + fx));
        if (a > Hs + 11.0 * sc) continue;
        float s = clamp(a / Hs, 0.0, 1.0);
        // stem
        float cr = x - (fx + L * s * s);
        float stem = gp_aa(abs(cr) - 0.85 * sc) * step(a, Hs);
        c = mix(c, vec3(0.13, 0.38, 0.10) * (0.35 + 0.65 * smoothstep(0.0, 0.5, s)), stem);
        // head
        vec2 hd = vec2(x - (fx + L), a - Hs);
        float R = (5.6 + 1.8 * h3) * sc;
        float rd = length(hd);
        if (rd > R + 2.0) continue;
        float th = atan(hd.y, hd.x);
        c *= 1.0 - 0.30 * smoothstep(R + 2.2 * sc, R * 0.6, rd);
        float kind = gp_h(hc + 13.7);
        vec3 hc3;
        float cover;
        if (kind < 0.50) {
            // daisy: eight white petals around a golden eye
            float rr = R * (0.80 + 0.20 * pow(abs(cos(4.0 * th + h2 * 3.0)), 0.8));
            cover = gp_aa(rd - rr);
            hc3 = mix(vec3(0.80, 0.86, 0.92), vec3(1.00, 0.99, 0.95), smoothstep(0.30 * R, 0.95 * R, rd));
            hc3 *= 0.86 + 0.20 * lit * smoothstep(-R, R, hd.x * 0.7 + hd.y * 0.7);
            float eye = gp_aa(rd - 0.36 * R);
            hc3 = mix(hc3, vec3(1.0, 0.76, 0.12) * (0.78 + 0.3 * smoothstep(-0.3 * R, 0.3 * R, hd.x + hd.y)), eye);
        } else if (kind < 0.90) {
            // buttercup: a glossy yellow cup of five lobes
            float rr = R * (0.88 + 0.12 * cos(5.0 * th + h2 * 6.0));
            cover = gp_aa(rd - rr);
            hc3 = mix(vec3(0.92, 0.66, 0.05), vec3(1.0, 0.88, 0.16), smoothstep(0.0, 0.8 * R, rd));
            hc3 += vec3(0.30, 0.25, 0.05) * exp(-dot(hd - vec2(0.3 * R, 0.3 * R), hd - vec2(0.3 * R, 0.3 * R)) / (0.5 * R * R)) * lit;
        } else {
            // poppy: four crumpled red petals, dark heart
            float rr = R * (1.02 + 0.10 * cos(4.0 * th + h2 * 6.0));
            cover = gp_aa(rd - rr);
            hc3 = mix(vec3(0.62, 0.05, 0.05), vec3(0.95, 0.16, 0.10), smoothstep(0.1 * R, 0.9 * R, rd));
            hc3 = mix(hc3, vec3(0.08, 0.05, 0.05), gp_aa(rd - 0.26 * R));
            hc3 += vec3(0.35, 0.10, 0.04) * lit * smoothstep(0.0, R, hd.x * 0.6 + hd.y * 0.6) * 0.5;
        }
        c = mix(c, hc3, cover * (0.55 + 0.45 * act));
    }

    // clover: a thin stalk with three round leaves, each with a pale chevron
    float cell2 = 47.0 * sc;
    float j0 = floor(x / cell2);
    for (int j = -1; j <= 1; j++) {
        float id = j0 + float(j);
        vec2 hc = vec2(id, 71.3 + sd * 9.0);
        if (gp_h(hc) > 0.50) continue;
        float h2 = gp_h(hc + 1.7);
        float h3 = gp_h(hc + 4.1);
        float cx0 = (id + 0.15 + 0.7 * h2) * cell2;
        float Hc = (20.0 + 12.0 * h3) * sc;
        float L = gp_sway(cx0, Hc, amp, sd) * 0.8;
        float s = clamp(a / Hc, 0.0, 1.0);
        float cr = x - (cx0 + L * s * s);
        c = mix(c, vec3(0.12, 0.34, 0.09), gp_aa(abs(cr) - 0.65 * sc) * step(a, Hc));
        vec2 cp = vec2(cx0 + L, Hc);
        float rl = (4.6 + 1.0 * h3) * sc;
        for (int k = 0; k < 3; k++) {
            vec2 off = k == 0 ? vec2(-0.92, 0.28) : (k == 1 ? vec2(0.92, 0.28) : vec2(0.0, 0.95));
            vec2 lp = cp + off * rl * 1.05;
            vec2 dl = vec2(x, a) - lp;
            float cov = gp_aa(length(dl) - rl);
            if (cov <= 0.0) continue;
            vec3 lc = mix(vec3(0.10, 0.36, 0.10), vec3(0.28, 0.62, 0.20), smoothstep(-rl, rl, dl.y * 0.7 + dl.x * 0.7));
            // pale chevron across the leaf, pointing at the stalk
            vec2 dir = normalize(vec2(-off.x, -off.y + 0.001));
            float along = dot(dl, dir);
            float perp = abs(dot(dl, vec2(-dir.y, dir.x)));
            float chev = gp_aa(abs(along * 0.8 + perp * 0.7 - 0.25 * rl) - 0.45 * sc) * smoothstep(rl, 0.4 * rl, length(dl));
            lc = mix(lc, vec3(0.62, 0.82, 0.55), chev * 0.55);
            lc += vec3(1.0, 0.85, 0.40) * lit * 0.14 * smoothstep(0.0, rl, dl.x * 0.5 + dl.y * 0.9);
            c = mix(c, lc, cov);
        }
    }
    return c;
}

// a creeping vine along a side edge: d = distance from that edge, u = height above the bottom, grows slowly upwards then fades and starts again
vec3 gp_vine(vec3 c, float d, float u, float H, float sc, float sd, float act, float ph0, vec3 leafA, vec3 leafB) {
    float ph = fract(time / 70.0 + ph0);
    float front = ph * H * 1.12;
    if (u > front + 8.0 * sc) return c;
    float fade = smoothstep(1.0, 0.86, ph) * smoothstep(0.0, 0.03, ph);
    float grow = smoothstep(front + 8.0 * sc, front - 30.0 * sc, u);       // young growth is thinner and smaller
    float xs = (7.0 + 3.5 * sin(u * 0.043 + sd * 6.0 + ph0 * 9.0 + time * 0.30)) * sc;
    float n0 = floor(u / (30.0 * sc));
    for (int i = -1; i <= 1; i++) {
        float n = n0 + float(i);
        float h1 = gp_h(vec2(n, ph0 * 17.0 + sd * 3.0));
        float un = (n + 0.25 + 0.5 * h1) * 30.0 * sc;
        if (un > front) continue;
        float lg = smoothstep(front, front - 26.0 * sc, un);
        float xn = (7.0 + 3.5 * sin(un * 0.043 + sd * 6.0 + ph0 * 9.0 + time * 0.30)) * sc;
        float th = 0.55 + 0.45 * h1 + 0.28 * sin(time * 1.25 + n * 2.1 + sd * 5.0 + ph0 * 4.0);
        vec2 dir = vec2(cos(th), sin(th));                                     // inwards and upwards
        vec2 q = vec2(d - xn, u - un);
        float Ll = (7.0 + 5.0 * h1) * sc * lg;
        float Wl = Ll * 0.46;
        float ax = dot(q, dir);
        float pr = dot(q, vec2(-dir.y, dir.x));
        float e = length(vec2((ax - Ll) / max(Ll, 0.5), pr / max(Wl, 0.5)));
        float cov = gp_aa((e - 1.0) * Wl) * fade;
        if (cov > 0.002) {
            vec3 lc = mix(leafA, leafB, smoothstep(-Wl, Wl, pr) * 0.7 + 0.3 * smoothstep(0.0, 2.0 * Ll, ax));
            lc += vec3(0.07, 0.10, 0.02) * exp(-pr * pr / (0.5 * sc * sc + 0.2));
            lc *= 0.8 + 0.3 * act;
            c = mix(c, lc, cov * 0.95);
        }
        // a little blossom on every third node
        if (h1 > 0.62) {
            vec2 bq = vec2(d - xn - 2.0 * sc * sin(time * 1.1 + n), u - un - 4.0 * sc);
            float br = (2.8 + 1.2 * h1) * sc * lg;
            float rr = length(bq);
            float bc = gp_aa(rr - br * (0.85 + 0.25 * cos(5.0 * atan(bq.y, bq.x)))) * fade;
            vec3 bl = h1 > 0.81 ? vec3(0.98, 0.93, 0.98) : vec3(0.90, 0.52, 0.80);
            bl = mix(bl, vec3(1.0, 0.85, 0.25), gp_aa(rr - 0.38 * br));
            c = mix(c, bl * (0.8 + 0.25 * act), bc * 0.95);
        }
    }
    float dm = gp_aa(abs(d - xs) - (0.5 + 1.0 * grow) * 1.2 * sc) * fade;
    c = mix(c, leafA * 0.75, dm);
    // the growing tip: a pale bud
    float tip = length(vec2(d - xs, u - front)) ;
    c = mix(c, vec3(0.66, 0.90, 0.40), gp_aa(tip - 2.2 * sc) * fade);
    return c;
}

// fireflies drifting above the lawn: slow wandering, a soft blink, they shy away from the pointer
vec3 gp_flies(vec3 c, vec2 px, vec2 size, float sc, float act, float sd, vec2 pm, float over, float lum) {
    float vis = 0.55 + 0.45 * act;
    vec3 acc = vec3(0.0);
    float core = 0.0;
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        float h1 = gp_h(vec2(fi, sd * 13.0 + 1.0));
        float h2 = gp_h(vec2(fi + 9.0, sd * 13.0));
        float h3 = gp_h(vec2(fi + 21.0, sd * 13.0 + 4.0));
        vec2 pos = vec2(h1 * size.x, size.y * (1.0 - 0.10 - 0.30 * h2) - 14.0 * sc);
        pos.x += 46.0 * sc * sin(time * (0.18 + 0.12 * h3) + fi * 2.1) + 16.0 * sc * sin(time * 0.61 + fi * 5.0);
        pos.y += 30.0 * sc * sin(time * (0.15 + 0.12 * h1) + fi * 1.3) + 9.0 * sc * sin(time * 0.83 + fi * 3.0);
        vec2 away = pos - pm;
        pos += normalize(away + 0.001) * 55.0 * sc * over * exp(-dot(away, away) / (2.0 * 90.0 * sc * 90.0 * sc));
        vec2 dd = px - pos;
        float d2 = dot(dd, dd);
        if (d2 > 900.0 * sc * sc) continue;
        float b = pow(0.5 + 0.5 * sin(time * (0.55 + 0.5 * h3) + fi * 3.7 + sd * 9.0), 3.0);
        float r = 1.0 * sc;
        float glw = exp(-d2 / (2.0 * 10.0 * sc * 10.0 * sc)) * 0.6 + exp(-d2 / (r * r * 1.6)) * 0.9;
        acc += vec3(0.78, 1.0, 0.30) * glw * b;
        core += exp(-d2 / (r * r * 1.4)) * b;
    }
    if (acc.g < 0.002) return c;
    // light context (a light window, or text on one) gets no glow: look a few pixels around for bright pixels
    vec2 t1 = 9.0 * sc / size;
    float lm = max(max(lum, dot(texture(tex, v_texcoord + vec2(t1.x, 0.0)).rgb, vec3(0.2126, 0.7152, 0.0722))),
                   max(dot(texture(tex, v_texcoord - vec2(t1.x, 0.0)).rgb, vec3(0.2126, 0.7152, 0.0722)),
                       dot(texture(tex, v_texcoord + vec2(0.0, t1.y)).rgb, vec3(0.2126, 0.7152, 0.0722))));
    float gate = 1.0 - smoothstep(0.30, 0.55, lm);
    c = c + (1.0 - c) * clamp(acc * 1.5 * vis * gate, 0.0, 1.0);
    c = mix(c, vec3(1.0, 1.0, 0.62), clamp(core * 0.8 * vis, 0.0, 1.0) * gate);
    return c;
}

void main() {
    vec4 s = texture(tex, v_texcoord);
    float a = s.a;
    vec3 c = s.rgb / max(a, 0.001);
    float k = min(STRENGTH / 0.70, 1.3);
    float act = is_active;
    vec2 size = surface_size;
    vec2 px = v_texcoord * size;
    float sc = clamp(size.y / 1080.0, 0.92, 1.3);

    float eb = size.y - px.y;      // above the bottom edge
    float et = px.y;               // below the top edge
    float el = px.x;
    float er = size.x - px.x;
    float lum0 = dot(c, vec3(0.2126, 0.7152, 0.0722));

    float amp = 0.85 + 0.65 * act;
    float grow = (0.78 + 0.22 * act) * (0.35 + 0.65 * min(k, 1.0));
    float sd = seed;
    float lit = 0.55 + 0.45 * act;
    vec2 pm = mouse - window_box.xy;
    float over = smoothstep(-80.0, 0.0, pm.x) * smoothstep(size.x + 80.0, size.x, pm.x)
               * smoothstep(-80.0, 0.0, pm.y) * smoothstep(size.y + 80.0, size.y, pm.y);

    // the greens: the focused window is fresher, a sitting window a little greyer
    float gm = 0.80 + 0.20 * act;
    vec3 darkG = vec3(0.045, 0.16, 0.06) * gm;
    vec3 midG = vec3(0.12, 0.40, 0.11) * gm;
    vec3 liteG = vec3(0.30, 0.68, 0.16) * gm;
    vec3 tipG = vec3(0.50, 0.82, 0.24) * gm;
    vec2 eB = vec2(0.0, size.y);

    // fireflies in the lower part of the window (before the grass so blades pass in front)
    if (eb < 0.42 * size.y) {
        c = gp_flies(c, px, size, sc, act, sd, pm, over, lum0);
    }

    // soft shade where the lawn stands, so blades read on light windows too
    float shade = smoothstep(70.0 * sc * k, 0.0, eb);
    c *= 1.0 - 0.30 * shade;
    c += vec3(0.0, 0.025, 0.0) * shade;

    // bottom lawn: four layers back to front, with flowers and clover standing between them
    if (eb < 100.0 * sc * k) {
        vec2 up = vec2(0.0, -1.0);
        c = gp_blades(c, eb, px.x, 11.0, 38.0 * grow, 86.0 * grow, 2.3, 0.90, 1.0, darkG * 0.8, midG * 0.9, amp * 0.8, lit * 0.5, sc, eB, vec2(1.0, 0.0), up, pm, over, sd);
        c = gp_flowers(c, eb, px.x, sc * grow, amp, lit, sd, act, pm, over, size.y);
        c = gp_blades(c, eb, px.x, 9.0, 26.0 * grow, 60.0 * grow, 2.2, 0.95, 2.0, midG * 0.85, liteG, amp, lit * 0.8, sc, eB, vec2(1.0, 0.0), up, pm, over, sd);
        c = gp_blades(c, eb, px.x, 8.0, 18.0 * grow, 42.0 * grow, 2.0, 0.95, 3.0, midG * 1.1, tipG, amp * 1.1, lit, sc, eB, vec2(1.0, 0.0), up, pm, over, sd);
        // dark ground the blades grow from
        c = mix(c, darkG * 0.55, smoothstep(2.6 * sc, 0.4 * sc, eb));
    }

    // sparse tufts hanging from the top edge
    if (et < 50.0 * sc * k) {
        c = gp_blades(c, et, px.x, 13.0, 12.0 * grow, 34.0 * grow, 1.8, 0.55, 5.0, midG * 0.7, liteG, amp * 0.8, lit * 0.4, sc, vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.0), pm, over, sd + 0.31);
    }
    // tufts creeping in from the sides, and slowly growing vines with leaves and blossoms
    if (el < 42.0 * sc * k) {
        c = gp_blades(c, el, px.y, 26.0, 9.0 * grow, 24.0 * grow, 1.7, 0.30, 8.0, midG * 0.7, liteG, amp * 0.7, lit * 0.4, sc, vec2(0.0, 0.0), vec2(0.0, 1.0), vec2(1.0, 0.0), pm, over, sd + 0.57);
        c = gp_vine(c, el, eb, size.y, sc, sd, act, fract(sd * 3.1), midG * 0.9, liteG * 0.95);
    }
    if (er < 42.0 * sc * k) {
        c = gp_blades(c, er, px.y, 26.0, 9.0 * grow, 24.0 * grow, 1.7, 0.30, 9.0, midG * 0.7, liteG, amp * 0.7, lit * 0.4, sc, vec2(size.x, 0.0), vec2(0.0, 1.0), vec2(-1.0, 0.0), pm, over, sd + 0.83);
        c = gp_vine(c, er, eb, size.y, sc, sd + 0.4, act, fract(sd * 3.1 + 0.55), midG * 0.9, liteG * 0.95);
    }

    fragColor = vec4(clamp(c, 0.0, 1.0), a);
}
