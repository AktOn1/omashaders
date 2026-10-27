#version 300 es
// target: window
// category: Glass
// desc: Quarantine pane: the window as an industrial holo-panel; a pale cyan hairline border with seam ticks and heavier corner brackets, a slow faint scan-line sheen drifting down the glass, and condensation and frost gathering only in the margins and low corners (the middle and the text stay clear, bright or busy areas are left alone); the focused window carries a slow amber warning light creeping along its top edge with a tail and a breathing amber pip, unfocused windows go cold, dim and steel-grey (animated)
// strength: 65
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
layout(location = 0) out vec4 fragColor;

float qp_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float qp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

float qp_vn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(qp_h(i), qp_h(i + vec2(1.0, 0.0)), f.x), mix(qp_h(i + vec2(0.0, 1.0)), qp_h(i + vec2(1.0, 1.0)), f.x), f.y);
}

// frost: a soft low-frequency mist plus fine ridged crystals on top (returns mist, crystals)
vec2 qp_frost(vec2 q) {
    float mist = qp_vn(q * 0.45) * 0.6 + qp_vn(q * 1.1 + 4.7) * 0.4;
    float r = 1.0 - abs(2.0 * qp_vn(q * 2.6 + 7.1) - 1.0);
    float r2 = 1.0 - abs(2.0 * qp_vn(q * 5.3 + 1.9) - 1.0);
    float cr = pow(r, 5.0) * 0.75 + pow(r2, 7.0) * 0.45;
    return vec2(mist, cr);
}

