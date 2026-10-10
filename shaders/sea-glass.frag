#version 300 es
// target: window
// category: Glass
// desc: Sea glass: a frosted, soft green-blue pane with faint frosted grain that gathers near the edges and a soft caustic-like band of light along the top; the focused window is clearer, every window gets its own tint, grain and light pattern (static)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
uniform vec2 mouse;
uniform vec4 window_box;
layout(location = 0) out vec4 fragColor;

float sg_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sg_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sg_h(i), sg_h(i + vec2(1.0, 0.0)), f.x), mix(sg_h(i + vec2(0.0, 1.0)), sg_h(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                              // un-premultiply; the composer re-applies alpha
    float K = STRENGTH * 1.8182;                                      // 1.0 at the default strength
    float act = is_active;
    float sd = fract(seed);

    vec2 px = uv * surface_size;
    vec2 off = vec2(sd * 731.0, sd * 513.0);
    float edge = min(min(px.x, surface_size.x - px.x), min(px.y, surface_size.y - px.y));
    float rim = exp(-edge / 46.0);                                    // 1 at the edge, fading over ~100 px; the middle stays clear

    // tint: every pane leans a little differently between sea green and blue-teal
    vec3 tint = mix(vec3(0.58, 0.86, 0.74), vec3(0.55, 0.80, 0.90), sd);
    float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float clear = mix(1.0, 0.55, act);                                // the focused window is clearer
    c = mix(c, c * (tint * 0.55 + 0.47) + tint * 0.05 * (1.0 - L), 0.52 * K * clear);
    c += tint * 0.075 * K * clear * (1.0 - L);                        // a hint of sea in the dark parts only, text keeps its contrast

    // frosted grain, strongest at the edges, finer than the eye follows; static (no flicker)
    vec2 g = px + off;
    float grain = sg_n(g * 0.55) * 0.5 + sg_n(g * 1.3 + 7.0) * 0.5;
    float fr = (grain - 0.5) * 0.13 * K * clear * (0.12 + 0.88 * rim);
    c += vec3(fr) * vec3(0.95, 1.0, 1.0);
    c = mix(c, c + (vec3(0.80, 0.93, 0.90) - c) * 0.16, rim * 0.8 * K * clear);   // frost haze gathers at the border

    // caustic-like band of light under the top edge: a soft wavy region with a few thin bright threads in it
    float u = px.x / max(surface_size.x, 1.0);
    float wav = sg_n(vec2(u * 5.0 + sd * 9.0, sd * 3.0)) * 0.55 + sg_n(vec2(u * 13.0 - sd * 5.0, 4.0 + sd)) * 0.25;
    float bandH = (0.07 + 0.09 * wav) * min(surface_size.y, 900.0) + 14.0;
    float band = smoothstep(bandH, 0.0, px.y);
    float thread = 1.0 - abs(2.0 * sg_n(vec2(px.x * 0.018 + sd * 40.0, px.y * 0.030 + u * 2.0 + 3.0)) - 1.0);
    thread = pow(thread, 7.0) * band;
    vec3 light = vec3(0.86, 1.0, 0.96);
    c += light * (band * band * 0.06 + thread * 0.11) * K * mix(0.8, 1.2, act);

    // the pointer leaves a soft glint when it is over the glass
    vec2 mp = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0)) * surface_size;
    float dm = length(px - mp);
    c += light * exp(-dm * dm / (2.0 * 70.0 * 70.0)) * 0.018 * K;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
