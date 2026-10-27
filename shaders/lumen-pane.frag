#version 300 es
// target: window
// category: Glass
// desc: Lumen pane: glass that carries light; a thin cyan-white rim-light along the top and left edges with a slow amber glint travelling along it, a soft diagonal sweep of light crossing the glass every fourteen seconds or so, a few tiny motes rising and caustic water-light shimmering only in the outer margins; all of it is much stronger on the focused window, and dark, busy or bright text areas are left alone so text stays crisp (animated)
// strength: 65
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
layout(location = 0) out vec4 fragColor;

float lp_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// caustic water-light: a warped net of bright ridges (the light a rippled surface throws on a pool floor), two scales laid over each other
float lp_caustic(vec2 q, float t) {
    vec2 a = q;
    for (int k = 0; k < 3; k++) {
        float fk = float(k);
        a += 0.55 * vec2(sin(a.y * 1.31 + t * (0.55 + 0.17 * fk) + fk * 1.7), cos(a.x * 1.17 - t * (0.47 + 0.13 * fk) + fk * 2.3));
    }
    float n1 = min(abs(sin(a.x * 1.00 + 0.6 * sin(a.y * 1.3 + t * 0.3))), abs(sin(a.y * 0.92 - 0.6 * sin(a.x * 1.1 - t * 0.25))));
    vec2 b = mat2(0.80, -0.60, 0.60, 0.80) * a * 1.6 + 3.1;
    float n2 = min(abs(sin(b.x + 0.5 * sin(b.y * 1.2 - t * 0.35))), abs(sin(b.y - 0.5 * sin(b.x * 1.0 + t * 0.3))));
    return pow(1.0 - n1, 16.0) * 0.9 + pow(1.0 - n2, 20.0) * 0.55;
}

// one layer of rising motes: a cell holds at most one, it sways a little, drifts up and glows in and out
vec3 lp_motes(vec2 px, float cell, float rise, float t, float sd, float lyr) {
    vec2 g = px / cell;
    vec2 id = floor(g);
    vec2 f = fract(g);
    float h = lp_h(id + lyr * 31.7 + sd * 13.0);
    if (h > 0.30) return vec3(0.0);                         // sparse: not every cell has one
    float h2 = lp_h(id + 5.3 + lyr * 11.0);
    float h3 = lp_h(id + 9.1 + lyr * 7.0);
    float ph = fract(h2 + t * rise * (0.7 + 0.6 * h3));     // 0..1 up the cell, wraps invisibly because of the fade
    vec2 m = vec2(0.22 + 0.56 * h3 + 0.10 * sin(t * (0.6 + h2) + h * 40.0), 1.0 - ph);
    float env = sin(3.14159265 * ph);
    env *= env;
    float tw = 0.65 + 0.35 * sin(t * (1.1 + 2.0 * h3) + h2 * 60.0);     // slow twinkle
    float d = length((f - m) * cell);
    float rad = 0.9 + 0.9 * h2;
    float dot_ = exp(-d * d / (2.0 * rad * rad)) + 0.20 * exp(-d / (3.4 * rad));
    return vec3(dot_ * env * tw, h2, h3);
}

