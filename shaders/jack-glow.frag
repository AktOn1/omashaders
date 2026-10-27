#version 300 es
// target: window
// category: Light
// desc: Jack glow: every window is lit from inside like a jack-o'-lantern, a candle-orange glow breathes along its edges, embers rise from the bottom, a cobweb with a dangling spider hangs in the top corner, violet mist drifts below and a soft lightning flash passes now and then; the focused window burns brightest and the flame leans toward the pointer (animated)
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

float jg_h(float n) { return fract(sin(n * 127.1 + 31.7) * 43758.5453); }
float jg_n(float x) {
    float i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(jg_h(i), jg_h(i + 1.0), f);
}
float jg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec4 s = texture(tex, v_texcoord);
    float a = s.a;
    vec3 c = s.rgb / max(a, 0.001);
    float k = STRENGTH / 0.6;
    float act = is_active;
    float ph = seed;
    vec2 size = surface_size;
    vec2 px = v_texcoord * size;
    float sc = clamp(size.y / 560.0, 0.8, 2.0);

    // candle breathing: slow swell plus a little quick flicker
    float fk = 0.78 + 0.14 * sin(time * 1.3 + ph * 6.283) + 0.06 * sin(time * 3.7 + ph * 11.0) + 0.10 * (jg_n(time * 2.1 + ph * 40.0) - 0.5);

    // the pointer pulls the flame: edges near it glow more
    vec2 pm = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0));
    float over = smoothstep(-0.05, 0.05, pm.x) * smoothstep(1.05, 0.95, pm.x)
               * smoothstep(-0.05, 0.05, pm.y) * smoothstep(1.05, 0.95, pm.y);
    vec2 uvp = px / size;
    float near = exp(-length((uvp - pm) * vec2(size.x / size.y, 1.0)) * 2.2) * over;

    // inner glow from all four edges, uneven like flame tongues
    float dE = min(min(px.x, size.x - px.x), min(px.y, size.y - px.y));
    float tongue = 0.65 + 0.35 * jg_n(px.x / (60.0 * sc) + px.y / (90.0 * sc) + time * 0.8 + ph * 30.0);
    float depth = (18.0 + 16.0 * act) * sc * tongue * (0.8 + 0.4 * fk + 0.5 * near);
    float glow = exp(-dE / depth);
    vec3 tint = mix(vec3(0.95, 0.40, 0.08), vec3(1.00, 0.66, 0.20), glow * glow);
    float power = mix(0.40, 0.80, act) * fk * k;
    float lum = jg_luma(c);
    c += tint * glow * power * (1.0 - 0.8 * smoothstep(0.1, 0.9, lum));
    c = c * mix(vec3(1.0), vec3(1.0, 0.90, 0.78), glow * power * 0.7 * smoothstep(0.3, 0.8, lum));

    // pale violet mist drifting along the bottom edge
    float dB = size.y - px.y;
    float mist = exp(-dB / (size.y * 0.16)) * (0.5 + 0.5 * jg_n(px.x / (140.0 * sc) - time * 0.35 + ph * 20.0));
    c += vec3(0.55, 0.42, 0.80) * mist * 0.16 * k * (1.0 - 0.7 * lum);

    // embers: small sparks rise from the bottom edge, sway and fade
    float emb = 0.0;
    float rise = size.y * (0.30 + 0.10 * act);
    for (int i = 0; i < 22; i++) {
        float fi = float(i);
        float hx = jg_h(fi * 3.1 + ph * 17.0);
        float sp = 0.07 + 0.09 * jg_h(fi * 7.7 + 1.0);
        float life = fract(time * sp + jg_h(fi + 5.0 + ph * 9.0));
        vec2 ep = vec2(hx * size.x + sin(time * 1.6 + fi * 2.7) * 14.0 * sc * life,
                       size.y - 4.0 * sc - life * rise);
        float er = (1.8 + 2.2 * jg_h(fi * 2.3)) * sc * (1.0 - 0.5 * life);
        float d = length(px - ep);
        float fl = 0.6 + 0.4 * sin(time * 9.0 + fi * 5.0);
        emb += smoothstep(er, er * 0.2, d) * (1.0 - life * 0.8) * fl + exp(-d / (er * 3.5)) * 0.35 * (1.0 - life);
    }
    c += mix(vec3(1.0, 0.45, 0.10), vec3(1.0, 0.80, 0.35), 0.5) * emb * (0.45 + 0.4 * act) * min(k, 1.4);

    // cobweb in the top-right corner, with a spider on a thread
    float R = min(130.0 * sc, 0.42 * min(size.x, size.y));
    vec2 cw = vec2(size.x - px.x, px.y);
    float r = length(cw);
    if (r < R && R > 24.0) {
        float seg = 1.5707963 / 5.0;
        float an = atan(cw.y, cw.x);
        float u = an / seg;
        float spoke = abs(fract(u + 0.5) - 0.5) * seg * r;
        float sag = 1.0 + 0.16 * sin(fract(u) * 3.14159);
        float rr = r * sag;
        float ring = min(fract(rr / (R / 6.0)), 1.0 - fract(rr / (R / 6.0))) * (R / 6.0);
        float line = max(smoothstep(0.9 * sc, 0.2, spoke) * smoothstep(R, R * 0.55, r),
                         smoothstep(0.9 * sc, 0.2, ring) * smoothstep(R, R * 0.7, r) * step(R * 0.10, r));
        float lm = jg_luma(c);
        vec3 wc = mix(vec3(0.90, 0.90, 1.0), vec3(0.30, 0.22, 0.42), smoothstep(0.55, 0.85, lm));
        c = mix(c, wc, line * (0.42 + 0.2 * act) * min(k, 1.3));
    }
    if (size.y > 140.0 && size.x > 220.0) {
        float thread = 34.0 * sc;
        float len = (26.0 + 34.0 * (0.5 + 0.5 * sin(time * 0.45 + ph * 6.283))) * sc;
        vec2 sp0 = vec2(size.x - thread, len);
        float tl = smoothstep(0.7 * sc, 0.1, abs(px.x - sp0.x)) * step(px.y, len);
        vec3 wc2 = mix(vec3(0.90, 0.90, 1.0), vec3(0.30, 0.22, 0.42), smoothstep(0.55, 0.85, jg_luma(c)));
        c = mix(c, wc2, tl * 0.5 * min(k, 1.3));
        vec2 sq = (px - sp0 - vec2(0.0, 5.0 * sc)) / sc;
        float sb = min(length(sq / vec2(3.4, 3.0)) - 1.0, length((sq - vec2(0.0, 5.0)) / vec2(4.8, 5.2)) - 1.0);
        float legs = 9.0;
        for (int l = 0; l < 4; l++) {
            float fl = float(l);
            vec2 knee = vec2(7.0 + fl * 1.0, -5.0 + fl * 3.2 + 1.2 * sin(time * 3.0 + fl));
            vec2 foot = vec2(11.0 + fl * 1.2, 3.0 + fl * 3.6 + 2.0 * sin(time * 3.0 + fl));
            vec2 qa = vec2(abs(sq.x), sq.y - 2.0);
            vec2 pa = qa - vec2(2.0, 1.0), ba = knee - vec2(2.0, 1.0);
            float d1 = length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
            pa = qa - knee; ba = foot - knee;
            float d2 = length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
            legs = min(legs, min(d1, d2));
        }
        float body = max(smoothstep(0.5, -0.5, sb), smoothstep(0.9, 0.2, legs));
        vec3 sc3 = vec3(0.07, 0.04, 0.10);
        float hg = smoothstep(1.3, 0.5, length(sq - vec2(0.0, 5.6)));
        sc3 = mix(sc3, vec3(1.0, 0.42, 0.08), hg);
        sc3 += vec3(0.9, 0.4, 0.1) * 0.10 * smoothstep(0.0, 0.5, -sb) ;
        c = mix(c, sc3, body * (0.65 + 0.3 * act));
    }

    // a soft violet flash now and then, like lightning behind the pane
    float lt = fract(time / (9.0 + 5.0 * ph) + ph);
    float flash = (exp(-lt * 90.0) + 0.7 * exp(-abs(lt - 0.045) * 160.0)) * smoothstep(0.0, 0.003, lt);
    c += vec3(0.50, 0.42, 0.95) * flash * 0.14 * k * (0.5 + 0.5 * act) * (1.0 - 0.6 * lum);

    // inactive windows sit further back: a little cooler and dimmer
    c = mix(c * vec3(0.94, 0.94, 1.0), c, act);

    fragColor = vec4(clamp(c, 0.0, 1.0), a);
}
