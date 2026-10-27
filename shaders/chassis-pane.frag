#version 300 es
// target: window
// category: Ambient
// desc: Redline Run: the window edges sit in a carbon-fibre frame that buzzes like an engine bay, a rev-light strip along the top climbs and drops through the gears and leaps up toward the redline as the pointer comes near, red and amber speed streaks rush down the side edges, heat haze shimmers over a warm glow at the bottom edge, and the pointer lights the frame near it; the focused window revs harder and every window runs on its own beat, while body text stays clear (animated)
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

float cp_h(float x) { return fract(sin(x * 127.1 + 311.7) * 43758.5453); }
float cp_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cp_n(float x) {
    float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(cp_h(i), cp_h(i + 1.0), f);
}
float cp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float cp_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }

void main() {
    float k = min(STRENGTH / 0.55, 1.3);
    float act = is_active;
    vec2 size = max(surface_size, vec2(1.0));
    vec2 px = v_texcoord * size;
    float sc = clamp(size.y / 560.0, 0.8, 2.0);
    float t = time;
    float ph = seed * 7.0;

    // distance to each edge in pixels
    float eL = px.x; float eR = size.x - px.x; float eT = px.y; float eB = size.y - px.y;
    float e = min(min(eL, eR), min(eT, eB));

    // pointer: window-local position, how near it is (1 over the window, fading out to ~300 px away)
    vec2 pm = mouse - window_box.xy;
    vec2 dd = max(max(-pm, pm - window_box.zw), vec2(0.0));
    float prox = exp(-length(dd) / (260.0 * sc));

    float tq = floor(t * 30.0);                        // the buzz steps at 30 Hz, like a shaking part

    // ---- vibration: the outer band of the window is re-sampled with a fast jitter ----
    float M = 46.0 * sc;
    float fadeM = 1.0 - smoothstep(0.0, M, e);
    float amp = (0.8 + 1.4 * act + 0.8 * prox) * k * sc;
    float rowj = cp_h2(vec2(floor(px.y / (2.0 * sc)), tq + ph)) - 0.5;
    float colj = cp_h2(vec2(floor(px.x / (2.0 * sc)), tq + ph + 9.0)) - 0.5;
    float side = smoothstep(M, 0.0, min(eL, eR));
    float topb = smoothstep(M, 0.0, min(eT, eB));
    vec2 so = vec2(rowj * side * 2.0, colj * topb * 2.0) * amp * fadeM;
    // heat shimmer: a slow wave through the lowest ~60 px, rising and drifting
    float hz = 64.0 * sc;
    float hfade = pow(1.0 - smoothstep(0.0, hz, eB), 1.5);
    float wave = sin(eB * 0.28 / sc - t * 5.0 + px.x * 0.021 / sc + ph * 3.0) * 0.6
               + sin(eB * 0.11 / sc - t * 2.7 - px.x * 0.013 / sc + ph) * 0.4;
    so.x += wave * hfade * (1.8 + 1.4 * act + 1.2 * prox) * k * sc;
    so.y += wave * 0.5 * hfade * k * sc;
    vec2 uv = clamp(v_texcoord + so / size, vec2(0.0), vec2(1.0));
    vec4 s = texture(tex, uv);
    float a = s.a;
    vec3 c = s.rgb / max(a, 0.001);
    float lum = cp_luma(c);

    // what is background and what is text: compare with a tap near the top-left corner
    vec3 ref = texture(tex, clamp(vec2(14.0 * sc, 14.0 * sc) / size, vec2(0.0), vec2(1.0))).rgb;
    float refl = cp_luma(ref);
    float txt = smoothstep(0.07, 0.30, abs(lum - refl));   // 1 on glyphs and lines
    float calm = 1.0 - 0.9 * txt;

    // ---- carbon-fibre weave frame, a twill whose tows buzz and a sheen that sweeps across ----
    float cw = 3.2 * sc;
    vec2 wp = px + vec2(cp_h(tq + ph) - 0.5, cp_h(tq + ph + 4.0) - 0.5) * 1.3 * sc * (0.5 + act) * k;
    vec2 q = wp / cw; vec2 id = floor(q); vec2 f = fract(q);
    float over = step(mod(id.x + id.y, 4.0), 1.5);
    float tow = over > 0.5 ? 0.5 - 0.5 * cos(f.x * 6.2832) : 0.5 - 0.5 * cos(f.y * 6.2832);
    float tint = 0.05 + 0.20 * tow + 0.03 * cp_h2(id);
    float sweepLen = (size.x + size.y) * 1.4;
    float sx = mod(t * (110.0 + 70.0 * act) * sc + seed * sweepLen, sweepLen) - 0.2 * sweepLen;
    float sheen = exp(-pow((px.x + px.y * 0.6 - sx) / (40.0 * sc), 2.0));
    vec3 carbon = vec3(tint) * vec3(1.0, 1.0, 1.08);
    carbon += vec3(0.55, 0.50, 0.48) * sheen * tow * (0.5 + 0.5 * act) * 0.6;
    // pointer light on the frame, red
    float pg = exp(-pow(length(px - pm) / (120.0 * sc), 2.0));
    carbon += vec3(0.85, 0.12, 0.06) * pg * (0.35 + 0.65 * tow) * 0.55;
    float wa = (1.0 - smoothstep(7.0 * sc, 27.0 * sc, e)) * (0.72 + 0.2 * act) * k;
    c = mix(c, carbon, clamp(wa, 0.0, 0.92) * calm);

    // ---- speed streaks on the side edges: red and amber, rushing down, quicker when driven ----
    float lane = 4.6 * sc;
    float lx = min(eL, eR);
    float cellx = floor(lx / lane);
    float hx = cp_h(cellx * 1.7 + (eL < eR ? 3.0 : 11.0) + ph);
    float exist = step(0.2, hx);
    float lenp = (140.0 + 260.0 * cp_h(hx * 91.0)) * sc;
    float spd = (170.0 + 260.0 * cp_h(hx * 47.0)) * sc * (0.7 + 0.5 * act + 0.9 * prox);
    float yy = px.y + (eL < eR ? 0.0 : 77.0 * sc) + cp_h(hx * 13.0) * 900.0;
    float phs = fract((yy - t * spd) / (lenp * 2.6));       // 0..1 along one cycle
    float head = phs * 2.6;                                  // 0..2.6 in streak lengths
    float tail = 1.0 - smoothstep(0.0, 1.0, head);
    tail = tail * tail * smoothstep(0.0, 0.03, phs);
    float colw = cp_aa(abs(fract(lx / lane) - 0.5) * lane, 0.9 * sc);
    float sfade = 1.0 - smoothstep(14.0 * sc, 48.0 * sc, lx);
    float st = exist * tail * colw * sfade * (0.45 + 0.55 * act) * (0.8 + 0.5 * prox) * k;
    vec3 sc1 = mix(vec3(1.0, 0.18, 0.08), vec3(1.0, 0.72, 0.18), cp_h(hx * 29.0));
    sc1 = mix(sc1, vec3(1.0, 0.95, 0.80), tail * tail * tail * 0.5);
    c = mix(c, sc1, clamp(st * 1.25, 0.0, 1.0) * mix(1.0, 0.25, txt));

    // ---- rev-light strip along the top ----
    const int N = 16;
    float W = clamp(size.x * 0.62, 190.0 * sc, 560.0 * sc);
    float x0 = (size.x - W) * 0.5;
    float pitch = W / float(N);
    float sy = 12.0 * sc + (cp_h(tq + ph + 2.0) - 0.5) * 0.9 * sc * k;   // the strip shakes a little
    float sh = 7.0 * sc;
    float u = (px.x - x0) / pitch;
    float inStrip = step(0.0, u) * step(u, float(N));
    float idx = floor(u);
    float fu = fract(u);
    // housing
    float housing = cp_aa(abs(px.y - sy) - (sh * 0.5 + 3.0 * sc), 0.6) * step(x0 - 5.0 * sc, px.x) * step(px.x, x0 + W + 5.0 * sc);
    c = mix(c, vec3(0.025, 0.025, 0.03), housing * 0.78 * k * calm);
    // engine note: each gear climbs, peaks and drops; a window drives harder when focused and when the pointer is near
    float cyc = fract(t * mix(0.13, 0.22, act) + seed * 3.0);
    float rpm = 0.14 + 0.62 * pow(cyc, 1.4) * (1.0 - 0.35 * (1.0 - act));
    rpm += 0.05 * sin(t * 9.0 + ph * 5.0) * (0.4 + 0.6 * act);
    rpm += (0.30 + 0.12 * act) * prox;
    rpm = clamp(rpm, 0.0, 1.05);
    float segF = (idx + 0.5) / float(N);
    float lit = smoothstep(segF - 0.03, segF + 0.015, rpm);    // soft front, segments bounce with the revs
    float limiter = step(0.96, rpm) * step(0.5, fract(t * 9.0 + seed));   // flashes at the limiter
    vec3 lc;
    if (segF < 0.28) lc = vec3(0.30, 0.95, 0.32);
    else if (segF < 0.62) lc = vec3(1.0, 0.70, 0.12);
    else lc = vec3(1.0, 0.12, 0.08);
    lc = mix(lc, vec3(1.0, 0.95, 0.92), limiter * 0.65);
    float sw = cp_aa(abs(fu - 0.5) * pitch, pitch * 0.5 - 2.0 * sc);
    float sv = cp_aa(abs(px.y - sy), sh * 0.5);
    float seg = sw * sv * inStrip;
    float on = max(lit, limiter);
    vec3 dim = lc * 0.16;
    vec3 segc = mix(dim, lc, on);
    float dist = abs(px.y - sy);
    float bloom = inStrip * exp(-pow(max(dist - sh * 0.5, 0.0) / (5.0 * sc), 2.0)) * on * exp(-pow((fu - 0.5) * 1.6, 2.0));
    c = mix(c, segc, seg * (0.55 + 0.45 * act) * min(k, 1.15));
    c += lc * bloom * 0.45 * (0.4 + 0.6 * act) * (1.0 - 0.6 * lum) * k * (1.0 - seg);

    // ---- warm glow under the heat haze at the bottom edge ----
    float gx = 0.5 + 0.4 * sin(t * 0.5 + ph);
    float gdx = clamp(pm.x / size.x, 0.0, 1.0);
    float gpos = mix(gx, gdx, 0.7 * prox);
    float gloss = exp(-pow((px.x / size.x - gpos) / 0.45, 2.0));
    float rise = hz * (0.55 + 0.45 * cp_n(px.x / (60.0 * sc) - t * 1.3 + ph * 40.0)) * (0.8 + 0.5 * prox);
    float glow = exp(-eB / max(rise * 0.45, 1.0)) * (0.5 + 0.5 * gloss) * (0.5 + 0.5 * act + 0.4 * prox) * k;
    float lines = 0.5 + 0.5 * sin(eB * 0.35 / sc - t * 4.0 + wave * 2.0);
    vec3 heat = mix(vec3(1.0, 0.25, 0.06), vec3(1.0, 0.62, 0.15), exp(-eB / (12.0 * sc)));
    c += heat * glow * (0.42 + 0.16 * lines) * (1.0 - 0.8 * smoothstep(0.15, 0.85, lum)) * calm;
    c = mix(c, c * vec3(1.0, 0.86, 0.72), glow * 0.35 * smoothstep(0.4, 0.9, lum) * calm);

    // ---- racing pinstripe on the outer edge: red, with a white hairline inside, buzzing ----
    float jr = (cp_h(tq + ph + 6.0) - 0.5) * 0.9 * sc * k;
    float pin = cp_aa(abs(e - (2.4 * sc + jr)), 0.9 * sc);
    float pin2 = cp_aa(abs(e - (4.6 * sc + jr)), 0.4 * sc);
    c = mix(c, vec3(0.95, 0.08, 0.06), pin * (0.65 + 0.3 * act) * min(k, 1.2));
    c = mix(c, vec3(0.95, 0.95, 0.97), pin2 * (0.3 + 0.4 * act) * min(k, 1.2));

    fragColor = vec4(clamp(c, 0.0, 1.0), a);
}
