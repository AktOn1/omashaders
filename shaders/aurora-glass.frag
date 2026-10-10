#version 300 es
// target: window
// category: Light
// desc: Aurora glass: a faint, slow-looking green-teal ribbon of northern light hangs along the top of the window glass over the dark areas, a few faint stars sit in the darkest spots, cool tint; brighter and clearer on the focused window, every window gets its own ribbon from its seed; text and light themes stay untouched (static)
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
uniform vec2 mouse;
uniform vec4 window_box;
layout(location = 0) out vec4 fragColor;

float ag_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ag_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(ag_h(i), ag_h(i + vec2(1.0, 0.0)), f.x), mix(ag_h(i + vec2(0.0, 1.0)), ag_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float ag_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                              // un-premultiply; the composer re-applies alpha
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    float lum = ag_luma(c);
    float dark = 1.0 - smoothstep(0.10, 0.50, lum);                   // light themes and text: nothing is added
    float deep = 1.0 - smoothstep(0.03, 0.15, lum);                   // the darkest areas, for the stars

    // the ribbon: a wavy upper edge near the top of the glass, light hanging down from it and fading out
    float H = surface_size.y;
    float base = clamp(H * (0.05 + 0.06 * sd), 20.0, 70.0);
    float ph = sd * 6.28;
    float x = px.x;
    float wave = 14.0 * sin(x / 210.0 + ph) + 7.0 * sin(x / 83.0 + ph * 2.3) + 5.0 * (ag_n(vec2(x / 120.0, sd * 9.0)) - 0.5);
    float edge = base + wave;
    float fall = clamp(H * 0.30, 90.0, 230.0);                        // how far the curtain hangs down
    float dy = px.y - edge;
    float hang = smoothstep(-10.0, 3.0, dy) * exp(-max(dy, 0.0) / (fall * 0.42));
    float rays = 0.65 + 0.35 * ag_n(vec2(x / 11.0 + sd * 30.0, dy / 190.0));
    float broad = 0.35 + 0.65 * smoothstep(0.25, 0.75, ag_n(vec2(x / 330.0 + sd * 17.0, 2.0)));
    // the pointer brightens the ribbon a little near it
    vec2 mp = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0)) * surface_size;
    float near = exp(-pow((x - mp.x) / 170.0, 2.0)) * exp(-pow((px.y - mp.y) / 260.0, 2.0));
    float ribbon = hang * rays * broad * (1.0 + 0.5 * near);
    float hue = clamp(dy / fall, 0.0, 1.0) * 0.8 + 0.25 * sin(x / 260.0 + ph);
    vec3 lo = vec3(0.16, 0.92, 0.55);                                 // aurora green
    vec3 hi = vec3(0.14, 0.70, 0.86);                                 // teal
    vec3 rc = mix(lo, hi, clamp(hue, 0.0, 1.0));
    float gain = mix(0.17, 0.27, act);
    c += rc * ribbon * gain * (0.03 + 0.97 * dark);

    // cool tint on the dark parts, a hint of teal in the shadows near the top
    float topL = 1.0 - smoothstep(0.0, H * 0.6, px.y);
    c = mix(c, c * vec3(0.92, 1.0, 1.04) + vec3(0.0, 0.006, 0.012), 0.55 * dark * mix(0.7, 1.0, act));
    c += vec3(0.004, 0.022, 0.020) * topL * dark * mix(0.6, 1.0, act);

    // a few faint stars, only in the darkest areas (static, so nothing flickers)
    float cell = 38.0;
    vec2 q = px / cell + vec2(sd * 40.0);
    vec2 id = floor(q);
    vec2 f = (fract(q) - 0.5) * cell;
    float hh = ag_h(id + 7.0);
    if (hh > 0.945) {
        vec2 o = (vec2(ag_h(id + 1.1), ag_h(id + 5.3)) - 0.5) * cell * 0.5;
        float r = 0.8 + 0.5 * ag_h(id + 9.1);
        float st = exp(-dot(f - o, f - o) / (2.0 * r * r)) * (0.35 + 0.65 * ag_h(id + 3.3));
        c += vec3(0.78, 0.92, 1.0) * st * deep * mix(0.20, 0.34, act);
    }

    // the focused window also gets a thin cool light along its top edge
    float topEdge = smoothstep(2.5, 0.0, px.y);
    c += vec3(0.30, 0.80, 0.80) * topEdge * act * 0.05 * (0.5 + 0.5 * dark);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
