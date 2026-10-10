#version 300 es
// target: window
// category: Light
// desc: Venetian blinds: soft slats of warm streetlight and shadow drift across each window, dust motes float in the light, the focused window has its blinds open and a pointer over it tilts the slats (animated)
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

float vb_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vb_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(vb_h(i), vb_h(i + vec2(1.0, 0.0)), f.x), mix(vb_h(i + vec2(0.0, 1.0)), vb_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float vb_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// one layer of dust motes on a pixel grid: they rise slowly, wobble, and twinkle
float vb_motes(vec2 p, float cell, float speed, float sd) {
    vec2 q = p / cell;
    q.y += time * speed;
    q.x += sin(time * 0.2 + sd * 9.0 + q.y * 0.8) * 0.25;
    vec2 id = floor(q), f = fract(q) - 0.5;
    float h = vb_h(id + sd);
    if (h < 0.45) return 0.0;
    vec2 o = (vec2(vb_h(id + sd + 3.1), vb_h(id + sd + 7.7)) - 0.5) * 0.6;
    float r = (0.9 + 1.6 * vb_h(id + sd + 1.3)) / cell;
    float tw = 0.55 + 0.45 * sin(time * (0.6 + 1.4 * vb_h(id + sd + 5.5)) + h * 40.0);
    return smoothstep(r, r * 0.25, length(f - o)) * tw;
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float S = STRENGTH;
    float act = is_active;
    vec2 p = uv * surface_size;                                           // pixels: bars keep their physical size

    // pointer over the window, 0..1 (clamped so a far-away pointer does not spin the slats)
    vec2 m = clamp((mouse - window_box.xy) / max(window_box.zw, vec2(1.0)), vec2(-0.3), vec2(1.3));

    // slat direction: bars run about 30 degrees off horizontal, a different tilt per window, nudged by the pointer
    float ang = 1.05 + (seed - 0.5) * 0.40 + (m.x - 0.5) * 0.16 + sin(time * 0.05 + seed * 6.0) * 0.03;
    vec2 dir = vec2(cos(ang), sin(ang));                                   // across the bars
    vec2 along = vec2(-dir.y, dir.x);                                      // along the bars
    float period = mix(36.0, 46.0, act);                                   // open blinds: wider slats
    float aa = dot(p, along);
    // the slats bow very slightly along their length (perspective, a loose cord) and breathe with the swell
    float x = (dot(p, dir) + 4.0 * sin(aa * 0.004 + seed * 6.0) + 1.2 * sin(aa * 0.013 + time * 0.07)) / period;
    // very slow drift (light passing by) plus the pointer sliding the phase a little
    x += time * 0.010 + seed * 17.0 + (m.y - 0.5) * 0.8;
    // a rolling swell: as if headlights pass, the slats breathe wider and narrower
    float swell = sin(time * 0.13 + seed * 6.28) * 0.5 + 0.5;
    float sid = vb_h(vec2(floor(x), seed));                               // each slat is a little dustier or cleaner than its neighbour

    // slat profile: t = 0 in the middle of a light bar, 1 in the middle of a shadow bar
    float t = abs(fract(x) - 0.5) * 2.0;
    float duty = mix(0.34, 0.60, act) + (swell - 0.5) * 0.10;
    float soft = mix(0.14, 0.21, act);
    float light = 1.0 - smoothstep(duty - soft, duty + soft, t);
    // thin bright lip where the light meets the shadow edge of a slat
    float lip = smoothstep(0.10, 0.0, abs(t - duty - 0.02)) * 0.6;
    // inside a shadow bar the slat itself catches a little of the light on its lower edge
    float slat = smoothstep(duty, 1.0, t);

    // the beam is not uniform: patchy along the bars, a little stronger towards the top (light comes from above)
    float patch_ = vb_n(vec2(aa * 0.0030 + time * 0.025 + seed * 9.0, floor(x) * 0.0 + dot(p, dir) * 0.0016 - time * 0.012)) * 0.65 + vb_n(vec2(aa * 0.011 - time * 0.02, floor(x) * 0.37)) * 0.35;
    float beam = mix(0.35, 1.0, smoothstep(0.30, 0.62, patch_)) * mix(0.55, 1.0, sid) * mix(0.72, 1.0, 1.0 - uv.y);

    // shadow: at most ~28% darker at the default strength, cool blue-black. Closed blinds: less contrast, but more of it
    float shMax = mix(0.34, 0.47, act) * S;
    float sh = (1.0 - light) * beam * shMax * (0.75 + 0.25 * slat);
    c *= mix(vec3(1.0), vec3(0.86, 0.92, 1.03), sh / max(shMax, 0.001) * 0.55) * (1.0 - sh);

    // warm light: additive and gentle, tungsten amber
    vec3 warm = vec3(1.0, 0.74, 0.42);
    float gain = mix(0.060, 0.120, act) * S / 0.6;
    float lightAmt = (light + lip * 0.8) * beam;
    c += warm * lightAmt * gain;
    c = mix(c, c * (vec3(1.0) + warm * 0.12 * S), light * beam);          // light also warms what it falls on

    // hazy bloom where a bar crosses bright content: four wide taps along the slat
    vec2 px = 1.0 / surface_size;
    vec2 b1 = along * 7.0 * px, b2 = along * 17.0 * px;
    vec3 bl = texture(tex, uv + b1).rgb + texture(tex, uv - b1).rgb + texture(tex, uv + b2).rgb + texture(tex, uv - b2).rgb;
    float bz = smoothstep(0.40, 0.95, vb_luma(bl * 0.25) + vb_luma(c) * 0.3);
    c += warm * bz * light * beam * mix(0.05, 0.12, act) * S / 0.6;

    // dust and smoke motes drifting through the light only
    float motes = vb_motes(p + vec2(seed * 400.0, 0.0), 26.0, 0.06, seed) + 0.8 * vb_motes(p * 1.0 + 53.0, 41.0, 0.035, seed + 0.31);
    c += vec3(1.0, 0.82, 0.56) * motes * smoothstep(0.35, 0.9, light) * beam * mix(0.22, 0.45, act) * S / 0.6 * 0.5;

    // a closed blind is calmer: slightly lower overall level in the shadows of an inactive window
    c *= 1.0 - (1.0 - act) * 0.04 * S;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
