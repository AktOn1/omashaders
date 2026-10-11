#version 300 es
// category: Retro
// desc: Phosphor smear: bright text and lines bleed a soft green-white glow sideways and a little up and down, like a mainframe tube driven hard; flat glass, no curvature, no lines, so small text stays sharp (static)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float ps_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec2 uv = v_texcoord;
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    float S = STRENGTH;
    float K = S * 1.818;                     // 1.0 at the default 55 %
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    // gather bright pixels along the scan line (wide) and across it (narrow)
    vec3 acc = vec3(0.0);
    float w = 0.0;
    for (int i = 1; i <= 5; i++) {
        float fi = float(i);
        float k = exp(-fi * 0.45);
        vec3 a = texture(tex, uv + vec2(fi * 2.2, 0.0) * px).rgb;
        vec3 b = texture(tex, uv - vec2(fi * 2.2, 0.0) * px).rgb;
        acc += (a * smoothstep(0.45, 0.95, ps_luma(a)) + b * smoothstep(0.45, 0.95, ps_luma(b))) * k;
        w += 2.0 * k;
    }
    for (int j = 1; j <= 2; j++) {
        float fj = float(j);
        vec3 a = texture(tex, uv + vec2(0.0, fj * 2.0) * px).rgb;
        vec3 b = texture(tex, uv - vec2(0.0, fj * 2.0) * px).rgb;
        acc += (a * smoothstep(0.45, 0.95, ps_luma(a)) + b * smoothstep(0.45, 0.95, ps_luma(b))) * 0.5;
        w += 1.0;
    }
    acc /= w;
    float lum = ps_luma(c);
    vec3 glow = acc * vec3(0.85, 1.0, 0.90);
    // the glow only belongs to small bright things on a dark ground: where the whole neighbourhood is bright (a light window) it is off, so dark text there stays crisp
    float flat_ = smoothstep(0.35, 0.80, ps_luma(acc));
    c += glow * 0.85 * K * (1.0 - smoothstep(0.55, 0.95, lum)) * (1.0 - flat_);
    // slight lift of the blacks toward green, like a tube that is never fully off
    c += vec3(0.000, 0.010, 0.004) * K * (1.0 - lum);
    // edge shading, light
    vec2 d = uv - 0.5;
    c *= 1.0 - 0.30 * smoothstep(0.35, 0.95, length(d * vec2(1.0, 1.15))) * min(K, 1.2);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
