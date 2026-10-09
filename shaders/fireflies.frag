#version 300 es
// category: Ambient
// desc: Soft fireflies drift and blink across the screen
// strength: 60
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;
vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}
vec3 layerGlow(vec2 fc, float size, float seed, float speed) {
    vec2 id = floor(fc / size);
    vec2 h = hash2(id + seed);
    vec2 h2 = hash2(id + seed + 17.0);
    float t = time * speed;
    vec2 pos = (0.3 + 0.4 * h + 0.18 * vec2(sin(t * (0.6 + h2.x) + h.y * 6.28), cos(t * (0.5 + h2.y) + h.x * 6.28))) * size;
    float d = length(fc / size * size - id * size - pos);
    float blink = pow(0.5 + 0.5 * sin(t * (1.2 + h2.x * 1.5) + h2.y * 6.28), 3.0);
    float core = exp(-d * d / (size * size * 0.0009));
    float halo = exp(-d * d / (size * size * 0.012));
    vec3 col = mix(vec3(1.0, 0.85, 0.3), vec3(0.7, 1.0, 0.4), h2.x);
    return col * (core * 1.2 + halo * 0.35) * blink * step(0.35, h.x);
}
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec2 fc = gl_FragCoord.xy;
    vec3 g = layerGlow(fc, 90.0, 1.0, 0.8) + layerGlow(fc, 140.0, 5.0, 0.6) + layerGlow(fc, 220.0, 9.0, 0.45);
    float l = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 c = s.rgb + g * STRENGTH * (1.0 - 0.7 * l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
