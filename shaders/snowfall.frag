#version 300 es
// category: Ambient
// desc: Snow drifting down over the screen
// strength: 60
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float flakes(vec2 fc, float size, float speed, float seed, float radius) {
    vec2 p = fc;
    p.y += time * speed;
    p.x += sin(time * 0.5 + floor(p.y / size) * 1.7) * size * 0.6;
    vec2 id = floor(p / size);
    vec2 loc = fract(p / size);
    float h = hash(id + seed);
    vec2 pos = vec2(0.2 + 0.6 * hash(id + seed + 3.0), 0.2 + 0.6 * hash(id + seed + 5.0));
    float d = length((loc - pos) * size);
    float on = step(1.0 - 0.55 * STRENGTH, h);
    return on * smoothstep(radius, radius * 0.3, d);
}
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec2 fc = vec2(gl_FragCoord.x, -gl_FragCoord.y);
    float f = flakes(fc, 70.0, 55.0, 1.0, 3.2) + flakes(fc, 110.0, 38.0, 9.0, 4.2) * 0.9 + flakes(fc, 45.0, 75.0, 4.0, 2.2) * 0.7;
    float l = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 c = mix(s.rgb, s.rgb * vec3(0.92, 0.97, 1.04), 0.3 * STRENGTH) + vec3(0.9, 0.95, 1.0) * f * (0.9 - 0.45 * l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