// condensation beads: a cell holds at most one droplet; returns (bead body, rim glint)
vec2 qp_beads(vec2 px, float cell, float sd) {
    vec2 g = px / cell, id = floor(g), f = fract(g);
    float h = qp_h(id + sd * 17.0);
    if (h > 0.34) return vec2(0.0);
    vec2 m = vec2(0.25 + 0.5 * qp_h(id + 3.1), 0.25 + 0.5 * qp_h(id + 8.7));
    float rad = (0.9 + 1.4 * qp_h(id + 5.5)) / cell * 1.6;
    vec2 e = (f - m) * cell;
    float r = length(e) / (rad * cell * 0.55);
    float body = smoothstep(1.0, 0.7, r);
    float glint = smoothstep(0.55, 0.0, length(e / (rad * cell * 0.55) - vec2(-0.35, -0.38))) * body;   // light caught on its upper left
    return vec2(body * (1.0 - 0.5 * smoothstep(0.2, 0.9, r)), glint);
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                              // un-premultiply; the composer re-applies alpha
    float act = is_active;
    float sd = fract(seed);
    vec2 sz = surface_size;
    vec2 px = uv * sz;
    float sc = clamp(min(sz.x, sz.y) / 620.0, 0.7, 2.0);
    float lum = qp_luma(c);
    float t = time;

    // keep the text area clear: next to glyphs and icons (busy) almost nothing; very pale glass is touched less
    vec2 st = vec2(1.7, 1.7) / max(sz, vec2(1.0));
    float a1 = qp_luma(texture(tex, uv + st).rgb);
    float a2 = qp_luma(texture(tex, uv - st).rgb);
    float a3 = qp_luma(texture(tex, uv + vec2(st.x, -st.y)).rgb);
    float a4 = qp_luma(texture(tex, uv - vec2(st.x, -st.y)).rgb);
    float busy = max(max(a1, a2), max(a3, a4)) - min(min(a1, a2), min(a3, a4));
    float clear = (1.0 - 0.92 * smoothstep(0.04, 0.26, busy)) * (1.0 - 0.50 * smoothstep(0.70, 0.95, lum));

    vec2 e2 = min(px, sz - px);                                       // distance to the nearest vertical / horizontal edge
    float dE = min(e2.x, e2.y);
    float mw = clamp(0.075 * min(sz.x, sz.y), 18.0, 70.0);            // margin where the frost may live
    float inM = 1.0 - smoothstep(mw * 0.45, mw, dE);
    float low = 0.55 + 0.45 * smoothstep(0.25, 1.0, px.y / sz.y);     // condensation settles low
    float cornerK = 1.0 + 0.9 * exp(-length(e2) / (mw * 1.4));        // and thickens in the corners

    vec3 cy = vec3(0.45, 0.92, 1.0);
    vec3 wh = vec3(0.80, 0.97, 1.0);
    vec3 am = vec3(1.0, 0.66, 0.25);
    vec3 ice = vec3(0.62, 0.80, 0.90);

    vec3 L = vec3(0.0);                                               // light added (premultiplied by its intensity)
    float K = mix(0.35, 1.0, act);

    // ---- hairline border with seam ticks, and heavier corner brackets
    {
        float line = 1.0 - smoothstep(0.30, 0.95, abs(dE - 1.6));
        // seam ticks: short marks leaning inward every ~130 px along each edge
        float along = e2.x < e2.y ? px.y : px.x;
        float seamP = 130.0 * sc;
        float sx = abs(fract(along / seamP + 0.5 + sd * 0.37) - 0.5) * seamP;
        float tick = (1.0 - smoothstep(0.4, 1.1, sx)) * (1.0 - smoothstep(4.0 * sc, 5.0 * sc, dE)) * step(1.0, dE);
        // brackets: heavier arms hugging each corner, plus a short second arm tucked inside
        float arm = 30.0 * sc;
        float h1 = (1.0 - smoothstep(0.5, 1.2, abs(e2.y - 2.4) - 0.5)) * (1.0 - smoothstep(arm - 8.0, arm, e2.x));
        float v1 = (1.0 - smoothstep(0.5, 1.2, abs(e2.x - 2.4) - 0.5)) * (1.0 - smoothstep(arm - 8.0, arm, e2.y));
        float arm2 = 11.0 * sc;
        float h2 = (1.0 - smoothstep(0.3, 0.9, abs(e2.y - 7.0))) * (1.0 - smoothstep(arm2 - 3.0, arm2, e2.x)) * step(2.0, e2.x);
        float v2 = (1.0 - smoothstep(0.3, 0.9, abs(e2.x - 7.0))) * (1.0 - smoothstep(arm2 - 3.0, arm2, e2.y)) * step(2.0, e2.y);
        float br = max(max(h1, v1), 0.55 * max(h2, v2));
        float cg = exp(-length(e2 - vec2(2.4)) / (9.0 * sc)) * 0.10;   // a soft glow gathered in each corner
        float inner = exp(-dE / 9.0) * 0.045 + cg;                          // a breath of light just inside the edge
        // the line is a little brighter where it is not behind text, and a slow shimmer runs along it
        float shim = 0.82 + 0.18 * sin(along * 0.05 - t * 0.9 + sd * 6.0);
        L += mix(cy, wh, 0.35) * (line * 0.40 * shim + tick * 0.40 + br * 0.95 + inner) * (0.40 + 0.60 * act);
    }

    // ---- slow faint scan-line sheen: a wide soft band drifts down the glass, with a fine line pattern in it
    {
        float yb = (fract(t / 13.0 + sd * 0.71) * 1.5 - 0.25) * sz.y;
        float d = (px.y - yb) / (0.16 * sz.y);
        float band = exp(-d * d);
        float lines = 0.45 + 0.55 * (0.5 + 0.5 * sin(px.y * 2.0944 / sc));
        L += mix(cy, wh, 0.2) * band * (0.020 + 0.040 * lines) * clear * (0.30 + 0.70 * act);
    }

    // ---- condensation and frost, margins only; it turns the glass pale and cool, never opaque
    vec3 frostTint = vec3(0.0);
    float frostAmt = 0.0;
    if (inM > 0.0) {
        vec2 q = px / (9.0 * sc) + vec2(sd * 13.0, sd * 5.0) + vec2(t * 0.008, -t * 0.005);
        vec2 f = qp_frost(q);
        float dens = inM * low * cornerK;
        float mist = smoothstep(0.30, 0.85, f.x * 0.7 + dens * 0.55) * smoothstep(0.0, 0.5, dens);
        float cr = f.y * smoothstep(0.1, 0.7, dens);
        frostAmt = (mist * 0.55 + cr * 0.55) * clear;
        frostTint = mix(ice, wh, smoothstep(0.1, 0.8, cr));
        // beads
        vec2 b = qp_beads(px + vec2(sd * 40.0, 0.0), 13.0 * sc, sd);
        float bk = inM * low * clear * smoothstep(0.1, 0.5, dens);
        L += (vec3(0.10, 0.16, 0.19) * b.x + wh * b.y * 0.55) * bk * (0.55 + 0.45 * act);
    }

    // ---- the amber warning light: creeps along the top edge of the focused window, with a long tail and a breathing pip
    {
        float cyc = 15.0;
        float u = fract(t / cyc + sd * 0.53);
        float hx = (u * 1.35 - 0.10) * sz.x;
        float dx = px.x - hx;
        float tail = dx < 0.0 ? exp(dx / (0.17 * sz.x)) : exp(-dx * dx / (2.0 * 7.0 * 7.0));
        float vert = exp(-px.y / 2.0) * 0.90 + exp(-px.y / 14.0) * 0.30;
        float ramp = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.92, 1.0, u));
        float head = exp(-dx * dx / (2.0 * 16.0 * 16.0)) * exp(-px.y / 3.0);
        L += (am * tail * vert * 0.85 + vec3(1.0, 0.86, 0.62) * head * 0.45) * ramp * act;
        // pilot pip, top right, breathing slowly (about 0.2 Hz: no flashing)
        vec2 pc = vec2(sz.x - 18.0 * sc, 15.0 * sc);
        float pd = length(px - pc);
        float breath = 0.5 + 0.5 * sin(t * 1.25 + sd * 6.0);
        float pip = exp(-pd * pd / (2.0 * 1.7 * 1.7)) + exp(-pd / (5.0 * sc)) * 0.20;
        L += mix(am, cy, 1.0 - act) * pip * (0.30 + 0.70 * breath * act + 0.25 * (1.0 - act)) * (0.35 + 0.65 * act) * 0.9;
        // two dim neighbours so it reads as a little status row
        for (int i = 1; i < 3; i++) {
            vec2 qd = px - (pc - vec2(float(i) * 8.0 * sc, 0.0));
            L += cy * exp(-dot(qd, qd) / (2.0 * 1.3 * 1.3)) * 0.28 * (0.3 + 0.7 * act);
        }
    }

    // ---- lay it on. Dark glass takes the light additively, pale glass is tinted instead so it does not vanish into white
    float tot = max(L.r, max(L.g, L.b));
    float pale = smoothstep(0.45, 0.9, lum);
    vec3 lit = c + L * (1.0 - 0.70 * pale);
    vec3 tint = c * (vec3(1.0) - (vec3(1.0) - normalize(L + 1e-4) * 1.2) * clamp(tot * 2.2, 0.0, 0.45));
    c = mix(lit, tint, pale * 0.85);

    // frost: lift and cool dark glass, grey-blue pale glass
    {
        vec3 hazeCol = frostTint * (0.40 + 0.30 * act);
        vec3 onDark = mix(c, c + hazeCol * 0.60, frostAmt * 0.70);
        vec3 onPale = mix(c, c * vec3(0.74, 0.86, 0.94) + vec3(0.0, 0.012, 0.03), frostAmt * 0.85);
        c = mix(onDark, onPale, pale);
    }

    // the unfocused window goes cold and dim: a steel-grey wash, a little less light
    {
        float cold = 1.0 - act;
        vec3 steel = vec3(qp_luma(c)) * vec3(0.90, 0.99, 1.09);
        c = mix(c, steel, 0.22 * cold);
        c *= mix(1.0, 0.94, cold);
    }

    fragColor = vec4(clamp(c, 0.0, 0.99), s.a);
}
