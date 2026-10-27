#version 300 es
// target: window
// category: Light
// desc: Chat pane: a pink-to-cyan glint sweeps along the title edge, pixel hearts float up from the bottom like chat reactions and pop near the pointer, a neon heart pulses under the pointer with orbiting sparkles, a modem-handshake scanline band shimmers down the window now and then, and the focused window shows a breathing pink-cyan rim and a "typing..." bubble in its corner. Only background is tinted, so text stays clear (animated)
// strength: 60
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

float cp_h(float n) { return fract(sin(n * 127.1 + 31.7) * 43758.5453); }
float cp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// lay a colour over the picture: screen on dark windows (glows), plain mix on light ones (tints)
vec3 cp_lay(vec3 c, vec3 col, float amt, float bgL) {
    amt = clamp(amt, 0.0, 1.0);
    vec3 scr = c + (1.0 - c) * col * amt;
    vec3 mx = mix(c, col, amt * 0.75);
    return mix(scr, mx, smoothstep(0.35, 0.75, bgL));
}
// 7 x 6 bitmap heart (y 0 = top row)
float cp_heart(vec2 g) {
    if (g.x < 0.0 || g.x > 6.0 || g.y < 0.0 || g.y > 5.0) return 0.0;
    float ax = abs(g.x - 3.0);
    if (g.y < 0.5) return (ax > 0.5 && ax < 2.5) ? 1.0 : 0.0;
    if (g.y < 2.5) return 1.0;
    if (g.y < 3.5) return ax < 2.5 ? 1.0 : 0.0;
    if (g.y < 4.5) return ax < 1.5 ? 1.0 : 0.0;
    return ax < 0.5 ? 1.0 : 0.0;
}
// implicit heart, negative inside; u in units of heart radius, y up
float cp_hf(vec2 u) {
    float t = u.x * u.x + u.y * u.y - 1.0;
    float f = t * t * t - u.x * u.x * u.y * u.y * u.y;
    return f < 0.0 ? -pow(-f, 0.3333) : pow(f, 0.3333);
}
// four-point sparkle
float cp_star(vec2 d, float r) {
    d = abs(d);
    float a = exp(-(d.x * d.x / (r * r * 0.04) + d.y * d.y / (r * r)) * 2.0);
    float b = exp(-(d.y * d.y / (r * r * 0.04) + d.x * d.x / (r * r)) * 2.0);
    return max(a, b);
}

