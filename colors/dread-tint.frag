#version 300 es
// category: Color
// desc: Dread tint: a cold green-grey grade, colour drained by about 40 %, blacks crushed and pushed into a dark teal-green, mids leaning sickly green, highlights lifted to a pale bone white, while reds stay alive so blood still reads as blood
// strength: 80
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float dt_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l0 = dt_luma(c);

    // how red is it: strongly coloured pixels whose red clearly leads (hue wraps around zero), skin and wood count a little
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float sat = mx > 1e-4 ? (mx - mn) / mx : 0.0;
    float lead = (c.r - max(c.g, c.b)) / max(mx, 1e-4);
    float red = smoothstep(0.55, 0.85, lead) * smoothstep(0.40, 0.70, sat);

    // drain the colour (about 35 %), reds only about 8 %
    vec3 g = mix(vec3(l0), c, mix(0.60, 0.92, red));

    // loud colours (saturated blues, violets, neon) are pulled down further so nothing stays cheerful
    g = mix(vec3(dt_luma(g)), g, 1.0 - 0.40 * smoothstep(0.35, 0.85, sat) * (1.0 - red));

    // crush the blacks with a small toe, then a slightly steeper curve
    g = max(g - 0.030, 0.0) / 0.970;
    float l = dt_luma(g);
    g = mix(g, g * g * (3.0 - 2.0 * g), 0.22);

    // everything leans a little cold green-grey (the reds are spared)
    g *= mix(vec3(0.93, 1.02, 0.97), vec3(1.0), max(red, smoothstep(0.50, 0.88, dt_luma(g))));

    // shadows go dark teal-green (multiplied, so true black stays black), mids lean sickly green
    float shad = 1.0 - smoothstep(0.0, 0.40, l);
    g = mix(g, g * vec3(0.74, 1.06, 0.95) + vec3(-0.004, 0.012, 0.008) * shad, shad * (1.0 - 0.7 * red));
    float mid = smoothstep(0.10, 0.40, l) * (1.0 - smoothstep(0.45, 0.85, l));
    g *= mix(vec3(1.0), vec3(0.95, 1.025, 0.975), mid * (1.0 - 0.7 * red));

    // highlights lifted toward bone white
    float high = smoothstep(0.58, 0.92, l);
    g = mix(g, g * vec3(1.02, 1.0, 0.90) + vec3(0.012, 0.010, 0.0), high * 0.55 * (1.0 - 0.6 * red));

    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
