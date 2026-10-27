#version 300 es
// target: window
// category: Retro
// desc: Disc pane: a 32-bit console look. The window border is a band of flat-shaded low-poly facets that cycle red, yellow, green and blue and drift, the edge swims like wobbling polygons, a rainbow disc sheen sweeps round the rim, a small low-poly gem spins in the lower right corner, and facets near the pointer flip colour and lift; the focused window is brighter and idle ones are muted. Body text stays clear (animated)
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

float dw_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float dw_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 dw_h2(vec2 p) { return vec2(dw_h(p), dw_h(p + vec2(17.3, 41.9))); }

// 4x4 ordered dither threshold in (0,1)
float dw_bayer(vec2 p) {
    ivec2 q = ivec2(mod(floor(p), 4.0));
    int xy = q.x ^ q.y;
    int v = ((xy & 1) << 3) | ((q.y & 1) << 2) | (((xy >> 1) & 1) << 1) | ((q.y >> 1) & 1);
    return (float(v) + 0.5) / 16.0;
}

// the four flat logo colours, hard steps
vec3 dw_flat(float i) {
    i = mod(floor(i), 4.0);
    if (i < 0.5) return vec3(0.93, 0.13, 0.14);
    if (i < 1.5) return vec3(1.00, 0.84, 0.12);
    if (i < 2.5) return vec3(0.12, 0.74, 0.33);
    return vec3(0.14, 0.50, 0.92);
}

