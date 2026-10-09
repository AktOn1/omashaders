#version 300 es
// category: Ambient
// desc: Cyan hologram: scan bands, flicker and the odd horizontal glitch
// strength: 40
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;
float hash(float x) { return fract(sin(x * 91.345) * 43758.5453); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec2 uv = v_texcoord;
    float band = floor(uv.y * 40.0);
    float glitch = step(0.985, hash(band + floor(time * 7.0) * 3.1));
    uv.x += glitch * (hash(band + time) - 0.5) * 0.04 * STRENGTH;
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec3 c = vec3(texture(tex, uv + vec2(px.x * 2.0 * STRENGTH, 0.0)).r, texture(tex, uv).g, texture(tex, uv - vec2(px.x * 2.0 * STRENGTH, 0.0)).b);
    float l = luma(c);
    vec3 holo = mix(vec3(0.02, 0.10, 0.18), vec3(0.55, 0.95, 1.0), clamp(l * 1.2, 0.0, 1.0));
    c = mix(c, holo, 0.6 * smoothstep(0.0, 0.5, STRENGTH));
    float scan = 0.5 + 0.5 * sin(gl_FragCoord.y * 1.4 + time * 6.0);
    c *= 1.0 - 0.12 * STRENGTH * scan;
    float sweep = smoothstep(0.0, 0.08, abs(fract(uv.y * 0.7 - time * 0.12) - 0.5) - 0.42);
    c += vec3(0.1, 0.25, 0.3) * 0.25 * STRENGTH * (1.0 - sweep);
    c *= 1.0 - 0.06 * STRENGTH * hash(floor(time * 24.0));
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
