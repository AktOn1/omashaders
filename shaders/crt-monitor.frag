#version 300 es
// target: window
// category: Glass
// desc: CRT monitor: every window is its own little tube with a fine raster, warm phosphor glow, a slowly rolling refresh band on its own phase, corner shading and a glass glint; the focused one is bright and crisp, idle ones dim, a moved one jitters and splits, and the pointer leaves a static glow (animated)
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
uniform float is_moving;
layout(location = 0) out vec4 fragColor;

float crt_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float crt_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// screen blend: lifts light and dark alike but never clips
vec3 crt_screen(vec3 c, vec3 add) { return c + (1.0 - c) * clamp(add, 0.0, 1.0); }

void main() {
    vec2 uv = v_texcoord;
    float S = STRENGTH;
    float k = S / 0.6;                                       // 1.0 at the shipped default
    float act = is_active;
    vec2 size = max(surface_size, vec2(1.0));
    vec2 px = 1.0 / size;
    vec2 p = uv * size;                                      // surface pixels: raster keeps its physical pitch
    float row = floor(p.y);

    // each monitor has its own refresh phase and speed, so a wall of them never beats in step
    float spd = mix(38.0, 80.0, act) * (0.75 + 0.5 * fract(seed * 7.31));      // px per second
    float travel = size.y + 220.0;
    float bandY = mod(time * spd + seed * 3.7 * travel, travel) - 140.0;      // px; scrolls downwards
    float bd = p.y - bandY;                                  // below the band centre: positive
    float bw = mix(46.0, 34.0, act);
    float band = exp(-pow(max(-bd, 0.0) / (bw * 1.9), 2.0)) * exp(-pow(max(bd, 0.0) / (bw * 0.55), 2.0));  // sharp leading edge, long fading tail above

    // horizontal jitter: tiny wobble riding the band, a rare hiccup of the hold, and a bigger shake when the window is dragged
    float tq = floor(time * 24.0);
    float wob = (crt_h(vec2(row * 0.5, tq + seed * 31.0)) - 0.5);
    float jit = wob * band * mix(0.7, 1.1, act);
    float hp = mod(time + seed * 41.0, 19.0 + seed * 9.0);                     // hiccup every ~20 s, lasts 0.25 s
    float hic = step(hp, 0.25) * smoothstep(0.0, 0.04, hp) * exp(-pow((p.y / size.y - fract(seed * 5.0 - hp * 1.3)) * 14.0, 2.0));
    jit += hic * (1.2 + 2.5 * crt_h(vec2(row, tq)));
    float mv = step(0.5, is_moving);
    jit += mv * (crt_h(vec2(floor(p.y / 2.0), tq)) - 0.5) * 3.5;
    vec2 ju = uv + vec2(jit * min(k, 1.0) * px.x, 0.0);

    vec4 s = texture(tex, ju);
    vec3 c = s.rgb;
    if (mv > 0.5) {                                           // a moved monitor: the guns drift apart a little
        c.r = texture(tex, ju + vec2(1.3 * px.x, 0.0)).r;
        c.b = texture(tex, ju - vec2(1.3 * px.x, 0.0)).b;
    }

    // phosphor glow: five close taps + a horizontal smear, additive, warm and weak
    vec3 bl = texture(tex, ju + vec2(3.0, 0.0) * px).rgb + texture(tex, ju - vec2(3.0, 0.0) * px).rgb
            + texture(tex, ju + vec2(0.0, 3.0) * px).rgb + texture(tex, ju - vec2(0.0, 3.0) * px).rgb;
    vec3 wide = texture(tex, ju + vec2(7.0, 0.0) * px).rgb + texture(tex, ju - vec2(7.0, 0.0) * px).rgb;
    vec3 glow = (bl * 0.16 + wide * 0.10 + c * 0.16);
    float gl = crt_luma(glow);
    float thr = smoothstep(0.30, 0.85, gl);                   // only what is already bright blooms
    vec3 warm = vec3(1.0, 0.86, 0.62);
    float head = 1.0 - smoothstep(0.55, 1.0, crt_luma(c));      // light backgrounds have no headroom: the glow fades out there
    c = crt_screen(c, mix(glow, vec3(gl), 0.35) * warm * thr * head * mix(0.24, 0.42, act) * k);

    // raster: one dark line every 3 px, never more than ~10% at the default; the idle tube has a softer, shallower one
    float ph = fract(p.y / 3.0);
    float sl = 0.5 - 0.5 * cos(6.2831853 * ph);               // 0 on the bright row, 1 on the dark one
    float lum = crt_luma(c);
    float scan = mix(0.062, 0.100, act) * k * (1.0 - 0.45 * smoothstep(0.5, 1.0, lum));   // bright text keeps its body
    c *= 1.0 - scan * sl;

    // refresh band: a gentle lift with a slightly brighter leading edge
    float edge = exp(-pow(bd / 3.5, 2.0));
    c *= 1.0 + band * mix(0.055, 0.115, act) * k * (1.0 - 0.9 * smoothstep(0.6, 1.0, lum));
    c = crt_screen(c, warm * (band * mix(0.026, 0.050, act) + edge * band * mix(0.0, 0.030, act)) * k);

    // tube-to-tube flicker and a trace of grain on the raster: ~1%
    float fl = 1.0 + 0.010 * k * (sin(time * 61.0 + seed * 20.0) * 0.5 + sin(time * 17.0 + seed * 9.0) * 0.5)
                   + 0.006 * k * (crt_h(vec2(row, tq + seed * 5.0)) - 0.5) * band;
    c *= fl;

    // idle tubes burn dimmer: about -12% at the default
    c *= 1.0 - 0.20 * S * (1.0 - act);

    // corner shading, pixel-sized (~24 px), plus a whisper along the rim
    vec2 e = min(p, size - p);
    float cx = 1.0 - smoothstep(0.0, 24.0, e.x), cy = 1.0 - smoothstep(0.0, 24.0, e.y);
    float rim = 1.0 - smoothstep(0.0, 8.0, min(e.x, e.y));
    c *= 1.0 - (0.17 * cx * cy + 0.035 * rim) * k;

    // glass: a soft diagonal glint in the upper-left corner, with a thin twin beside it
    float sum = p.x + p.y;
    float along = abs(p.x - p.y);
    float streak = exp(-pow((sum - 78.0) / 11.0, 2.0)) + 0.45 * exp(-pow((sum - 112.0) / 3.0, 2.0));
    streak *= smoothstep(95.0, 15.0, along) * mix(0.55, 1.0, act);
    c = crt_screen(c, vec3(0.92, 0.96, 1.0) * streak * 0.085 * k);

    // static charge: the pointer brightens the glass beneath it, with a few crackling specks
    vec2 m = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0));
    float inside = smoothstep(-0.02, 0.02, m.x) * smoothstep(1.02, 0.98, m.x) * smoothstep(-0.02, 0.02, m.y) * smoothstep(1.02, 0.98, m.y);
    float dm = length(p - m * size);
    float charge = exp(-pow(dm / 85.0, 2.0)) * inside;
    float spk = step(0.93, crt_h(floor(p / 2.0) + tq * 0.37)) * exp(-pow(dm / 60.0, 2.0)) * inside;
    c = crt_screen(c, vec3(1.0, 0.80, 0.52) * (charge * 0.055 + spk * 0.035) * k);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
