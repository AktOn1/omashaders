#version 300 es
// target: window
// category: Light
// desc: Star glass: a night sky shows through the dark parts of each window with twinkling stars that shift as the window moves, the focused window is aimed at the sky with a milky way, a lens glint that follows the pointer, and now and then a shooting star (animated)
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

float sg_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 sg_h2(vec2 p) { return vec2(sg_h(p), sg_h(p + 19.19)); }
float sg_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sg_h(i), sg_h(i + vec2(1.0, 0.0)), f.x), mix(sg_h(i + vec2(0.0, 1.0)), sg_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float sg_fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * sg_n(p); p = p * 2.03 + 7.1; a *= 0.5; }
    return v;
}
float sg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// one layer of stars on a pixel grid (q in sky pixels). Each cell may hold one star with its own size, brightness,
// colour and twinkle rate. dens = chance of a star per cell, sz = core radius in px, spikes = faint diffraction cross.
// The light of the pointer lens (lens, 0..1 around the glint) makes the stars it covers a little brighter.
vec3 sg_stars(vec2 q, float cell, float dens, float sz, float sd, float spikes, float lens) {
    vec2 id = floor(q / cell);
    vec2 f = (q / cell - id) * cell;                                       // pixels inside the cell
    float h = sg_h(id + sd);
    if (h > dens) return vec3(0.0);
    vec2 o = (0.28 + 0.44 * sg_h2(id + sd + 4.7)) * cell;                  // keep a margin so a star never gets cut by its cell
    vec2 d = f - o;
    float mag = sg_h(id + sd + 3.3);
    float b = mag * mag * mag;                                             // most are dim, a few shine
    float r = sz * (0.55 + 0.8 * b);
    float core = exp(-dot(d, d) / (2.0 * r * r));
    float halo = exp(-length(d) / (r * 2.6)) * 0.16 * b;
    float sp = 0.0;
    if (spikes > 0.0) {
        float sl = r * 7.0 * (0.4 + b);
        sp = (exp(-abs(d.x) / sl) * exp(-d.y * d.y / 0.5) + exp(-abs(d.y) / sl) * exp(-d.x * d.x / 0.5)) * 0.30 * b * b * spikes;
    }
    // twinkle: dim stars flicker deeply and fast, bright ones barely and slowly
    float rate = 0.7 + 3.2 * sg_h(id + sd + 5.5);
    float ph = 40.0 * h + 6.28 * sg_h(id + sd + 8.1);
    float tw = 1.0 - (0.62 - 0.4 * b) * (0.5 + 0.5 * sin(time * rate + ph)) - 0.12 * sin(time * rate * 2.7 + ph * 1.7);
    float bright = (0.22 + 0.78 * b) * clamp(tw, 0.0, 1.0) * (1.0 + 0.7 * lens);
    // colour temperature: a few blue, mostly white-blue, a few warm
    float ct = sg_h(id + sd + 6.6);
    vec3 col = ct < 0.20 ? vec3(0.55, 0.74, 1.0) : (ct > 0.84 ? vec3(1.0, 0.80, 0.55) : vec3(0.84, 0.92, 1.0));
    return col * (core + halo + sp) * bright;
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float S = STRENGTH / 0.6;                                              // 1.0 at the default 60 %
    float act = is_active;
    vec2 p = uv * surface_size;                                            // physical pixels: stars keep their size
    vec2 px = 1.0 / surface_size;

    // ---- where stars may shine: only on dark pixels, and not near anything bright (text, icons, light themes)
    float l0 = sg_luma(c);
    float nb = 0.0;
    nb = max(nb, sg_luma(texture(tex, uv + vec2(4.0, 0.0) * px).rgb));
    nb = max(nb, sg_luma(texture(tex, uv - vec2(4.0, 0.0) * px).rgb));
    nb = max(nb, sg_luma(texture(tex, uv + vec2(0.0, 4.0) * px).rgb));
    nb = max(nb, sg_luma(texture(tex, uv - vec2(0.0, 4.0) * px).rgb));
    nb = max(nb, sg_luma(texture(tex, uv + vec2(3.0, 3.0) * px).rgb));
    nb = max(nb, sg_luma(texture(tex, uv - vec2(3.0, 3.0) * px).rgb));
    nb = max(nb, sg_luma(texture(tex, uv + vec2(3.0, -3.0) * px).rgb));
    nb = max(nb, sg_luma(texture(tex, uv - vec2(3.0, -3.0) * px).rgb));
    float lum = max(l0, 0.9 * nb);
    float dark = 1.0 - smoothstep(0.10, 0.36, lum);                        // 1 on a dark background, 0 on text and light themes
    dark *= dark;

    // ---- the sky behind this window: it shifts with the window position (parallax) and with the window's seed
    vec2 wpos = window_box.xy;
    vec2 sky = p + vec2(seed * 4100.0, seed * 2300.0);
    vec2 sky1 = sky + wpos * 0.20;                                         // far, tiny stars barely move
    vec2 sky2 = sky * 1.0 + 37.0 + wpos * 0.38;
    vec2 sky3 = sky + 91.0 + wpos * 0.62;                                  // nearer, bigger stars slide the most

    // pointer in window coordinates, 0..1; the lens only exists on the focused window while the pointer is over it
    vec2 m = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0));
    vec2 mp = m * surface_size;
    float inside = act * smoothstep(-0.04, 0.03, m.x) * smoothstep(-0.04, 0.03, m.y) * smoothstep(-0.04, 0.03, 1.0 - m.x) * smoothstep(-0.04, 0.03, 1.0 - m.y);
    float lensArea = inside * exp(-length(p - mp) / 150.0);

    // ---- milky way: a soft diagonal band with patchy light and a dust lane; its position follows the sky coordinates
    vec2 ws = (p + wpos * 0.30 + vec2(seed * 900.0, seed * 500.0)) / 700.0;
    float ang = 0.55;
    vec2 bd = vec2(cos(ang), sin(ang));
    float across = dot(ws, vec2(-bd.y, bd.x)) + 0.18 * sin(dot(ws, bd) * 1.4 + 1.0);
    float along = dot(ws, bd);
    float band = exp(-across * across / 0.16);
    float cloud = sg_fbm(vec2(along * 2.4, across * 5.0) + 3.0);
    float lane = smoothstep(0.54, 0.74, sg_fbm(vec2(along * 3.1 + 5.0, across * 14.0)));
    float mw = band * (0.35 + 1.1 * cloud) * (1.0 - 0.55 * lane * exp(-across * across / 0.05));
    float fine = sg_n(ws * 90.0) * sg_n(ws * 41.0 + 8.0);                  // grainy: unresolved stars
    mw *= 0.7 + 0.9 * fine;

    // ---- stars: three layers, the focused window is aimed at the sky (denser, brighter, with the milky way)
    float densK = mix(0.35, 1.0, act);
    float bandBoost = 1.0 + 1.6 * band * mix(0.3, 1.0, act);
    vec3 st = vec3(0.0);
    st += sg_stars(sky1, 9.0, 0.16 * densK * bandBoost, 0.65, 1.0, 0.0, lensArea) * 0.62;
    st += sg_stars(sky2, 17.0, 0.20 * densK * bandBoost, 0.80, 2.0, 0.0, lensArea) * 0.85;
    st += sg_stars(sky3, 34.0, 0.34 * densK, 1.00, 3.0, act, lensArea) * 1.00;
    st *= mix(0.70, 1.0, act);

    // ---- shooting star: every 15-25 s (a different rhythm per window), crosses the glass in about a second
    float period = 15.0 + 10.0 * sg_h(vec2(seed, 1.7));
    float tc = time + seed * 61.0;
    float cyc = floor(tc / period);
    float tm = tc - cyc * period - 2.0 - (period - 6.0) * sg_h(vec2(cyc, seed + 2.2));
    float dur = 1.15;
    vec3 meteor = vec3(0.0);
    if (tm > 0.0 && tm < dur) {
        vec2 r1 = sg_h2(vec2(cyc, seed * 7.0 + 0.5));
        vec2 r2 = sg_h2(vec2(cyc + 0.5, seed * 3.0 + 9.0));
        float side = r2.y < 0.5 ? 1.0 : -1.0;
        float a = 0.30 + 0.45 * r2.x;
        vec2 dir = vec2(side * cos(a), sin(a));                            // heading down, to the left or right
        float span = 0.55 * max(surface_size.x, 300.0);
        vec2 start = vec2(surface_size.x * (side > 0.0 ? 0.04 + 0.35 * r1.x : 0.96 - 0.35 * r1.x), surface_size.y * (0.04 + 0.35 * r1.y));
        float u = tm / dur;
        vec2 head = start + dir * span * (1.0 - pow(1.0 - u, 1.6));
        vec2 rel = p - head;
        float back = -dot(rel, dir);                                       // distance behind the head
        float perp = abs(dot(rel, vec2(-dir.y, dir.x)));
        float len = 40.0 + 110.0 * sin(3.14159 * u);                       // the tail grows, then fades out
        float tail = step(0.0, back) * exp(-back / (len * 0.45)) * smoothstep(len * 1.6, len * 0.8, back);
        float wid = 0.55 + 0.045 * back * 0.25;
        float line = exp(-perp * perp / (2.0 * wid * wid));
        float headG = exp(-dot(rel, rel) / 5.0);
        float env = smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.65, u);
        meteor = (vec3(0.78, 0.90, 1.0) * (tail * line * 0.85 + 0.15 * tail * exp(-perp / 5.0)) + vec3(1.0, 0.95, 0.85) * headG * 0.9) * env * mix(0.55, 1.0, act);
    }

    // ---- the lens glint: small anamorphic streak, a faint ring (brass) and a cold core, following the pointer
    vec3 glint = vec3(0.0);
    if (inside > 0.001) {
        vec2 d = p - mp;
        float dl = length(d);
        float streak = exp(-abs(d.x) / 70.0) * exp(-d.y * d.y / 2.2);
        float streak2 = exp(-abs(d.x) / 22.0) * exp(-d.y * d.y / 6.0);
        float core = exp(-dl * dl / 28.0);
        float ring = exp(-pow((dl - 34.0) / 2.6, 2.0)) * (0.55 + 0.45 * sin(atan(d.y, d.x) * 2.0 + 1.0));
        float ring2 = exp(-pow((dl - 56.0) / 1.8, 2.0)) * 0.5;
        float breathe = 0.85 + 0.15 * sin(time * 0.9);
        glint = (vec3(0.45, 0.65, 1.0) * streak * 0.55 + vec3(0.80, 0.90, 1.0) * (streak2 * 0.5 + core * 0.45)
                + vec3(1.0, 0.78, 0.46) * ring * 0.20 + vec3(0.55, 0.68, 1.0) * ring2 * 0.14) * inside * breathe;
    }

    // ---- compose: everything only adds light, weighted by darkness, capped so nothing outshines text
    vec3 deep = vec3(0.30, 0.38, 0.75);                                    // milky way glow colour
    vec3 add = st + meteor;
    add = min(add, vec3(0.80));
    vec3 glow = deep * mw * mix(0.012, 0.10, act) * (1.0 + 0.8 * lensArea);
    glow += vec3(0.012, 0.022, 0.060) * mix(0.35, 1.0, act);               // a faint indigo depth in the dark glass itself
    glint = min(glint, vec3(0.65));
    float gdark = 1.0 - smoothstep(0.15, 0.55, l0);                        // the soft glow only needs the pixel itself to be dark, so there is no halo around text
    vec3 total = (add * S + glint * S) * dark + glow * S * gdark;
    c = 1.0 - (1.0 - c) * (1.0 - clamp(total, 0.0, 0.9));                  // screen blend: never darker, never clips
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