void main() {
    vec2 size = max(surface_size, vec2(1.0));
    vec2 px = v_texcoord * size;
    float sc = clamp(size.y / 700.0, 0.8, 1.8);
    float k = STRENGTH / 0.60;
    float act = is_active;
    float ph = seed;
    float ka = min(k, 1.5);

    vec3 pink = vec3(1.00, 0.30, 0.62);
    vec3 cyan = vec3(0.20, 0.92, 1.00);
    vec3 lav = vec3(0.74, 0.60, 1.00);
    vec3 wht = vec3(1.0, 0.94, 0.98);

    float dT = px.y;
    float dB = size.y - px.y;
    float dL = px.x;
    float dR = size.x - px.x;
    float dE = min(min(dL, dR), min(dT, dB));
    float side = min(dL, dR);

    // pointer in window pixels, and how much it is over the window
    vec2 mp = mouse - window_box.xy;
    vec2 pm = mp / max(window_box.zw, vec2(1.0));
    float over = smoothstep(-0.08, 0.02, pm.x) * smoothstep(1.08, 0.98, pm.x)
               * smoothstep(-0.08, 0.02, pm.y) * smoothstep(1.08, 0.98, pm.y);
    mp = pm * size;

    // modem handshake: a scanline band drops through the window every ~8 s
    float prog = fract(time / 8.0 + ph * 0.77);
    float run = clamp(prog / 0.42, 0.0, 1.0);
    float on = step(prog, 0.42);
    float hy = mix(-90.0 * sc, size.y + 90.0 * sc, run);
    float hd = px.y - hy;
    float hband = on * exp(-pow(max(-hd, 0.0) / (95.0 * sc), 2.0)) * exp(-pow(max(hd, 0.0) / (16.0 * sc), 2.0));
    float hlead = on * exp(-pow(hd / (3.0 * sc), 2.0));
    float marg = 1.0 - smoothstep(7.0 * sc, 20.0 * sc, side);
    float tq = floor(time * 20.0);
    float jit = (cp_h(floor(px.y / (2.0 * sc)) + tq * 1.7 + ph * 9.0) - 0.5) * 2.0;
    float shift = jit * hband * 12.0 * sc * marg * (0.5 + 0.5 * act) / size.x;
    float chroma = hband * marg * 5.0 * sc / size.x;

    vec4 s = texture(tex, v_texcoord + vec2(shift, 0.0));
    float a = s.a;
    vec3 c = s.rgb / max(a, 0.001);
    if (chroma > 0.0002) {
        c.r = texture(tex, v_texcoord + vec2(shift + chroma, 0.0)).r / max(a, 0.001);
        c.b = texture(tex, v_texcoord + vec2(shift - chroma, 0.0)).b / max(a, 0.001);
    }
    float lum = cp_luma(c);

    // what the window's own background looks like (median of three taps along the bottom), so effects never touch text
    float l1 = cp_luma(texture(tex, vec2(0.05, 0.965)).rgb);
    float l2 = cp_luma(texture(tex, vec2(0.50, 0.965)).rgb);
    float l3 = cp_luma(texture(tex, vec2(0.95, 0.965)).rgb);
    float bgL = max(min(l1, l2), min(max(l1, l2), l3));
    float bg = 1.0 - smoothstep(0.06, 0.20, abs(lum - bgL));
    float live = 0.55 + 0.45 * act;

    // handshake shimmer: fine pink/cyan scanlines inside the band, a bright leading line
    float sl = step(0.5, fract(px.y / (5.0 * sc)));
    vec3 slc = mix(cyan, pink, sl);
    c = cp_lay(c, slc, hband * 0.34 * k * live * (0.35 + 0.65 * bg), bgL);
    c = cp_lay(c, mix(cyan, wht, 0.5), hlead * 0.60 * ka * live * (0.4 + 0.6 * bg), bgL);

    // title glint: a slanted pink-cyan bar slides along the top edge, always on its way
    float gp = fract(time * 0.10 + ph);
    float gx = gp * (size.x + 420.0 * sc) - 210.0 * sc;
    float slant = px.x - dT * 1.2;
    float gd = slant - gx;
    float gbar = exp(-pow(gd / (110.0 * sc), 2.0));
    float gtop = exp(-dT / (30.0 * sc));
    vec3 gc = mix(pink, cyan, clamp(gd / (200.0 * sc) + 0.5, 0.0, 1.0));
    float gedge = exp(-pow(dT / (2.0 * sc), 2.0));
    float glow = gbar * (gtop * 0.75 + gedge * 0.6);
    // a faint standing title tint so the strip never goes quiet
    vec3 tint = mix(pink, cyan, clamp(px.x / size.x + 0.15 * sin(time * 0.6 + ph * 6.0), 0.0, 1.0));
    c = cp_lay(c, tint, exp(-dT / (7.0 * sc)) * 0.16 * k * live * (0.4 + 0.6 * bg), bgL);
    c = cp_lay(c, gc, glow * 0.85 * ka * live * (0.35 + 0.65 * bg), bgL);
    c = cp_lay(c, wht, gbar * gedge * 0.35 * ka * act, bgL);

    // pink-to-cyan rim, breathing; a soft inner glow that follows it
    float breath = 0.5 + 0.5 * sin(time * 1.5 + ph * 6.283);
    float rt = 0.5 + 0.5 * sin(6.2832 * (px.x + px.y) / (size.x + size.y) - time * 0.7 + ph * 6.0);
    vec3 rc = mix(pink, cyan, rt);
    float rimw = mix(1.5, 3.0, breath) * sc;
    float rim = exp(-pow(dE / rimw, 2.0));
    float inner = exp(-dE / ((28.0 + 22.0 * breath) * sc));
    float rimk = mix(0.18, 1.0, act);
    c = cp_lay(c, rc, rim * (0.45 + 0.4 * breath) * ka * rimk, bgL);
    c = cp_lay(c, rc, inner * (0.10 + 0.14 * breath) * k * rimk * (0.3 + 0.7 * bg), bgL);

    // chat reactions: pixel hearts float up from the bottom, and pop when the pointer gets close
    float hs = 0.0;
    float hw = 0.0;
    vec3 hcol = pink;
    float pop = 0.0;
    for (int i = 0; i < 12; i++) {
        float fi = float(i);
        float hid = fi * 7.7 + ph * 53.0;
        float per = 8.0 + 6.0 * cp_h(hid + 1.0);
        float cyc = time / per + cp_h(hid + 2.0);
        float life = fract(cyc);
        float cid = floor(cyc) * 3.1 + hid;
        float csz = max(floor(sc * (2.7 + 2.3 * cp_h(cid + 3.0)) + 0.5), 2.0);
        float lane = 0.03 + 0.94 * fract((fi + cp_h(cid + 4.0) * 0.8) / 12.0 + ph);
        vec2 hc;
        hc.y = size.y + 16.0 * csz - life * (size.y + 36.0 * csz);
        hc.x = lane * size.x + sin(life * 9.0 + hid) * 14.0 * sc;
        vec2 d = px - hc;
        float reach = csz * 4.5;
        if (abs(d.x) > reach || abs(d.y) > reach) continue;
        float pd = length(hc - mp);
        float near = over * (1.0 - smoothstep(34.0 * sc, 70.0 * sc, pd));
        vec2 q = floor(d / csz + vec2(3.5, 3.0));
        float body = cp_heart(q);
        float fade = smoothstep(0.0, 0.07, life) * (1.0 - smoothstep(0.82, 1.0, life));
        float f = body * fade * (1.0 - near);
        // pop: the heart bursts into four little sparks that fly apart
        float sp = 0.0;
        if (near > 0.01) {
            vec2 ad = abs(d);
            float rr = csz * (1.5 + 3.0 * near);
            vec2 dd = abs(ad - vec2(rr * 0.7));
            sp = (1.0 - smoothstep(csz * 0.45, csz * 0.9, length(dd))) * (1.0 - near * 0.6) * 0.9;
        }
        float ff = max(f, sp);
        if (ff > hs) {
            hs = ff;
            float cc = cp_h(cid + 5.0);
            hcol = cc < 0.55 ? pink : (cc < 0.8 ? lav : cyan);
            if (sp > f) hcol = wht;
            hw = (q.x == 1.0 && q.y == 1.0) ? 1.0 : 0.0;
        }
    }
    vec3 hc3 = mix(hcol, wht, hw * 0.8);
    c = mix(c, hc3, clamp(hs * 0.92 * bg * live * min(k, 1.3), 0.0, 1.0));

    // heart sparkle at the pointer: a neon heart with a heartbeat, a pink-cyan halo and a few orbiting stars
    if (over > 0.01) {
        float beat = 0.5 + 0.5 * pow(max(sin(time * 4.4), 0.0), 3.0) + 0.25 * pow(max(sin(time * 4.4 - 1.0), 0.0), 4.0);
        float hr = (36.0 + 10.0 * beat) * sc;
        vec2 u = (px - mp) / hr;
        u.y = -u.y + 0.15;
        float f = cp_hf(u);
        float line = exp(-pow(f / 0.11, 2.0));
        float fill = 1.0 - smoothstep(-0.35, 0.0, f);
        float halo = exp(-max(f, 0.0) * 4.0) * (1.0 - fill);
        vec3 nc = mix(pink, cyan, clamp(0.5 + 0.5 * sin(time * 1.3 + u.x * 1.5 - u.y), 0.0, 1.0));
        float pk = over * (0.55 + 0.45 * act) * min(k, 1.4);
        c = cp_lay(c, nc, (halo * 0.65 + fill * 0.28) * pk * (0.3 + 0.7 * bg), bgL);
        c = cp_lay(c, mix(nc, wht, 0.35), line * 1.0 * pk * (0.5 + 0.5 * bg), bgL);
        float st = 0.0;
        for (int j = 0; j < 4; j++) {
            float fj = float(j);
            float ang = time * (0.9 + 0.25 * fj) + fj * 1.5708 + ph * 6.0;
            float rad = (46.0 + 12.0 * sin(time * 2.0 + fj * 2.0)) * sc;
            vec2 sp = mp + vec2(cos(ang), sin(ang) * 0.8) * rad;
            float tw = 0.55 + 0.45 * sin(time * 6.0 + fj * 1.9);
            st = max(st, cp_star(px - sp, (7.0 + 4.0 * tw) * sc) * tw);
        }
        c = cp_lay(c, wht, st * 0.85 * pk, bgL);
    }

    // "typing..." bubble in the bottom right corner of the focused window: three dots pulse in turn
    {
        vec2 bs = vec2(84.0, 38.0) * sc;
        vec2 bc = vec2(size.x - 26.0 * sc - bs.x * 0.5, size.y - 46.0 * sc - bs.y * 0.5);
        if (size.x > 260.0 && size.y > 180.0) {
            vec2 d = px - bc;
            vec2 q = abs(d) - (bs * 0.5 - vec2(bs.y * 0.5));
            float sdf = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - bs.y * 0.5;
            // little tail bubbles under the left end
            float t1 = length(px - (bc + vec2(-bs.x * 0.5 + 10.0 * sc, bs.y * 0.5 + 6.0 * sc))) - 5.0 * sc;
            float t2 = length(px - (bc + vec2(-bs.x * 0.5 + 2.0 * sc, bs.y * 0.5 + 15.0 * sc))) - 3.0 * sc;
            float body = min(sdf, min(t1, t2));
            float inside = 1.0 - smoothstep(-1.0, 1.0, body);
            float edge = exp(-pow((body + 1.0 * sc) / (1.6 * sc), 2.0));
            float bk = act;
            vec3 fillc = mix(vec3(0.55, 0.10, 0.38), vec3(0.20, 0.10, 0.45), clamp(d.y / bs.y + 0.5, 0.0, 1.0));
            c = mix(c, fillc, inside * 0.86 * bk * (0.5 + 0.5 * bg));
            c = mix(c, mix(pink, cyan, clamp(d.x / bs.x + 0.5, 0.0, 1.0)), edge * 0.9 * bk);
            // dots
            float dots = 0.0;
            vec3 dcol = wht;
            for (int j = 0; j < 3; j++) {
                float fj = float(j);
                float pulse = pow(0.5 + 0.5 * sin(time * 5.0 - fj * 1.1), 2.0);
                vec2 dp = bc + vec2((fj - 1.0) * 20.0 * sc, -4.0 * sc * pulse);
                float rad = (4.6 + 2.6 * pulse) * sc;
                float dd = 1.0 - smoothstep(rad - 1.0, rad + 1.0, length(px - dp));
                if (dd * (0.5 + pulse) > dots) { dots = dd * (0.5 + pulse); dcol = mix(vec3(1.0, 0.70, 0.86), wht, pulse); if (j == 2) dcol = mix(vec3(0.60, 0.95, 1.0), wht, pulse); }
            }
            c = mix(c, dcol, clamp(dots, 0.0, 1.0) * inside * bk);
        }
    }

    // inactive windows sit back: a little cooler and dimmer
    c = mix(c * vec3(0.95, 0.96, 1.0), c, act);

    fragColor = vec4(clamp(c, 0.0, 1.0), a);
}
