#version 300 es
// category: Retro
// desc: Curved glass CRT with an RGB aperture grille, soft bloom and corner shading
// strength: 60
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    float k = 0.07 * STRENGTH;
    vec2 p = v_texcoord * 2.0 - 1.0;
    p = p * (1.0 + k * vec2(p.y * p.y, p.x * p.x));
    vec2 uv = p * 0.5 + 0.5;
    vec4 s = texture(tex, clamp(uv, 0.0, 1.0));
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec3 bloom = (texture(tex, uv + px * vec2(3.0, 0.0)).rgb + texture(tex, uv - px * vec2(3.0, 0.0)).rgb
                + texture(tex, uv + px * vec2(0.0, 3.0)).rgb + texture(tex, uv - px * vec2(0.0, 3.0)).rgb) * 0.25;
    vec3 c = mix(s.rgb, bloom, 0.25 * STRENGTH) + 0.08 * STRENGTH * bloom;
    float col = mod(floor(gl_FragCoord.x), 3.0);
    vec3 mask = vec3(col < 0.5 ? 1.0 : 0.72, (col > 0.5 && col < 1.5) ? 1.0 : 0.72, col > 1.5 ? 1.0 : 0.72);
    c *= mix(vec3(1.0), mask * 1.12, 0.5 * STRENGTH);
    float line = 0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159);
    c *= 1.0 - 0.10 * STRENGTH * (1.0 - line);
    vec2 d = abs(v_texcoord * 2.0 - 1.0);
    float corner = 1.0 - 0.35 * STRENGTH * pow(max(d.x, d.y), 4.0) * 0.5 - 0.25 * STRENGTH * dot(d, d) * 0.25;
    vec2 ed = smoothstep(vec2(0.0), vec2(0.004), min(uv, 1.0 - uv));
    fragColor = vec4(clamp(c * corner, 0.0, 1.0) * ed.x * ed.y, s.a);
}
