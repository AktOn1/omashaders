#version 300 es
// category: Mood
// desc: Moon rime: a cold silver-blue bloom spills out of the bright parts of the screen, the darks sink to indigo and a very fine frost grain lies over everything, as if the screen were lit by a winter moon (static)
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float mr_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mr_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// cold bloom: a ring of taps around the pixel, only what is above the threshold spills
vec3 mr_bloom(vec2 uv, float r1, float r2, float th) {
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398 + 0.19;
        vec2 d = vec2(cos(a), sin(a));
        acc += max(texture(tex, uv + d * px * r1).rgb - th, 0.0) * 1.15;
        acc += max(texture(tex, uv + d * px * r2).rgb - th, 0.0) * 0.85;
    }
    return acc / 16.0;
}

void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = mr_luma(c);

    // the bloom is tinted, so highlights scatter cold instead of white
    vec3 b = mr_bloom(v_texcoord, 5.0, 13.0, 0.52);
    float bl = mr_luma(b);
    vec3 moon = vec3(0.64, 0.76, 1.00);
    c += moon * bl * 1.30 + b * 0.25;

    // a wide, very soft second halo only from the brightest areas (window edges, text blocks)
    vec3 b2 = mr_bloom(v_texcoord, 26.0, 46.0, 0.72);
    c += moon * mr_luma(b2) * 0.75;

    // the darks cool to indigo and lift a touch, the lights go a shade silver
    float dark = 1.0 - smoothstep(0.02, 0.42, l);
    c = mix(c, c * vec3(0.86, 0.94, 1.14) + vec3(0.012, 0.018, 0.040), dark * 0.80);
    float hi = smoothstep(0.55, 1.0, l);
    c = mix(c, mix(c, vec3(mr_luma(c)) * vec3(0.96, 0.99, 1.05), 0.35), hi * 0.6);

    // fine frost grain, strongest in the mid tones so text keeps its edges
    float g = mr_h(floor(v_texcoord * vec2(textureSize(tex, 0)))) - 0.5;
    float g2 = mr_h(floor(v_texcoord * vec2(textureSize(tex, 0)) * 0.5) + 31.7) - 0.5;
    float mids = 1.0 - abs(l - 0.45) * 1.9;
    c += (g * 0.030 + g2 * 0.016) * clamp(mids, 0.15, 1.0) * vec3(0.90, 0.96, 1.06);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
