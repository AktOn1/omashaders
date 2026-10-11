#version 300 es
// target: window
// category: Glass
// desc: Greenbar paper: the window background turns into fanfold computer paper, broad pale green and white bands in a faint ruled grid, with the band under the pointer lit like a reading ruler; stronger on the focused window, each window has its own paper phase, text stays crisp (static)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
uniform vec2 mouse;
uniform vec4 window_box;
layout(location = 0) out vec4 fragColor;

float gb_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                              // un-premultiply; the composer re-applies alpha
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    float lum = gb_luma(c);
    float K = mix(0.70, 1.0, act);
    // only the background takes the paper: bright glyphs on dark and dark glyphs on light are left alone
    float darkBg = 1.0 - smoothstep(0.12, 0.30, lum);
    float lightBg = smoothstep(0.78, 0.92, lum);
    float flat_ = max(darkBg, lightBg);

    // bands: 3 x 18 px lines of white, 3 x 18 px of green, a different phase for each window
    float bandH = 54.0;
    float y = px.y + sd * bandH * 2.0;
    float bf = fract(y / (bandH * 2.0));
    float aa = 1.2 / (bandH * 2.0);
    float green = smoothstep(0.5 - aa, 0.5 + aa, bf) * (1.0 - smoothstep(1.0 - aa, 1.0 + aa, bf)) ;   // 0 for the white half, 1 for the green half
    // the pale rule between bands, one pixel
    float rule = smoothstep(1.6 / (bandH * 2.0), 0.0, abs(bf - 0.5)) + smoothstep(1.6 / (bandH * 2.0), 0.0, min(bf, 1.0 - bf));

    // the reading ruler: the band row under the pointer lights up
    vec2 mp = mouse - window_box.xy;
    float inside = step(0.0, mp.x) * step(mp.x, window_box.z) * step(0.0, mp.y) * step(mp.y, window_box.w);
    float ry = abs(px.y - mp.y);
    float ruler = (1.0 - smoothstep(14.0, 30.0, ry)) * inside;

    vec3 darkTint = vec3(0.020, 0.075, 0.035);
    vec3 lightTint = vec3(0.90, 1.00, 0.91);
    // dark background: green bands are a faint green lift, rules slightly brighter
    vec3 cd = c + darkTint * green * K + vec3(0.010, 0.030, 0.014) * rule * K + vec3(0.012, 0.050, 0.020) * ruler * K;
    // light background: green bands multiply the paper toward pale green, rules slightly greener
    vec3 cl = c * mix(vec3(1.0), lightTint, green * K) * mix(vec3(1.0), vec3(0.95, 0.985, 0.95), rule * 0.8 * K);
    cl *= mix(vec3(1.0), vec3(0.95, 1.0, 0.95), ruler * K);
    vec3 paper = mix(cd, cl, lightBg / max(darkBg + lightBg, 0.001));
    c = mix(c, paper, flat_);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