// disc rainbow
vec3 dw_rainbow(float h) {
    return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

// is p inside triangle abc
bool dw_in(vec2 p, vec2 a, vec2 b, vec2 c) {
    vec2 v0 = c - a, v1 = b - a, v2 = p - a;
    float d00 = dot(v0, v0), d01 = dot(v0, v1), d11 = dot(v1, v1), d20 = dot(v2, v0), d21 = dot(v2, v1);
    float den = d00 * d11 - d01 * d01;
    if (abs(den) < 1e-4) return false;
    float u = (d11 * d20 - d01 * d21) / den;
    float v = (d00 * d21 - d01 * d20) / den;
    return u >= 0.0 && v >= 0.0 && u + v <= 1.0;
}

void main() {
    vec2 uv = v_texcoord;
    vec2 size = max(surface_size, vec2(1.0));
    vec2 px = uv * size;
    float k = min(STRENGTH / 0.55, 1.5);
    float act = is_active;
    float sc = clamp(size.y / 1080.0 * 1.6, 0.75, 1.6);
    float tq = floor(time * 6.0);                      // vertex snapping: the console steps its wobble

    vec4 s0 = texture(tex, uv);
    float a = s0.a;

    // pointer in window pixels
    vec2 pm = (mouse - window_box.xy);
    vec2 pn = pm / max(window_box.zw, vec2(1.0));
    float over = smoothstep(-0.10, 0.0, pn.x) * smoothstep(1.10, 1.0, pn.x)
               * smoothstep(-0.10, 0.0, pn.y) * smoothstep(1.10, 1.0, pn.y);
    float dm = length(px - pm);
    float pg = exp(-pow(dm / (150.0 * sc), 2.0)) * over;     // pointer closeness, 0..1

    float dE = min(min(px.x, size.x - px.x), min(px.y, size.y - px.y));
    float M = (38.0 + 16.0 * act) * sc;
    float Me = M + 46.0 * sc * pg;                           // the facets swell towards the pointer
    float fm = 1.0 - smoothstep(0.0, Me, dE);                // 0 inside, 1 on the rim

    // ---------- PS1 swim: low-precision stepped vertex jitter of the picture in the margin ----------
    vec2 wob;
    {
        float cw = 18.0 * sc;
        vec2 g = px / cw;
        vec2 gi = floor(g);
        vec2 gf = floor(fract(g) * 4.0) / 4.0;               // low-precision interpolation
        vec2 sd = vec2(tq * 1.37 + seed * 11.0);
        vec2 o00 = dw_h2(gi + sd) - 0.5;
        vec2 o10 = dw_h2(gi + vec2(1.0, 0.0) + sd) - 0.5;
        vec2 o01 = dw_h2(gi + vec2(0.0, 1.0) + sd) - 0.5;
        vec2 o11 = dw_h2(gi + vec2(1.0, 1.0) + sd) - 0.5;
        wob = mix(mix(o00, o10, gf.x), mix(o01, o11, gf.x), gf.y);
        wob += 0.5 * vec2(sin(px.y / (60.0 * sc) + time * 1.3 + seed * 9.0), cos(px.x / (70.0 * sc) + time * 1.1 + seed * 5.0));
    }
    float jam = fm * fm * (6.0 + 5.0 * act) * sc * k;
    vec2 off = floor(wob * jam + 0.5) / size;
    vec4 s1 = texture(tex, uv + off);
    vec3 c = (s1.a > 0.02) ? s1.rgb / max(s1.a, 0.001) : s0.rgb / max(a, 0.001);
    float lum = dw_luma(c);

    // ---------- flat-shaded low-poly facets in the margin ----------
    float cs = 30.0 * sc;
    vec2 q = px + vec2(time * 7.0 + seed * 400.0, time * 4.0 - seed * 230.0) * sc;   // the mesh drifts slowly
    q += 6.0 * sc * vec2(sin(q.y / (45.0 * sc) + tq * 0.45 + seed * 6.0), sin(q.x / (53.0 * sc) - tq * 0.38));
    float yy = q.y / (cs * 0.866);
    vec2 g = vec2(q.x / cs - 0.5 * yy, yy);
    vec2 gi = floor(g);
    vec2 gf = fract(g);
    float up = step(1.0, gf.x + gf.y);                       // which triangle of the rhombus
    float em = (up > 0.5) ? min(min(1.0 - gf.x, 1.0 - gf.y), gf.x + gf.y - 1.0)
                          : min(min(gf.x, gf.y), 1.0 - gf.x - gf.y);
    float fid = gi.x * 2.0 + up;
    float hh = dw_h(vec2(fid, gi.y) + seed * 13.0);
    float ph = hh * 0.9 + (gi.x * 0.11 + gi.y * 0.17) + time * 0.16 + seed * 4.0;
    // the pointer flips nearby facets to the opposite colour and lifts them
    float nearf = floor(smoothstep(0.30, 0.75, pg + 0.25 * dw_h(vec2(fid + 3.0, gi.y)) * pg) + 0.5);
    ph += 2.0 * nearf;
    vec3 fc = dw_flat(ph);
    float la = time * 0.35 + seed * 6.283;
    vec2 nv = vec2(cos(hh * 6.283 + time * 0.2), sin(hh * 6.283 + time * 0.2));
    float lit = 0.62 + 0.42 * dot(nv, vec2(cos(la), sin(la))) + 0.18 * (up - 0.5) + 0.30 * nearf;
    fc *= lit;
    fc *= 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.055, em)) * (1.0 - 0.5 * nearf);       // dark polygon seams
    fc += 0.20 * (1.0 - smoothstep(0.0, 0.05, abs(em - 0.09))) * (0.3 + nearf);        // faint bevel beside the seams

    // dithered fade of the facet band
    float dith = dw_bayer(px / max(floor(sc + 0.5), 1.0));
    float cover = fm * (0.80 + 0.35 * act);
    float fa = smoothstep(dith - 0.12, dith + 0.12, cover);
    fa *= mix(0.62, 1.0, fm);
    // where the band swells towards the pointer, keep text (bright on dark) untouched
    float deep = smoothstep(M * 0.55, M * 1.0, dE);
    float tx = smoothstep(0.35, 0.75, lum);
    fa *= mix(1.0, 0.45 * (1.0 - tx) + 0.10, deep);
    fa *= (0.55 + 0.45 * act) * min(k, 1.3) * 1.15;
    fa = clamp(fa, 0.0, 0.95);
    // text guard: strokes are local contrast, so where a pixel differs from its neighbours the picture shows through
    vec2 tp = 2.5 / size;
    float ink = max(max(abs(lum - dw_luma(texture(tex, uv + vec2(tp.x, 0.0)).rgb)), abs(lum - dw_luma(texture(tex, uv - vec2(tp.x, 0.0)).rgb))),
                    max(abs(lum - dw_luma(texture(tex, uv + vec2(0.0, tp.y)).rgb)), abs(lum - dw_luma(texture(tex, uv - vec2(0.0, tp.y)).rgb))));
    fa *= 1.0 - 0.85 * smoothstep(0.06, 0.28, ink);
    c = mix(c, fc, fa);

    // ---------- rainbow disc sheen sweeping round the rim ----------
    vec2 d = px - size * 0.5;
    float ang = atan(d.y * size.x / size.y, d.x);
    float beam = pow(0.5 + 0.5 * cos(ang * 2.0 - time * 0.55 + seed * 6.283), 6.0);
    float beam2 = pow(0.5 + 0.5 * cos(ang * 3.0 + time * 0.33 + seed * 2.0), 10.0);
    float rim = exp(-dE / (4.0 * sc));
    float band = exp(-dE / (26.0 * sc));
    vec3 rb = dw_rainbow(ang * 0.477 + time * 0.06 + dE / (260.0 * sc) + seed);
    float sh = (beam * (0.95 * rim + 0.45 * band) + 0.35 * beam2 * band) * (0.50 + 0.65 * act);
    c += rb * sh * 0.75 * k;
    c = mix(c, vec3(1.0), clamp(rim * beam * 0.25 * (0.4 + 0.6 * act), 0.0, 0.5));

    // ---------- spinning low-poly gem, lower right corner ----------
    {
        vec2 gc = size - vec2(66.0, 66.0) * sc;
        float R = 30.0 * sc;
        vec2 lp = px - gc;
        if (abs(lp.x) < R * 1.1 && abs(lp.y) < R * 1.5) {
            float spin = time * (0.9 + 1.6 * pg) * (fract(seed * 3.7) > 0.5 ? 1.0 : -1.0) + seed * 20.0;
            lp.y += sin(time * 1.3 + seed * 5.0) * 3.0 * sc;
            float snap = max(floor(1.5 * sc), 1.0);
            lp = floor(lp / snap + 0.5) * snap;
            vec2 T = vec2(0.0, -R * 1.15), B = vec2(0.0, R * 1.15);
            vec2 V0 = vec2(R * 0.85 * cos(spin), R * 0.25 * sin(spin));
            vec2 V1 = vec2(R * 0.85 * cos(spin + 1.5708), R * 0.25 * sin(spin + 1.5708));
            vec2 V2 = -V0, V3 = -V1;
            float f0 = sin(spin + 0.7854), f1 = cos(spin + 0.7854), f2 = -f0, f3 = -f1;
            float cb = floor(spin / 1.5708);
            float hit = 0.0;
            vec3 gcol = vec3(0.0);
            if (f0 > 0.0) {
                if (dw_in(lp, T, V0, V1)) { hit = 1.0; gcol = dw_flat(cb) * (0.55 + 0.55 * f0); }
                else if (dw_in(lp, B, V1, V0)) { hit = 1.0; gcol = dw_flat(cb + 2.0) * (0.45 + 0.5 * f0); }
            }
            if (hit < 0.5 && f1 > 0.0) {
                if (dw_in(lp, T, V1, V2)) { hit = 1.0; gcol = dw_flat(cb + 1.0) * (0.55 + 0.55 * f1); }
                else if (dw_in(lp, B, V2, V1)) { hit = 1.0; gcol = dw_flat(cb + 3.0) * (0.45 + 0.5 * f1); }
            }
            if (hit < 0.5 && f2 > 0.0) {
                if (dw_in(lp, T, V2, V3)) { hit = 1.0; gcol = dw_flat(cb + 2.0) * (0.55 + 0.55 * f2); }
                else if (dw_in(lp, B, V3, V2)) { hit = 1.0; gcol = dw_flat(cb) * (0.45 + 0.5 * f2); }
            }
            if (hit < 0.5 && f3 > 0.0) {
                if (dw_in(lp, T, V3, V0)) { hit = 1.0; gcol = dw_flat(cb + 3.0) * (0.55 + 0.55 * f3); }
                else if (dw_in(lp, B, V0, V3)) { hit = 1.0; gcol = dw_flat(cb + 1.0) * (0.45 + 0.5 * f3); }
            }
            gcol += vec3(0.25) * (1.0 - smoothstep(0.0, 1.6 * sc, abs(lp.y))) * hit;
            c = mix(c, gcol, hit * (0.60 + 0.40 * act) * min(k, 1.2));
        }
    }

    // ---------- 15-bit colour: quantise the border region with dither ----------
    float qa = smoothstep(0.05, 0.25, fm);
    vec3 qc = floor(c * 31.0 + dw_bayer(px)) / 31.0;
    c = mix(c, qc, qa);

    // idle windows sit further back, muted
    float gry = dw_luma(c);
    c = mix(mix(vec3(gry), c, 0.62) * vec3(0.93, 0.94, 1.0), c, act);

    fragColor = vec4(clamp(c, 0.0, 1.0), a);
}
