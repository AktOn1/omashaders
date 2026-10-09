#version 300 es
// category: Mood
// desc: Faded blacks, warm highlights, fine fixed grain
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    c = (c - 0.5) * 0.92 + 0.53;
    c += (1.0 - l) * vec3(-0.012, 0.008, 0.025) + l * vec3(0.02, 0.008, -0.015);
    c += (hash(gl_FragCoord.xy) - 0.5) * 0.025;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
