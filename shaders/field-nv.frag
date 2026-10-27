#version 300 es
// category: Devices
// desc: Field terminal glass: a night-vision tint that sends shadows to deep green-black and highlights to pale amber, a faint scanline every third row and a soft dark vignette, like a rugged field console (static, no animation)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float fn_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec2 sz = vec2(textureSize(tex, 0));
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = fn_luma(c);

    // amplified look: lift the shadows a little, keep highlights from clipping
    float g = pow(clamp(l * 1.15, 0.0, 1.0), 0.88);
    vec3 shadowTint = vec3(0.020, 0.075, 0.030);
    vec3 midTint = vec3(0.30, 0.74, 0.26);
    vec3 hiTint = vec3(0.98, 0.70, 0.30);
    vec3 nv = mix(shadowTint, midTint, g);
    nv = mix(nv, hiTint, smoothstep(0.45, 0.95, g) * 0.80);
    // the picture keeps part of its own colour
    c = mix(c, nv * (0.50 + 0.40 * g) + c * 0.08, 0.80);

    // faint scanline, one dark row in three
    float row = floor(uv.y * sz.y);
    float scan = mod(row, 3.0) < 0.5 ? 1.0 : 0.0;
    c *= 1.0 - 0.07 * scan;

    // the corners close in, dark olive
    float vig = smoothstep(0.45, 1.20, length((uv - 0.5) * vec2(sz.x / sz.y, 1.0) * 0.9));
    c = mix(c, c * 0.72 + vec3(0.0, 0.012, 0.004), vig * 0.85);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
