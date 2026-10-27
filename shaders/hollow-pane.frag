#version 300 es
// target: window
// category: Light
// desc: Hollow pane: every window sits in a quiet night. A cold moon-grey mist drifts slowly along its lower edge, a far lamp breathes amber in one corner, a few warm motes float up through the dark parts, and the focused window gets a faint cold rim light. Only dark areas are touched, so text stays clear (animated)
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

float hp_h(float n) { return fract(sin(n * 127.1 + 31.7) * 43758.5453); }
float hp_h2(vec2 v) { return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453); }
float hp_n(vec2 x) {
    vec2 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hp_h2(i), hp_h2(i + vec2(1.0, 0.0)), f.x), mix(hp_h2(i + vec2(0.0, 1.0)), hp_h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float hp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec4 s = texture(tex, v_texcoord);
    float a = s.a;
    vec3 c = s.rgb / max(a, 0.001);
    float k = STRENGTH / 0.55;
    float act = is_active;
    float ph = seed;
    vec2 size = surface_size;
    vec2 px = v_texcoord * size;
    float sc = clamp(size.y / 560.0, 0.8, 2.0);
    float lum = hp_luma(c);
    float dark = 1.0 - smoothstep(0.15, 0.75, lum);

    // pointer over the window wakes the mist and the lamp a little
    vec2 pm = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0));
    float over = smoothstep(-0.05, 0.05, pm.x) * smoothstep(1.05, 0.95, pm.x)
               * smoothstep(-0.05, 0.05, pm.y) * smoothstep(1.05, 0.95, pm.y);

    // slow mist along the lower edge: two layers drifting in opposite directions
    float dB = size.y - px.y;
    vec2 mp = vec2(px.x / (260.0 * sc), px.y / (150.0 * sc));
    float m = 0.6 * hp_n(mp + vec2(time * 0.030 + ph * 9.0, 0.0)) + 0.4 * hp_n(mp * 1.9 + vec2(-time * 0.022, 4.0 + ph * 5.0));
    float shelf = exp(-dB / (size.y * 0.20));
    float mist = smoothstep(0.30, 0.78, m) * shelf;
    c += vec3(0.46, 0.55, 0.66) * mist * 0.20 * k * dark * (0.8 + 0.4 * act);

    // a far lamp in the bottom-left corner, breathing slowly
    vec2 lampc = vec2(0.0, size.y);
    float dl = length(px - lampc) / (min(size.x, size.y) * 0.85);
    float br = 0.78 + 0.16 * sin(time * 0.9 + ph * 6.283) + 0.06 * hp_n(vec2(time * 1.6, ph * 20.0));
    float lamp = exp(-dl * dl * 3.2) * br * (0.7 + 0.5 * act + 0.3 * over);
    c += vec3(0.95, 0.58, 0.24) * lamp * 0.17 * k * dark;

    // a few warm motes float up through the dark parts, swaying and fading
    float mo = 0.0;
    for (int i = 0; i < 10; i++) {
        float fi = float(i);
        float sp = 0.035 + 0.045 * hp_h(fi * 7.7 + 1.0);
        float life = fract(time * sp + hp_h(fi + 5.0 + ph * 9.0));
        vec2 ep = vec2(hp_h(fi * 3.1 + ph * 17.0) * size.x + sin(time * 0.8 + fi * 2.7) * 18.0 * sc * life,
                       size.y * (0.98 - 0.80 * life));
        float er = (1.5 + 1.8 * hp_h(fi * 2.3)) * sc * (1.0 - 0.4 * life);
        float d = length(px - ep);
        float fl = 0.6 + 0.4 * sin(time * 2.4 + fi * 5.0);
        mo += (smoothstep(er, er * 0.2, d) + exp(-d / (er * 4.0)) * 0.30) * sin(life * 3.14159) * fl;
    }
    c += vec3(1.0, 0.70, 0.36) * mo * 0.30 * min(k, 1.4) * dark;

    // faint cold rim light on the focused window, breathing very slowly
    float dE = min(min(px.x, size.x - px.x), min(px.y, size.y - px.y));
    float rim = exp(-dE / (2.5 * sc)) * (0.65 + 0.35 * sin(time * 0.5 + ph * 6.283));
    c += vec3(0.52, 0.72, 0.80) * rim * 0.26 * k * act;

    // inactive windows sit further back: a little cooler and dimmer
    c = mix(c * vec3(0.94, 0.96, 1.0), c, act);

    fragColor = vec4(clamp(c, 0.0, 1.0), a);
}
