#version 300 es
// target: window
// category: Ambient
// desc: Plank pane: every window is framed in grained walnut with mitred corners; a varnish highlight slowly sweeps across the glossy wood, a specular hotspot follows the pointer and the grain shifts a little with it, a branding-iron ember travels round the inner edge leaving a dark scorch and throwing ember sparks and pale sawdust into the window, and a faint walnut-oil tint warms the body next to the frame; the focused window glows brighter and the body text stays clear (animated)
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

float pp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float pp_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float pp_n(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(pp_h(i), pp_h(i + vec2(1.0, 0.0)), f.x), mix(pp_h(i + vec2(0.0, 1.0)), pp_h(i + vec2(1.0, 1.0)), f.x), f.y);
}

// wood light level along a board: u runs along the grain, v across it
float pp_wood(float u, float v, float sd) {
    float warp = pp_n(vec2(u * 0.006 + sd * 3.0, v * 0.030)) * 0.7 + pp_n(vec2(u * 0.016 + sd, v * 0.07)) * 0.3;
    float g = v * 0.085 + warp * 2.2 + sd * 9.0;
    float s = fract(g);
    float late = pow(s, 2.4) * smoothstep(1.0, 0.90, s) * (0.55 + 0.9 * pp_h(vec2(floor(g), sd)));
    float fib = pp_n(vec2(u * 0.018, v * 0.9 + sd)) * 0.55 + pp_n(vec2(u * 0.06, v * 2.4)) * 0.45;
    return 0.64 - 0.20 * late + 0.22 * (fib - 0.5);
}

// point on the ember track (a rectangle inset by r) at perimeter distance s, clockwise; xy = position, zw = inward normal
vec4 pp_pos(float s, vec2 size, float r) {
    float x0 = r, y0 = r, x1 = size.x - r, y1 = size.y - r;
    float rw = x1 - x0, rh = y1 - y0;
    if (s < rw) return vec4(x0 + s, y0, 0.0, 1.0);
    s -= rw;
    if (s < rh) return vec4(x1, y0 + s, -1.0, 0.0);
    s -= rh;
    if (s < rw) return vec4(x1 - s, y1, 0.0, -1.0);
    s -= rw;
    return vec4(x0, y1 - min(s, rh), 1.0, 0.0);
}

// branding-iron heat ramp: 0 dark scorch, then deep red, orange, yellow-white
vec3 pp_heat(float h) {
    vec3 c = mix(vec3(0.07, 0.030, 0.015), vec3(0.50, 0.09, 0.02), smoothstep(0.0, 0.28, h));
    c = mix(c, vec3(1.0, 0.40, 0.07), smoothstep(0.22, 0.58, h));
    return mix(c, vec3(1.0, 0.86, 0.50), smoothstep(0.55, 0.95, h));
}

