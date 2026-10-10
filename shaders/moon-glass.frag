#version 300 es
// target: window
// category: Glass
// desc: Moon glass: cool silver sheen slides across the window like moonlight on a pane, a soft pale halo glows in one corner and a faint breath of mist rests along the bottom edge; brighter on the focused window, every window gets its own angle and corner from its seed, text stays crisp (static)
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

float mg_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mg_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mg_h(i), mg_h(i + vec2(1.0, 0.0)), f.x), mix(mg_h(i + vec2(0.0, 1.0)), mg_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float mg_fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * mg_n(p); p = p * 2.03 + 11.0; a *= 0.5; }
    return v;
}
float mg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                              // un-premultiply; the composer re-applies alpha
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    float D = max(surface_size.x, surface_size.y);
    float lum = mg_luma(c);
    // light areas and text get far less: the sheen is a veil over the glass, not over the content
    float room = 1.0 - 0.9 * smoothstep(0.35, 0.95, lum);
    float K = mix(0.65, 1.0, act);

    // pointer: the sheen leans a little toward where the pointer is (it is a reflection, it shifts with the viewpoint)
    vec2 mp = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0));
    float lean = clamp(mp.x - 0.5, -1.0, 1.0) * 0.06;

    // moonlight sheen: two soft diagonal bands, a broad one and a thin trailing one
    float ang = 0.55 + 0.5 * sd;                                      // angle of the pane's reflection
    vec2 dir = vec2(cos(ang), sin(ang));
    float along = dot(px, dir) / D;                                   // 0..~1.3 across the window
    float c0 = 0.35 + 0.35 * fract(sd * 3.7) + lean;
    float band = exp(-pow((along - c0) / 0.20, 2.0));
    float band2 = exp(-pow((along - c0 - 0.30) / 0.035, 2.0)) * 0.7;
    float streak = 0.75 + 0.25 * mg_n(vec2(dot(px, vec2(-dir.y, dir.x)) / 260.0 + sd * 20.0, 1.0));   // not perfectly even
    float sheen = (band * 0.8 + band2) * streak;
    vec3 silver = vec3(0.70, 0.80, 0.97);
    c += silver * sheen * 0.125 * K * room;

    // pale halo glow in one corner (which corner depends on the seed)
    vec2 corner = vec2(sd < 0.5 ? surface_size.x : 0.0, 0.0);
    float dc = length(px - corner) / D;
    float halo = exp(-dc * dc / (2.0 * 0.30 * 0.30));
    c += vec3(0.75, 0.85, 1.0) * halo * 0.11 * K * room;

    // a faint breath of mist along the bottom edge
    float fromBottom = surface_size.y - px.y;
    float mh = clamp(surface_size.y * 0.16, 40.0, 130.0);
    float mist = exp(-fromBottom / (mh * 0.55)) * (0.45 + 0.55 * mg_fbm(vec2(px.x / 230.0 + sd * 13.0, fromBottom / 70.0 + 2.0)));
    vec3 mistCol = vec3(0.60, 0.70, 0.86);
    c = mix(c, c * 0.93 + mistCol * 0.10, mist * 0.65 * K * room);

    // overall cool tint, very light, on the dark parts only
    float dark = 1.0 - smoothstep(0.10, 0.50, lum);
    c = mix(c, c * vec3(0.94, 0.99, 1.04) + vec3(0.002, 0.006, 0.014), 0.5 * dark * K);

    // the focused window also gets a thin silver line along its top edge
    float topEdge = smoothstep(2.0, 0.0, px.y);
    c += vec3(0.62, 0.74, 0.95) * topEdge * act * 0.07;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
