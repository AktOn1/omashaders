#version 300 es
// target: window
// category: Glass
// desc: Frost rim glass: rime crystals creep a little way in from the window edges and a cold moonlit rim light runs along the two edges the moon falls on, brightest on the focused window; each window gets its own crystal pattern and light direction from its seed, the middle stays clear and text crisp (static)
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform vec2 surface_size;
uniform float is_active;
uniform float is_floating;
uniform float seed;
uniform vec2 mouse;
uniform vec4 window_box;
layout(location = 0) out vec4 fragColor;

float fr_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 fr_h2(vec2 p) { return vec2(fr_h(p), fr_h(p + 19.19)); }
float fr_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fr_h(i), fr_h(i + vec2(1.0, 0.0)), f.x), mix(fr_h(i + vec2(0.0, 1.0)), fr_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fr_fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * fr_n(p); p = p * 2.07 + 13.1; a *= 0.5; }
    return v;
}
// crystalline facets: distance to the nearest of a jittered grid of seeds, and the gap to the second
float fr_cells(vec2 p, out float edge) {
    vec2 ip = floor(p), fp = fract(p);
    float d1 = 9.0, d2 = 9.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 g = vec2(float(x), float(y));
            vec2 o = fr_h2(ip + g);
            float d = length(g + o - fp);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
        }
    }
    edge = d2 - d1;
    return d1;
}
float fr_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                  // un-premultiply; the composer re-applies alpha
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    float D = max(surface_size.x, surface_size.y);
    float lum = fr_luma(c);
    // light content and text get much less of everything: this is a coating on the glass
    float room = 1.0 - 0.88 * smoothstep(0.34, 0.92, lum);
    float K = mix(0.50, 1.0, act);

    // how far this pixel is from the nearest edge, in pixels, and the band the frost lives in
    float dl = px.x, dr = surface_size.x - px.x, dt = px.y, db = surface_size.y - px.y;
    float dEdge = min(min(dl, dr), min(dt, db));
    float band = clamp(surface_size.y * 0.17, 36.0, 130.0);
    float creep = 0.45 + 0.55 * fr_fbm(vec2(px.x / 160.0 + sd * 9.0, px.y / 160.0 - sd * 5.0));
    float rime = smoothstep(band * creep, 0.0, dEdge);     // 1 at the very edge, 0 by the band's end
    rime = rime * rime * rime;                             // it hugs the edge and thins out fast

    // the crystals themselves: wide facet plates with faint seams, only inside the rime band
    if (rime > 0.004) {
        float ed;
        vec2 cp = px / 64.0 + vec2(sd * 31.0, sd * 17.0);
        cp += (fr_fbm(px / 110.0 + sd * 3.0) - 0.5) * 0.9;  // the grid is bent, so the plates are not a honeycomb
        float d1 = fr_cells(cp, ed);
        float plate = 1.0 - smoothstep(0.0, 0.85, d1);
        float seam = smoothstep(0.13, 0.0, ed);            // a thin line where two plates meet
        float needles = pow(max(fr_fbm(px / 17.0 + vec2(sd * 7.0, 3.0)) - 0.44, 0.0) * 2.2, 1.5);
        vec3 ice = vec3(0.72, 0.84, 1.00);
        float f = rime * room * K;
        c = mix(c, c * 0.92 + ice * 0.12, f * (0.20 + 0.26 * plate));
        c += ice * seam * f * 0.20;
        c += vec3(0.86, 0.93, 1.00) * needles * f * 0.17;
    }

    // moonlit rim light: the moon stands off one side, so two edges catch a cold line
    float fromX = sd < 0.5 ? dl : dr;                      // which vertical edge the light falls on
    float rimX = exp(-fromX / 2.2) * 0.85 + exp(-fromX / 9.0) * 0.30;
    float rimY = exp(-dt / 2.2) * 0.70 + exp(-dt / 11.0) * 0.26;
    float along = 0.70 + 0.30 * fr_n(vec2(px.y / 190.0 + sd * 21.0, px.x / 600.0));   // the line is not perfectly even
    vec3 moon = vec3(0.78, 0.87, 1.00);
    c += moon * (rimX * along + rimY * along) * (0.16 + 0.26 * act);

    // a wide, very soft glow bleeding inward from those two lit edges
    float spill = exp(-fromX / (D * 0.085)) * 0.5 + exp(-dt / (D * 0.065)) * 0.4;
    c += moon * spill * 0.075 * K * room;

    // the opposite corner keeps a deeper, colder shadow so the window has a light side
    vec2 far = vec2(sd < 0.5 ? surface_size.x : 0.0, surface_size.y);
    float dcorner = length(px - far) / D;
    float shade = exp(-pow(dcorner / 0.55, 2.0));
    c = mix(c, c * vec3(0.90, 0.94, 1.03), shade * 0.45 * K);

    // overall cool breath over the dark parts only, lighter on an unfocused window
    float dark = 1.0 - smoothstep(0.08, 0.46, lum);
    c = mix(c, c * vec3(0.95, 0.99, 1.06) + vec3(0.003, 0.007, 0.016), dark * 0.55 * K);

    // a floating window reads as nearer: its rim is a shade brighter
    c += moon * rimX * is_floating * act * 0.05;

    // the pointer thaws a small clear spot in the rime and leaves a wet glint around it
    vec2 mp = mouse - window_box.xy;
    float dmp = length(px - mp) / max(D, 1.0);
    float warm = exp(-pow(dmp / 0.085, 2.0));
    c += moon * rime * warm * 0.10 * act;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
