#version 300 es
// target: window
// category: Light
// desc: Cloud veil: a soft airy mist gradient with faint cloud shapes across the top of the window and a sun-warm edge, clearer and brighter on the focused window, every window a different sky (static, keeps text contrast)
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

float cv_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cv_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(cv_h(i), cv_h(i + vec2(1.0, 0.0)), f.x), mix(cv_h(i + vec2(0.0, 1.0)), cv_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float cv_fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * cv_n(p); p = p * 2.03 + 11.0; a *= 0.5; }
    return v;
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                              // un-premultiply; the composer re-applies alpha
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));

    // the veil hangs from the top edge; its depth is a fraction of the window (not too deep, so the text area stays clean)
    float depth = mix(0.30, 0.38, sd) * mix(1.0, 0.8, act);          // the focused window is clearer
    float down = clamp(px.y / max(surface_size.y * depth, 60.0), 0.0, 1.0);
    float veil = pow(1.0 - down, 1.5);

    // faint cloud shapes drifting in the mist (position differs per window)
    vec2 q = vec2(px.x / 420.0 + sd * 23.0, px.y / 240.0 + sd * 9.0);
    float cl = cv_fbm(q * vec2(1.0, 1.5));
    float shape = smoothstep(0.38, 0.72, cl);
    // which side the sun is on
    float side = sd < 0.5 ? 1.0 : 0.0;
    float sx = mix(1.0 - uv.x, uv.x, side);

    float K = mix(0.65, 1.0, act);
    float room = 1.0 - 0.6 * smoothstep(0.3, 0.9, l);                // light backgrounds barely change, so dark text stays crisp
    vec3 mist = vec3(0.80, 0.88, 1.0);
    vec3 cloud = vec3(0.99, 0.96, 0.94);
    // mist: powder blue, with the cloud shapes a touch lighter and warmer
    c += (mist * (0.095 + 0.03 * (1.0 - act)) + cloud * shape * 0.075) * veil * K * room;
    c = mix(c, c * vec3(0.99, 0.995, 1.02), veil * 0.5);

    // sun-warm edge: peach light along the top edge, strongest on the sun side, plus a soft corner glow
    float edge = smoothstep(3.0, 0.0, px.y);
    c += vec3(1.0, 0.80, 0.62) * edge * (0.06 + 0.10 * sx) * mix(0.8, 1.4, act);
    float corner = exp(-length((vec2(mix(1.0 - uv.x, uv.x, side), uv.y) * vec2(surface_size.x / 700.0, surface_size.y / 700.0)) * 2.4));
    c += vec3(1.0, 0.82, 0.66) * corner * 0.07 * K * room;

    // the pointer makes a little gap in the mist
    vec2 mp = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0)) * surface_size;
    float gap = exp(-length(px - mp) / 110.0);
    c -= mist * 0.03 * veil * gap * K * room;

    // fine light edge on the focused window
    float eg = min(min(px.x, surface_size.x - px.x), min(px.y, surface_size.y - px.y));
    c += vec3(1.0, 0.92, 0.85) * smoothstep(2.0, 0.0, eg) * 0.06 * act;

    fragColor = vec4(clamp(c, 0.0, 0.985), s.a);
}
