#version 300 es
// target: window
// category: Glass
// desc: Rite pane: black lacquer glass; a deep glossy gradient with a diagonal lacquer reflection, one slow candle-lit streak of warm light lying across the glass (its place differs from window to window), a faint oxblood tinge gathered in the outer margins, and a hairline of polished brass inset ten pixels from the edge, broken at each corner by a small diamond ornament with a notch; the focused window is lit and brassy, unfocused windows fall back to dim oxblood-brown. Text and busy areas are left untouched, pale windows are tinted rather than lit
// strength: 65
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
layout(location = 0) out vec4 fragColor;

float rp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float rp_h(float n) { return fract(sin(n * 12.9898 + 4.2) * 43758.5453); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                              // un-premultiply; the composer re-applies alpha
    float act = is_active;
    float sd = fract(seed);
    vec2 sz = surface_size;
    vec2 px = uv * sz;
    float sc = clamp(min(sz.x, sz.y) / 620.0, 0.8, 1.8);
    float lum = rp_luma(c);

    // keep the text area clear: next to glyphs and icons (busy) almost nothing; very pale glass is touched less
    vec2 st = vec2(1.7, 1.7) / max(sz, vec2(1.0));
    float a1 = rp_luma(texture(tex, uv + st).rgb);
    float a2 = rp_luma(texture(tex, uv - st).rgb);
    float a3 = rp_luma(texture(tex, uv + vec2(st.x, -st.y)).rgb);
    float a4 = rp_luma(texture(tex, uv - vec2(st.x, -st.y)).rgb);
    float busy = max(max(a1, a2), max(a3, a4)) - min(min(a1, a2), min(a3, a4));
    float clear = (1.0 - 0.94 * smoothstep(0.035, 0.22, busy)) * (1.0 - 0.55 * smoothstep(0.62, 0.95, lum));
    float dark = 1.0 - smoothstep(0.10, 0.55, lum);                   // lacquer gloss lives on dark glass

    vec2 e2 = min(px, sz - px);
    float dE = min(e2.x, e2.y);                                       // distance to the nearest edge
    float K = mix(0.34, 1.0, act);

    const vec3 oxb = vec3(0.42, 0.03, 0.05);
    const vec3 brass = vec3(0.86, 0.65, 0.26);
    const vec3 amber = vec3(1.0, 0.55, 0.18);
    const vec3 bone = vec3(0.95, 0.88, 0.78);
    vec3 dimBrass = vec3(0.40, 0.25, 0.17);                          // a cold, tarnished brown for the unfocused window
    vec3 brassC = mix(dimBrass, brass, act);

    vec3 L = vec3(0.0);                                               // light added
    vec3 M = vec3(1.0);                                               // multiplicative darkening (lacquer)

    // ---- lacquer: the glass deepens toward the bottom, and a broad diagonal reflection lies over the upper left
    {
        float dv = uv.y;
        M *= 1.0 - 0.20 * smoothstep(0.45, 1.0, dv) * clear * dark;
        float dg = (px.y + 0.55 * px.x) / (sz.y + 0.55 * sz.x);       // 0 at the top left corner, 1 at the bottom right
        float edge = 0.40 + 0.06 * (rp_h(sd * 9.0) - 0.5);
        float refl = 1.0 - smoothstep(edge - 0.012, edge + 0.012, dg);      // a hard-edged reflection of a lit room
        float fall = 1.0 - smoothstep(0.0, edge, dg) * 0.55;          // brightest near the edge, thinning toward the corner
        L += vec3(0.95, 0.78, 0.62) * refl * fall * 0.050 * clear * dark * K;
        // a second, much fainter band, a reflection's echo
        float e2b = edge + 0.15;
        float refl2 = (1.0 - smoothstep(e2b, e2b + 0.006, dg)) * smoothstep(e2b - 0.05, e2b - 0.04, dg);
        L += vec3(0.95, 0.78, 0.62) * refl2 * 0.022 * clear * dark * K;
    }

    // ---- the candle streak: a warm slanted band of light, placed differently on every window
    {
        vec2 dirS = normalize(vec2(0.62, -0.78));                     // the streak runs up and to the right
        vec2 perp = vec2(dirS.y, -dirS.x);
        float along = dot(px - 0.5 * sz, dirS);
        float across = dot(px - 0.5 * sz, perp);
        float span = 0.5 * length(sz);
        float cp = (0.12 + 0.50 * rp_h(sd * 5.0 + 1.0) - 0.30) * span;  // where it lies across the glass
        float dw = (across - cp) / (0.085 * span + 20.0 * sc);
        float band = exp(-dw * dw);
        float core = exp(-dw * dw * 28.0);
        // it flares unevenly along its length, as light through old lacquer does
        float flare = 0.55 + 0.45 * sin(along / (70.0 * sc) + sd * 20.0) * sin(along / (173.0 * sc) + 1.3 + sd * 7.0);
        float fadeEnds = smoothstep(-span, -0.2 * span, along) * (1.0 - smoothstep(0.2 * span, span, along));
        vec3 streak = amber * (band * 0.085) + mix(amber, bone, 0.55) * core * 0.055;
        L += streak * flare * fadeEnds * clear * dark * K;
    }

    // ---- oxblood in the outer margins: a faint deep-red tinge, strongest in the corners
    float mw = clamp(0.085 * min(sz.x, sz.y), 18.0, 80.0);
    {
        float inM = 1.0 - smoothstep(mw * 0.20, mw * 1.7, dE);
        float cornerK = 1.0 + 0.8 * exp(-length(e2) / (mw * 1.5));
        float v = inM * cornerK;
        L += oxb * v * 0.15 * clear * dark * K;
        M *= 1.0 - 0.12 * v * clear * K;
    }

    // ---- brass hairline, 1 px, ten pixels in from the edge, with a diamond and a notch at each corner
    float lineA = 0.0;                                                // coverage of the brass drawing
    float lineHi = 0.0;                                               // how hot it is (specular)
    {
        float inset = 10.0 * sc;
        vec2 qa = e2 - vec2(inset);                                   // (>= 0 on the inner side)
        float dvLine = abs(qa.x) + (qa.y < -0.5 ? 1e3 : 0.0);
        float dhLine = abs(qa.y) + (qa.x < -0.5 ? 1e3 : 0.0);
        float dl = min(dvLine, dhLine);
        // the corner: where both coordinates are near the inset, a gap of `gap` pixels on each arm opens for the ornament
        float gap = 9.0 * sc;
        vec2 cd = e2 - vec2(inset);                                   // position along the arms measured from the corner point
        float notch = 1.0;
        // along a horizontal arm (dhLine), cd.x is the distance from the corner; along a vertical arm cd.y is
        if (dhLine <= dvLine) notch = smoothstep(gap - 0.5, gap + 0.5, cd.x);
        else notch = smoothstep(gap - 0.5, gap + 0.5, cd.y);
        float line = (1.0 - smoothstep(0.35, 0.95, dl)) * notch;

        // corner ornament: a hollow diamond sitting on the corner point, a dot inside and two short ticks pointing along the arms
        vec2 oc = cd;                                                 // the corner point is at cd = (0, 0)
        float dm = abs(oc.x) + abs(oc.y);                             // diamond metric
        float rD = 4.6 * sc;
        float diamond = 1.0 - smoothstep(0.30, 0.95, abs(dm - rD) * 0.7071);
        float dot0 = 1.0 - smoothstep(0.6, 1.4, length(oc) - 0.4 * sc);
        // a small outer notch: a second, smaller diamond tip outside the main one, toward the window corner
        vec2 on = oc - vec2(-3.4 * sc);
        float dm2 = abs(on.x) + abs(on.y);
        float outer = (1.0 - smoothstep(0.25, 0.85, abs(dm2 - 1.9 * sc) * 0.7071)) * step(oc.x, 0.0) * step(oc.y, 0.0);
        float orn = max(diamond, max(dot0 * 0.9, outer * 0.85));
        // only the corner ornament, not anywhere else along the line
        float nearCorner = (1.0 - smoothstep(rD * 1.4, rD * 1.4 + 2.0, max(abs(oc.x), abs(oc.y))));
        orn *= nearCorner;

        float draw = max(line, orn);
        // the brass is brighter where the candle streak light would fall: upper left, fading toward the lower right
        float candle = 0.75 + 0.25 * (1.0 - (px.x / sz.x + px.y / sz.y) * 0.5);
        lineA = draw * candle;
        lineHi = draw * (0.5 + 0.5 * sin(dot(px, vec2(0.021, 0.014)) * 6.0 + sd * 12.0));
        // a faint inner glow just inside the line
        L += brassC * exp(-max(dl, 0.0) / (2.2 * sc)) * 0.025 * clear * K * step(0.0, qa.x + 1.0) * step(0.0, qa.y + 1.0);
    }
    float lineGate = 0.45 + 0.55 * clear;                             // the line stays visible but does not cut through text
    L += (brassC * lineA * 0.70 + bone * lineHi * lineA * 0.16 * act) * lineGate * (0.45 + 0.55 * act);

    // ---- lay it on. Dark glass takes the light additively, pale glass is tinted instead so it does not vanish into white
    float tot = max(L.r, max(L.g, L.b));
    float pale = smoothstep(0.45, 0.9, lum);
    vec3 lit = c * M + L * (1.0 - 0.60 * pale);
    vec3 tint = c * (vec3(1.0) - (vec3(1.0) - normalize(L + 1e-4) * 1.15) * clamp(tot * 2.0, 0.0, 0.45)) * M;
    c = mix(lit, tint, pale * 0.85);

    // the unfocused window loses its warmth: a little brown-grey, a little less light
    {
        float cold = 1.0 - act;
        vec3 mono = vec3(rp_luma(c)) * vec3(1.05, 0.95, 0.88);
        c = mix(c, mono, 0.16 * cold * clear);
        c *= mix(1.0, 0.96, cold);
    }

    fragColor = vec4(clamp(c, 0.0, 0.99), s.a);
}