// mote colour: mostly cyan-white, now and then an amber one, very rarely a magenta one
vec3 lp_tint(float h) {
    vec3 cy = vec3(0.55, 0.95, 1.0), am = vec3(1.0, 0.70, 0.30), mg = vec3(0.90, 0.40, 0.80);
    return h > 0.96 ? mg : (h > 0.80 ? am : mix(cy, vec3(0.85, 0.99, 1.0), h));
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                              // un-premultiply; the composer re-applies alpha
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    vec2 sz = surface_size;
    float sc = clamp(min(sz.x, sz.y) / 620.0, 0.7, 2.0);
    float lum = lp_luma(c);
    float t = time;

    // keep the text area clear: right next to glyphs and icons (busy) almost nothing, a dark terminal keeps its depth
    vec2 st = vec2(1.7, 1.7) / max(sz, vec2(1.0));
    float a1 = lp_luma(texture(tex, uv + st).rgb);
    float a2 = lp_luma(texture(tex, uv - st).rgb);
    float a3 = lp_luma(texture(tex, uv + vec2(st.x, -st.y)).rgb);
    float a4 = lp_luma(texture(tex, uv - vec2(st.x, -st.y)).rgb);
    float busy = max(max(a1, a2), max(a3, a4)) - min(min(a1, a2), min(a3, a4));
    float clear = (1.0 - 0.92 * smoothstep(0.04, 0.26, busy)) * (1.0 - 0.55 * smoothstep(0.70, 0.95, lum));
    float K = mix(0.20, 1.0, act);                                    // the focused window carries the light

    // distance from the nearest edge and the outer margin (about 8 % of the short side)
    float dE = min(min(px.x, sz.x - px.x), min(px.y, sz.y - px.y));
    float mw = 0.08 * min(sz.x, sz.y);
    float inMargin = 1.0 - smoothstep(mw * 0.55, mw, dE);             // 1 in the margin, fading out toward the middle
    float inMarginWide = 1.0 - smoothstep(mw * 1.1, mw * 1.9, dE);    // the motes may rise a little further in

    vec3 cy = vec3(0.45, 0.92, 1.0);
    vec3 wh = vec3(0.80, 0.97, 1.0);
    vec3 am = vec3(1.0, 0.66, 0.25);

    // collected light: colour already weighted by its intensity; applied once at the end
    vec3 L = vec3(0.0);

    // ---- slow diagonal sweep of light across the glass, a soft wide band, every ~14 s (seed offsets it per window)
    {
        vec2 n = normalize(vec2(0.78, 0.62));
        float ext = dot(sz, abs(n));
        float q = dot(px, n) / ext;                                   // 0..1 across the diagonal
        float wband = 0.13;
        float ph = fract(t / 14.0 + sd);
        float pos = ph * (1.0 + 2.0 * wband) - wband;
        float d = (q - pos) / wband;
        float band = exp(-d * d * 1.6);
        // the leading edge is a touch brighter than the trailing one
        float lead = exp(-pow((q - pos - 0.035) / 0.022, 2.0));
        L += (mix(cy, wh, 0.5) * band * 0.085 + wh * lead * 0.040) * clear * (0.15 + 0.85 * act);
    }

    // ---- caustic water-light, only in the outer margins
    {
        vec2 q = px / (74.0 * sc) + vec2(sd * 19.0, sd * 7.0);
        float cs = inMargin > 0.0 ? lp_caustic(q, t * 0.8) : 0.0;
        // it brightens toward the corners and the lower edge, like light thrown up from water below
        float low = 0.65 + 0.35 * smoothstep(0.35, 1.0, px.y / sz.y);
        L += mix(cy, vec3(0.50, 0.95, 0.92), 0.4) * cs * inMargin * 0.20 * low * clear * K;
    }

    // ---- motes, two parallax layers, sparse, inside the margins only
    {
        vec3 m1 = vec3(0.0), m2 = vec3(0.0);
        if (inMarginWide > 0.0) {
            m1 = lp_motes(px, 58.0 * sc, 0.045, t, sd, 0.0);
            m2 = lp_motes(px + vec2(37.0, 11.0), 34.0 * sc, 0.075, t, sd, 1.0);
        }
        L += lp_tint(m1.z) * m1.x * 0.95 * inMarginWide * clear * K;
        L += lp_tint(m2.z) * m2.x * 0.60 * inMarginWide * clear * K;
    }

    // ---- rim light along the top and left edges, brightest where they meet, with an amber glint travelling along it
    {
        float dTop = px.y, dLeft = px.x;
        float along_top = px.x / sz.x;                                // 0 at the corner .. 1
        float along_left = px.y / sz.y;
        float fadeTop = pow(1.0 - along_top, 0.9) * 0.85 + 0.15;
        float fadeLeft = pow(1.0 - along_left, 0.9) * 0.85 + 0.15;
        float lineTop = exp(-dTop / 0.9) * 0.85 + exp(-dTop / 7.0) * 0.07;
        float lineLeft = exp(-dLeft / 0.9) * 0.85 + exp(-dLeft / 7.0) * 0.07;
        float rim = max(lineTop * fadeTop * step(px.y, px.x + 40.0), lineLeft * fadeLeft * step(px.x, px.y + 40.0));
        rim = max(rim, 0.0);
        // inner glow just inside the edge, a little stronger at the corner
        float corner = exp(-length(px) / (160.0 * sc));
        float glow = (exp(-dTop / 14.0) * fadeTop + exp(-dLeft / 14.0) * fadeLeft) * 0.05 + corner * 0.05;

        // the glint rides the path: up the left edge, then along the top edge, with a long pause off-screen between passes
        float path = sz.y + sz.x;
        float g = (fract(t / 21.0 + sd * 1.7) * 1.5 - 0.25) * path;
        float sPathTop = sz.y + px.x;                                  // distance along the path for a top-edge pixel
        float sPathLeft = sz.y - px.y;                                 // ... and for a left-edge pixel
        float gw = 64.0 * sc;
        float gTop = exp(-pow((sPathTop - g) / gw, 2.0)) * exp(-dTop / 1.3);
        float gLeft = exp(-pow((sPathLeft - g) / gw, 2.0)) * exp(-dLeft / 1.3);
        float gl = max(gTop, gLeft);
        float gHalo = (exp(-pow((sPathTop - g) / (gw * 2.2), 2.0)) * exp(-dTop / 6.0) + exp(-pow((sPathLeft - g) / (gw * 2.2), 2.0)) * exp(-dLeft / 6.0)) * 0.26;
        L += mix(wh, cy, 0.3) * (rim * 0.55 + glow) * (0.30 + 0.70 * act);
        L += (am * gl * 0.85 + am * gHalo + vec3(1.0, 0.92, 0.8) * gl * gl * 0.25) * act;
    }

    // ---- lay the light on. On dark glass it adds; on pale glass it tints instead, so it does not vanish into white
    float tot = max(L.r, max(L.g, L.b));
    float pale = smoothstep(0.45, 0.9, lum);
    vec3 lit = c + L * (1.0 - 0.75 * pale);
    vec3 tint = c * (vec3(1.0) - (vec3(1.0) - normalize(L + 1e-4) * 1.2) * clamp(tot * 2.2, 0.0, 0.40));
    c = mix(lit, tint, pale * 0.85);

    // the unfocused window keeps a quiet cool wash so the focused one clearly stands out
    c = mix(c, c * vec3(0.975, 0.99, 1.012), (1.0 - act) * 0.6);

    fragColor = vec4(clamp(c, 0.0, 0.99), s.a);
}
