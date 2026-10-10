#version 300 es
// target: window
// category: Light
// desc: Firelight: every window is lit by the hearth, warm flicker washes up from the bottom edge with a glowing rim and rising embers; the focused window sits closest to the fire, the pointer pokes the flames (animated)
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

float fl_h(float n) { return fract(sin(n * 127.1 + 31.7) * 43758.5453); }
float fl_n(float x) {
    float i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(fl_h(i), fl_h(i + 1.0), f);
}
float fl_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// lively but smooth firelight level, roughly 0.35 .. 1.0, a few sines and a slow noise at unrelated rates
float fl_flicker(float t, float ph, float lively) {
    float f = 0.62 + 0.13 * sin(t * 2.3 + ph * 6.283)
                   + 0.09 * sin(t * 4.1 + ph * 17.0 + 1.3)
                   + 0.06 * sin(t * 7.3 + ph * 41.0 + 0.4);
    f += (fl_n(t * 1.7 + ph * 90.0) - 0.5) * 0.30 * lively;
    return clamp(f, 0.2, 1.1);
}

void main() {
    vec4 s = texture(tex, v_texcoord);
    float a = s.a;
    vec3 c = s.rgb / max(a, 0.001);               // un-premultiply, the composer re-multiplies
    float S = STRENGTH;
    float k = S / 0.6;                            // 1.0 at the shipped strength

    vec2 size = surface_size;
    vec2 px = v_texcoord * size;
    float sc = clamp(size.y / 560.0, 0.8, 2.0);   // pixel scale so rims and embers keep their look on big windows
    float dB = size.y - px.y;                     // distance up from the bottom edge, px (uv.y = 0 is the top)
    float dL = px.x;
    float dR = size.x - px.x;
    float act = is_active;
    float ph = seed;

    // the pointer is the poker: over the window, flames get livelier and lean toward it
    vec2 pm = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0));
    float over = smoothstep(-0.05, 0.05, pm.x) * smoothstep(1.05, 0.95, pm.x)
               * smoothstep(-0.05, 0.05, pm.y) * smoothstep(1.05, 0.95, pm.y);

    float fk = fl_flicker(time, ph, 1.0 + 0.7 * over);
    float fk2 = fl_flicker(time * 1.35 + 3.0, ph + 0.31, 1.0 + 0.7 * over);   // faster, used by the rim

    // where the hearth sits along the bottom: a per-window bias, drifting slowly, pulled toward the pointer
    float x0 = 0.5 + (ph - 0.5) * 0.5 + 0.10 * sin(time * 0.35 + ph * 9.0);
    x0 = mix(x0, clamp(pm.x, 0.0, 1.0), 0.6 * over);
    float ux = px.x / size.x;
    float horiz = exp(-pow((ux - x0) / 0.55, 2.0));

    // glow: height 18..25% of the window, taller and hotter for the active (closest) window, tongues lick up in places
    float tongue = fl_n(px.x / (110.0 * sc) + time * 0.9 + ph * 50.0) * 0.6
                 + fl_n(px.x / (47.0 * sc) - time * 1.6 + ph * 20.0) * 0.4;
    float gh = size.y * mix(0.17, 0.24, act) * (0.65 + 0.55 * fk) * (0.55 + 0.6 * horiz) * (0.75 + 0.5 * tongue);
    gh *= 1.0 + 0.12 * over;
    float glow = exp(-dB * 2.0 / max(gh, 1.0));
    float wash = exp(-dB / (size.y * 0.7)) * 0.16 * (0.6 + 0.4 * horiz);      // faint warmth over the whole pane

    // colour: active = banked-coal orange to flame yellow at the core; inactive = duskier, redder, further from the fire
    vec3 hot  = mix(vec3(0.90, 0.36, 0.17), vec3(1.00, 0.46, 0.10), act);
    vec3 core = mix(vec3(0.98, 0.52, 0.22), vec3(1.00, 0.70, 0.26), act);
    vec3 tint = mix(hot, core, glow * glow);
    float power = mix(0.62, 0.92, act) * fk * k;
    float lum = fl_luma(c);
    // additive light on dark pixels, warm multiply on light ones, so light themes stay readable and still glow
    vec3 add = tint * (glow * power + wash * power * 1.4) * (1.0 - 0.85 * smoothstep(0.1, 0.9, lum));
    vec3 warm = mix(vec3(1.0), vec3(1.0, 0.84, 0.62), clamp(glow * power * 1.1, 0.0, 0.7));
    c = c * mix(vec3(1.0), warm, smoothstep(0.3, 0.8, lum)) + add;

    // inactive windows sit back in the dusk: a hair cooler and dimmer
    c = mix(c * vec3(0.95, 0.96, 1.0), c, act);

    // rim light along the lower edge and the side nearest the fire
    float wl = pow(1.0 - clamp(x0, 0.0, 1.0), 1.5);
    float wr = pow(clamp(x0, 0.0, 1.0), 1.5);
    float rw = (1.6 + 1.6 * act) * sc;
    float rimNoise = 0.7 + 0.5 * fl_n(px.x / (80.0 * sc) + time * 1.3 + ph * 33.0);
    float rimB = exp(-dB / rw) * (0.45 + 0.55 * horiz) * rimNoise;
    float up = exp(-dB / (size.y * 0.30));
    float rimS = (exp(-dL / rw) * wl + exp(-dR / rw) * wr) * up * (0.7 + 0.5 * fl_n(px.y / (70.0 * sc) - time * 1.1 + ph * 12.0));
    float rim = (rimB + rimS * 1.1) * fk2 * mix(0.45, 0.85, act) * k;
    c += vec3(1.0, 0.55, 0.20) * rim * 0.9 * (1.0 - 0.7 * lum);

    // embers: a few sparks climbing the glass near the side edges
    for (int i = 0; i < 6; i++) {
        float fi = float(i) + ph * 7.0;
        float h1 = fl_h(fi * 1.7), h2 = fl_h(fi * 3.1 + 5.0), h3 = fl_h(fi * 5.3 + 9.0);
        float period = 5.0 + 5.0 * h2;
        float cyc = time / period + h3 * 4.0;
        float lifeId = floor(cyc);
        float life = fract(cyc);
        float jitter = fl_h(lifeId * 1.31 + fi);               // new spot every cycle
        float side = (i % 2 == 0) ? 1.0 : -1.0;
        float ex = side > 0.0 ? (6.0 + (8.0 + 38.0 * jitter) * sc) : size.x - (6.0 + (8.0 + 38.0 * jitter) * sc);
        ex += (sin(time * (1.1 + h1) + fi * 4.0) * 7.0 + sin(time * 2.3 + fi) * 2.5 * life) * sc;
        float ey = size.y - (4.0 + life * size.y * (0.30 + 0.25 * h1));
        float r = (1.5 + 1.1 * h1) * sc * (1.0 - 0.45 * life);
        float d2 = dot(px - vec2(ex, ey), px - vec2(ex, ey));
        float fade = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.55, 1.0, life));
        float twinkle = 0.7 + 0.3 * sin(time * (6.0 + 5.0 * h2) + fi * 9.0);
        float e = (exp(-d2 / (r * r)) + 0.18 * exp(-d2 / (r * r * 14.0))) * fade * twinkle;
        c += mix(vec3(1.0, 0.40, 0.10), vec3(1.0, 0.72, 0.30), 1.0 - life) * e * mix(0.7, 1.3, act) * min(k, 1.4);
    }

    fragColor = vec4(clamp(c, 0.0, 1.0), a);
}
