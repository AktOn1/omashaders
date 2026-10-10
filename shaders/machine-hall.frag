#version 300 es
// category: Ambient
// desc: Machine hall: the dark computer room around your desktop, a regular row of tiny console lamps blinking along the bottom, top and side edges, slow amber light bleeding in from the rim, a ghostly tape reel turning in the corner, soft vignette and fine dust (animated)
// strength: 45
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;

float mh_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mh_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mh_h(i), mh_h(i + vec2(1.0, 0.0)), f.x), mix(mh_h(i + vec2(0.0, 1.0)), mh_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float mh_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 mh_screen(vec3 c, vec3 add) { return c + (1.0 - c) * clamp(add, 0.0, 1.0); }

// one console lamp: id picks colour, blink rate and pattern. returns rgb light (0 when dark, tiny ember when off)
vec3 mh_lamp(vec2 id, float chase) {
    float r = mh_h(id + 1.7);
    vec3 col = r < 0.58 ? vec3(1.0, 0.62, 0.12) : (r < 0.84 ? vec3(1.0, 0.16, 0.08) : vec3(0.25, 1.0, 0.35));
    float kind = mh_h(id + 5.3);
    float rate = kind < 0.25 ? 0.45 : (kind < 0.85 ? 1.3 + 3.2 * mh_h(id + 9.1) : 7.0);   // slow status, data, fast bus lamps
    float stp = floor(time * rate + mh_h(id + 3.3) * 50.0);
    float on = step(mh_h(id + stp * 0.173) , 0.20 + 0.55 * mh_h(id + 2.2));     // a random bit pattern per lamp, some busy, some idle
    if (kind > 0.93) on = 1.0;                                                  // a few power lamps stay lit
    on = max(on, chase);
    return col * mix(0.10, 1.0, on);
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float S = STRENGTH;
    float k = S / 0.45;
    vec2 size = vec2(textureSize(tex, 0));
    vec2 P = uv * size;
    float asp = size.x / size.y;
    vec2 e = min(P, size - P);                                 // pixel distance to the nearest left/top and right/bottom edge
    float yb = size.y - P.y;                                   // px from the bottom edge

    // the hall in the dark: soft vignette, shadows drift a little warm and brown
    vec2 q = (uv - 0.5) * vec2(asp, 1.0);
    float vg = smoothstep(0.35, 1.05, length(q) * 1.12);
    c = mix(c, c * vec3(1.02, 0.93, 0.80), vg * 0.5 * min(k, 1.5));
    c *= 1.0 - 0.42 * vg * k;

    // amber glow bleeding in from the rim, breathing slowly; the lamp row spills more light along the bottom
    float breathe = 0.65 + 0.35 * sin(time * 0.31 + uv.x * 3.0) * sin(time * 0.17 + 1.7);
    float dB = yb / size.y, dT = P.y / size.y, dL = P.x / size.y, dR = (size.x - P.x) / size.y;
    float bleed = 0.9 * exp(-dB * 9.0) + 0.45 * exp(-dT * 9.0) + 0.45 * exp(-dL * 8.0) + 0.45 * exp(-dR * 8.0);
    float patchy = 0.6 + 0.8 * mh_n(vec2(uv.x * 7.0 + time * 0.03, uv.y * 3.0 + time * 0.02));
    c = mh_screen(c, vec3(1.0, 0.52, 0.10) * bleed * patchy * breathe * 0.085 * k);

    // tape reel: a barely-there turntable in the lower-right corner, hub, ring and three spokes, only darkening the dust-lit wall
    vec2 rc = vec2(size.x - 0.04 * size.y, size.y - 0.04 * size.y);
    vec2 rp = (P - rc) / size.y;
    float rr = length(rp), ra = atan(rp.y, rp.x) - time * 0.35;
    float spokes = smoothstep(0.30, 0.0, abs(sin(ra * 1.5)) * rr * 6.0 - 0.0) ;
    float ring = smoothstep(0.012, 0.0, abs(rr - 0.30)) + 0.6 * smoothstep(0.006, 0.0, abs(rr - 0.12)) + 0.35 * smoothstep(0.012, 0.0, abs(rr - 0.34));
    float disc = smoothstep(0.30, 0.22, rr) * (0.35 * spokes * smoothstep(0.05, 0.10, rr)) + smoothstep(0.06, 0.03, rr) * 0.5;
    float reel = clamp(ring * 0.8 + disc, 0.0, 1.0) * smoothstep(0.40, 0.25, rr);
    c *= 1.0 - 0.20 * reel * k;
    c = mh_screen(c, vec3(1.0, 0.55, 0.12) * ring * smoothstep(0.40, 0.25, rr) * 0.030 * k);

    // console lamps, hugging the very edge (inside 8 px), drawn over the content without hiding it
    vec3 lamps = vec3(0.0);
    float chaseT = fract(time * 0.085);
    // bottom row: 14 px pitch, lamp centre 5 px above the edge
    {
        float pitch = 14.0;
        vec2 id = vec2(floor(P.x / pitch), 1.0);
        vec2 lc = vec2((id.x + 0.5) * pitch, size.y - 5.0);
        float d = length(P - lc);
        float chase = smoothstep(0.035, 0.0, abs(uv.x - (chaseT * 1.3 - 0.15)));      // a bus cycle sweeps along now and then
        vec3 l = mh_lamp(id, chase);
        lamps += l * (smoothstep(2.3, 1.1, d) + 0.30 * exp(-d * d / 7.0));
    }
    // top row: sparser, 24 px pitch, centre 4 px below the edge
    {
        float pitch = 24.0;
        vec2 id = vec2(floor(P.x / pitch), 2.0);
        vec2 lc = vec2((id.x + 0.5) * pitch, 4.0);
        float d = length(P - lc);
        vec3 l = mh_lamp(id, 0.0);
        lamps += l * (smoothstep(2.0, 0.9, d) + 0.25 * exp(-d * d / 6.0)) * 0.85;
    }
    // sides: sparse columns, 40 px pitch
    {
        float pitch = 40.0;
        vec2 idL = vec2(3.0, floor(P.y / pitch));
        vec2 idR = vec2(4.0, floor(P.y / pitch));
        float dL2 = length(P - vec2(4.0, (idL.y + 0.5) * pitch));
        float dR2 = length(P - vec2(size.x - 4.0, (idR.y + 0.5) * pitch));
        lamps += mh_lamp(idL, 0.0) * (smoothstep(2.0, 0.9, dL2) + 0.25 * exp(-dL2 * dL2 / 6.0)) * 0.7;
        lamps += mh_lamp(idR, 0.0) * (smoothstep(2.0, 0.9, dR2) + 0.25 * exp(-dR2 * dR2 / 6.0)) * 0.7;
    }
    c = mh_screen(c, lamps * min(k, 1.4) * 0.95);

    // extremely fine dust: specks on a 2 px grid that drift and twinkle, plus a hair of warm grain
    vec2 dp = P / 2.0 + vec2(time * 0.7, time * 0.25);
    vec2 di = floor(dp);
    float dust = step(0.9985, mh_h(di + 4.4)) * (0.5 + 0.5 * sin(time * (1.0 + 3.0 * mh_h(di)) + mh_h(di + 1.0) * 30.0));
    float grain = mh_h(floor(P) + floor(time * 12.0) * 7.0) - 0.5;
    c = mh_screen(c, vec3(1.0, 0.75, 0.45) * dust * 0.16 * k);
    c += vec3(1.0, 0.85, 0.65) * grain * 0.012 * k;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
