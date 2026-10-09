#version 300 es
// category: Ambient
// desc: Falling green code streams over a green-tinted screen
// strength: 30
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec2 res = vec2(textureSize(tex, 0));
    vec2 cell = vec2(16.0, 26.0);
    vec2 fc = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
    vec2 id = floor(fc / cell);
    vec2 loc = fract(fc / cell);
    float colSpeed = 0.15 + 0.35 * hash(vec2(id.x, 1.0));
    float rows = res.y / cell.y;
    float head = fract(time * colSpeed / (rows * 0.05) * 0.1 + hash(vec2(id.x, 7.0))) * (rows + 18.0) - 9.0;
    float dist = head - id.y;
    float trail = (dist > 0.0 && dist < 16.0) ? pow(1.0 - dist / 16.0, 1.6) : 0.0;
    float tip = step(abs(dist), 0.5);
    float change = floor(time * (1.5 + 3.0 * hash(id)));
    vec2 g = floor((loc - vec2(0.2, 0.15)) / vec2(0.2, 0.14));
    float inside = step(0.0, g.x) * step(g.x, 2.0) * step(0.0, g.y) * step(g.y, 4.0);
    float bit = step(0.5, hash(id * 3.0 + g + change));
    float glyph = inside * bit;
    vec3 code = (vec3(0.1, 1.0, 0.3) * trail + vec3(0.8, 1.0, 0.85) * tip) * glyph;
    float l = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 tinted = mix(s.rgb, vec3(0.05, 0.35, 0.12) + s.rgb * vec3(0.25, 1.0, 0.4), 0.55);
    vec3 c = mix(s.rgb, tinted, smoothstep(0.0, 0.6, STRENGTH)) + code * (0.45 + 0.9 * STRENGTH) * (1.0 - 0.6 * l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
