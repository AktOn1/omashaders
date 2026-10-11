#version 300 es
// target: window
// category: Light
// desc: Sign glow: a neon shopfront tube spills magenta light from one side of the window and cyan from the other (which side, from the seed), a slow breath of colour on the dark parts, brighter on the focused window and stronger on the side the pointer is nearer to; text stays crisp (static)
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

float sg_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sg_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sg_h(i), sg_h(i + vec2(1.0, 0.0)), f.x), mix(sg_h(i + vec2(0.0, 1.0)), sg_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float sg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    float lum = sg_luma(c);
    float room = 1.0 - 0.92 * smoothstep(0.30, 0.90, lum);        // light areas and text get almost nothing
    float K = mix(0.6, 1.0, act);

    vec2 mp = clamp((mouse - window_box.xy) / max(window_box.zw, vec2(1.0)), vec2(-0.2), vec2(1.2));
    float flip = sd < 0.5 ? 0.0 : 1.0;
    vec3 colA = vec3(1.0, 0.16, 0.62);                            // magenta tube
    vec3 colB = vec3(0.15, 0.85, 1.0);                            // cyan tube
    vec3 cL = mix(colA, colB, flip);
    vec3 cR = mix(colB, colA, flip);

    float dl = px.x, dr = surface_size.x - px.x;
    float dt = px.y, db = surface_size.y - px.y;
    float reach = clamp(min(surface_size.x, surface_size.y) * 0.22, 60.0, 170.0);
    // the tubes are not perfectly even: a slow flicker along their length
    float wob = 0.80 + 0.20 * sg_n(vec2(px.y / 180.0 + sd * 9.0, 1.0));
    float gl = exp(-dl / reach) * wob * (0.7 + 0.5 * (1.0 - mp.x));
    float gr = exp(-dr / reach) * (0.80 + 0.20 * sg_n(vec2(px.y / 160.0 + sd * 5.0, 7.0))) * (0.7 + 0.5 * mp.x);
    c += (cL * gl + cR * gr) * 0.24 * K * room;
    // on a light window the tubes tint the paper instead of adding light
    float lite = 1.0 - room;
    c = mix(c, c * (0.55 + 0.45 * cL) , clamp(gl * 0.55, 0.0, 1.0) * lite * K);
    c = mix(c, c * (0.55 + 0.45 * cR) , clamp(gr * 0.55, 0.0, 1.0) * lite * K);

    // the light pools on the floor of the window: a faint blend of both along the bottom edge
    float fl = exp(-db / (reach * 0.8)) * (0.35 + 0.65 * sg_n(vec2(px.x / 260.0 + sd * 3.0, 4.0)));
    c += mix(cL, cR, clamp(px.x / surface_size.x, 0.0, 1.0)) * fl * 0.10 * K * room;

    // a faint violet cast over the dark parts only
    float dark = 1.0 - smoothstep(0.08, 0.40, lum);
    c = mix(c, c * vec3(1.03, 0.97, 1.08) + vec3(0.010, 0.002, 0.020), 0.55 * dark * K);

    // the tube itself: a thin bright line on the very edge, on the active window only
    float lineL = smoothstep(1.6, 0.0, dl) * act;
    float lineR = smoothstep(1.6, 0.0, dr) * act;
    c += cL * lineL * 0.45 + cR * lineR * 0.45;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
