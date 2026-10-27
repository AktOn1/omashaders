#version 300 es
// category: Lens
// desc: Lumen bloom: only the brightest small points (lamps, lit windows, stars) get a faint four-point cross with a longer cool horizontal glint and a soft halo, found with 24 taps; a hair of cool-to-warm fringe only in the far corners, the middle and the text stay perfectly sharp, big bright areas and white screens are left alone
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float lb_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// a bright point's contribution: dim and mid tones give (almost) nothing
// xyz = colour of the point, w = how bright-point-like the tap is (summed later to tell a point from text or a big area)
vec4 lb_pt(vec3 t) {
    float e = smoothstep(0.30, 0.66, lb_luma(t));
    return vec4(t * (e * e), e);
}

// one tap, half a pixel off the grid so it averages a 2x2 block (a 2 px star is not missed between two taps)
vec4 lb_src(vec2 uv, vec2 o) {
    return lb_pt(texture(tex, uv + (o + vec2(0.5)) * (1.0 / vec2(textureSize(tex, 0)))).rgb);
}

void main() {
    vec2 uv = v_texcoord;
    vec2 sz = vec2(textureSize(tex, 0));
    vec2 px = 1.0 / sz;
    vec3 c = texture(tex, uv).rgb;

    vec2 pc = floor(uv * sz);
    float h = fract(52.9829189 * fract(dot(pc, vec2(0.06711056, 0.00583715))));

    // long horizontal arm (5 taps each way) and a shorter vertical arm (2 taps each way)
    vec4 arm = vec4(0.0);
    arm += (lb_src(uv, vec2( 4.0, 0.0)) + lb_src(uv, vec2( -5.0, 0.0))) * vec4(vec3(1.00), 1.0);
    arm += (lb_src(uv, vec2( 7.5, 0.0)) + lb_src(uv, vec2( -8.5, 0.0))) * vec4(vec3(0.80), 1.0);
    arm += (lb_src(uv, vec2(11.5, 0.0)) + lb_src(uv, vec2(-12.5, 0.0))) * vec4(vec3(0.58), 1.0);
    arm += (lb_src(uv, vec2(17.5, 0.0)) + lb_src(uv, vec2(-18.5, 0.0))) * vec4(vec3(0.38), 1.0);
    vec3 farL = texture(tex, uv + vec2(27.0, 0.0) * px).rgb;
    vec3 farR = texture(tex, uv - vec2(27.0, 0.0) * px).rgb;
    arm += (lb_pt(farL) + lb_pt(farR)) * vec4(vec3(0.22), 1.0);
    vec4 varm = vec4(0.0);
    varm += (lb_src(uv, vec2(0.0,  4.0)) + lb_src(uv, vec2(0.0,  -5.0))) * vec4(vec3(1.00), 1.0);
    varm += (lb_src(uv, vec2(0.0,  8.5)) + lb_src(uv, vec2(0.0,  -9.5))) * vec4(vec3(0.66), 1.0);

    // soft halo: 3 taps on a ring that is turned and stretched a little per pixel
    vec4 halo = vec4(0.0);
    for (int i = 0; i < 3; i++) {
        float a = (float(i) + h) * 2.0943951;
        float r = 6.0 + 4.5 * float(i) + 3.0 * h;
        halo += lb_src(uv, vec2(cos(a), sin(a)) * r);
    }

    // anything bright within 2-3 px (the strokes of text, the edge of a panel) means this is not the dark air around a point
    float nb = 0.0;
    nb = max(nb, smoothstep(0.55, 0.85, lb_luma(texture(tex, uv + vec2( 2.5,  2.5) * px).rgb)));
    nb = max(nb, smoothstep(0.55, 0.85, lb_luma(texture(tex, uv + vec2(-2.5,  2.5) * px).rgb)));
    nb = max(nb, smoothstep(0.55, 0.85, lb_luma(texture(tex, uv + vec2( 2.5, -2.5) * px).rgb)));
    nb = max(nb, smoothstep(0.55, 0.85, lb_luma(texture(tex, uv + vec2(-2.5, -2.5) * px).rgb)));

    // backdrop: the far ends of the arm say whether this is a point in the dark or a big bright area
    float back = 0.5 * (lb_luma(farL) + lb_luma(farR));
    float iso = 1.0 - smoothstep(0.30, 0.65, back);
    // a point has only a few bright taps around it; text, panels and big bright areas have many
    float fill = arm.w + varm.w + halo.w;
    iso *= (1.0 - smoothstep(2.2, 4.2, fill)) * (1.0 - smoothstep(0.15, 0.7, nb));
    // never add to pixels that are already bright, so white screens, text and the star cores stay as they are
    float room = 1.0 - smoothstep(0.55, 0.92, lb_luma(c));

    // each part is also switched off where it sees several separate bright taps (a row of text, a grid of windows), a lone point has one
    float gA = 1.0 - smoothstep(1.3, 2.3, arm.w);
    float gV = 1.0 - smoothstep(1.2, 2.0, varm.w);
    float gH = 1.0 - smoothstep(1.2, 2.0, halo.w);
    vec3 glow = arm.rgb * vec3(0.62, 0.95, 1.10) * (0.16 * gA) + varm.rgb * vec3(0.85, 1.0, 1.1) * (0.15 * gV) + halo.rgb * vec3(0.75, 0.98, 1.05) * (0.075 * gH);
    vec3 res = c + glow * iso * room * (3.4 * STRENGTH);

    // a hair of cool-to-warm fringe, only in the far corners (at most about 1.4 px), none in the middle
    vec2 q = (uv - 0.5) * vec2(1.0, 0.8);
    float k = smoothstep(0.34, 0.78, length(q));
    if (k > 0.0) {
        vec2 o = normalize(q + 1e-5) * vec2(1.0, 1.25) * px * (1.4 * k * k * STRENGTH / 0.55);
        float r = texture(tex, clamp(uv + o, 0.0, 1.0)).r;
        float b = texture(tex, clamp(uv - o, 0.0, 1.0)).b;
        res.r += r - c.r;
        res.b += b - c.b;
    }
    fragColor = vec4(clamp(res, 0.0, 1.0), 1.0);
}