void main() {
    vec4 s = texture(tex, v_texcoord);
    float a = s.a;
    vec3 c = s.rgb / max(a, 0.001);
    float k = min(STRENGTH / 0.60, 1.4);
    float act = is_active;
    float vig = mix(0.45, 1.0, act);
    vec2 size = surface_size;
    vec2 px = v_texcoord * size;
    float sc = clamp(size.y / 560.0, 0.8, 2.0);
    float sd = pp_h(vec2(seed * 7.3, 2.1));
    float lum = pp_luma(c);

    // pointer in window pixels (may sit outside the window), and a small parallax of the grain
    vec2 m = mouse - window_box.xy;
    vec2 pc = clamp(m / max(size, vec2(1.0)), 0.0, 1.0) - 0.5;

    float W = 25.0 * sc;
    float Ws = 19.0 * sc;                      // inner edge of the frame, where the ember runs
    vec2 dEdge = vec2(min(px.x, size.x - px.x), min(px.y, size.y - px.y));
    float dm = min(dEdge.x, dEdge.y);
    bool horiz = dEdge.y < dEdge.x;

    // ember track: a rectangle along the inner edge; the head runs round it once in ~16 s, each window on its own phase
    float rw = size.x - 2.0 * Ws, rh = size.y - 2.0 * Ws;
    float P = 2.0 * (rw + rh);
    float vhead = P / mix(26.0, 15.0, act) / (0.85 + 0.3 * fract(seed * 5.7));
    float hd = mod(time * vhead + seed * 9.1 * P, P);
    float sp;                                   // this pixel's position along the track
    {
        vec2 q = clamp(px, vec2(Ws), size - vec2(Ws));
        if (horiz) sp = (px.y < size.y * 0.5) ? q.x - Ws : rw + rh + (size.x - Ws - q.x);
        else sp = (px.x < size.x * 0.5) ? 2.0 * rw + rh + (size.y - Ws - q.y) : rw + (q.y - Ws);
    }
    float ds = mod(hd - sp + 0.5 * P, P) - 0.5 * P;            // > 0: behind the head
    float heat = ds > 0.0 ? exp(-ds / (620.0 * sc)) * 0.72 + 0.28 * exp(-ds * ds / (70.0 * sc * 70.0 * sc))
                          : exp(-ds * ds / (26.0 * sc * 26.0 * sc));
    heat = min(heat, 1.0);
    // the pointer heats the groove under it
    float dpt = length(px - m);
    heat = max(heat, 0.62 * exp(-pow(dpt / (95.0 * sc), 2.0)));
    heat *= mix(0.30, 1.0, act);

    float inFrame = 1.0 - smoothstep(Ws, W, dm);
    if (inFrame > 0.001) {
        // mitred corners: the nearer side decides which way the grain runs; the diagonal is a thin seam
        float u = horiz ? px.x : px.y;
        float v = horiz ? px.y : px.x;
        float side = horiz ? (px.y < size.y * 0.5 ? 0.0 : 1.0) : (px.x < size.x * 0.5 ? 2.0 : 3.0);
        float sdd = sd + side * 0.23;
        float dsh = horiz ? dEdge.y : dEdge.x;
        float w = pp_wood((u + (horiz ? pc.x : pc.y) * 26.0 * sc) / sc + side * 130.0, (dsh + (horiz ? pc.y : pc.x) * 7.0 * sc) / sc + 4.0, sdd);
        vec3 dk = vec3(0.17, 0.095, 0.050);
        vec3 wal = vec3(0.38, 0.215, 0.110);
        vec3 hon = vec3(0.80, 0.575, 0.325);
        vec3 wc = mix(dk, wal, smoothstep(0.15, 0.50, w));
        wc = mix(wc, hon, smoothstep(0.45, 0.80, w));
        // bevel: bright on the outside edge, darker toward the content
        float t = dm / Ws;
        wc *= 0.80 + 0.20 * (1.0 - clamp(t, 0.0, 1.0)) + 0.12 * smoothstep(0.0, 0.2, t);
        float mit = 1.0 - smoothstep(0.6 * sc, 1.6 * sc, abs(dEdge.x - dEdge.y));
        mit *= 1.0 - smoothstep(Ws, W, dm);
        wc *= 1.0 - 0.55 * mit;
        wc *= mix(0.66, 1.0, act);

        // varnish: a broad highlight band sweeps the whole frame, stronger on the light early wood
        float ang = 0.45 + 0.5 * fract(seed * 3.3);
        vec2 dir = vec2(cos(ang), sin(ang));
        float Lq = size.x * dir.x + size.y * dir.y;
        float cyc = time / mix(11.0, 7.5, act) + seed * 4.0;
        float ctr = -140.0 * sc + fract(cyc) * (Lq + 280.0 * sc);
        float q = dot(px, dir) - ctr;
        float gloss = 0.45 + 1.1 * clamp(w - 0.28, 0.0, 0.6);
        float sweep = exp(-pow(q / (46.0 * sc), 2.0)) + 0.35 * exp(-pow((q - 110.0 * sc) / (12.0 * sc), 2.0));
        // pointer hotspot, stretched along the grain
        vec2 dd = px - m;
        float al = horiz ? dd.x : dd.y;
        float ac = horiz ? dd.y : dd.x;
        float hs = exp(-pow(al / (170.0 * sc), 2.0) - pow(ac / (125.0 * sc), 2.0));
        float spec = (sweep * 0.62 + hs * 0.50 + hs * hs * hs * 0.55) * gloss * vig;
        wc = mix(wc, vec3(1.0, 0.90, 0.66), clamp(spec * 0.85 * k, 0.0, 0.92));
        wc += vec3(0.30, 0.19, 0.08) * spec * 0.45 * k;

        // dark scorch groove along the inner edge, then the ember glow in it
        float gdist = abs(dm - Ws);
        float groove = 1.0 - smoothstep(1.0 * sc, 3.2 * sc, gdist);
        wc = mix(wc, vec3(0.03, 0.012, 0.006), groove * 0.88);
        float hl = pow(heat, 1.1);
        vec3 hc = pp_heat(hl);
        float core = 1.0 - smoothstep(0.6 * sc, 2.4 * sc, gdist);
        wc = mix(wc, hc, core * clamp(0.18 + hl * 1.3, 0.0, 1.0) * 0.95);
        wc += hc * hl * exp(-pow(gdist / (6.5 * sc), 2.0)) * 0.55;

        float amt = clamp(inFrame * (0.82 + 0.16 * act) * min(k, 1.2), 0.0, 0.97);
        c = mix(c, wc, amt);
    } else {
        // inside the window: the ember glow leaks in, plus a faint walnut-oil tint spreading from the frame
        float gdist = dm - Ws;
        float hl = pow(heat, 1.1);
        float leak = exp(-gdist / (20.0 * sc)) * hl * (1.0 - 0.65 * lum) * (0.35 + 0.65 * smoothstep(0.0, 16.0 * sc, abs(dEdge.x - dEdge.y)));
        c += pp_heat(max(hl, 0.45)) * leak * 0.60 * k * vig;
        float drift = 0.65 + 0.35 * sin(sp * 0.011 / sc + time * 0.45 + seed * 6.0) * sin(sp * 0.0047 / sc - time * 0.3);
        float oil = exp(-gdist / (62.0 * sc)) * drift * mix(0.55, 1.0, act) * k;
        c = mix(c, c * vec3(1.06, 0.93, 0.76) + vec3(0.050, 0.026, 0.006) * (1.0 - lum), clamp(oil * 0.9, 0.0, 0.7));
    }

    // ember sparks and sawdust thrown off the head, drifting into the window
    {
        vec3 acc = vec3(0.0);
        float aa = 0.0;
        float life = 2.6;
        for (int i = 0; i < 12; i++) {
            float fi = float(i);
            float cyp = time / life + fi * 0.0833 + seed * 3.1;
            float age = fract(cyp);
            float id = floor(cyp);
            float r1 = pp_h(vec2(fi * 1.7 + id * 0.37, seed * 11.0 + 3.0));
            float r2 = pp_h(vec2(id * 1.3 + fi, fi * 0.77 + seed));
            bool dust = (i - (i / 2) * 2) == 1;
            float hb = mod(hd - age * life * vhead - (r1 - 0.2) * 70.0 * sc, P);
            vec4 pn = pp_pos(hb, size, Ws);
            float spd = (dust ? 18.0 : 40.0) * sc * (0.5 + r2);
            vec2 pos = pn.xy + pn.zw * (age * spd * 1.5 + 4.0 * sc) + vec2(sin(age * 7.0 + fi * 2.0 + r1 * 6.0) * 7.0 * sc * age, -age * age * (dust ? 12.0 : 40.0) * sc);
            float d2 = dot(px - pos, px - pos);
            float rad = (dust ? 2.2 : 1.9) * sc * (1.0 - 0.4 * age);
            float fade = (1.0 - age) * smoothstep(0.0, 0.06, age);
            float fl = 0.75 + 0.25 * sin(time * 17.0 + fi * 5.0 + id);
            float b = (exp(-d2 / (rad * rad)) + 0.30 * exp(-d2 / (5.0 * rad * rad))) * fade * fade * fl * (dust ? 0.55 : 1.0);
            vec3 sc3 = dust ? vec3(0.92, 0.76, 0.52) : pp_heat(0.95 - 0.8 * age);
            acc += sc3 * b;
            aa += b;
        }
        c = mix(c, acc / max(aa, 0.0001), clamp(aa, 0.0, 1.0) * vig * min(k, 1.2) * 0.95);
    }

    fragColor = vec4(clamp(c, 0.0, 1.0), a);
}
