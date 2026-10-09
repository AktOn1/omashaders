#version 300 es
// category: Mood
// desc: Edges gently dim and lose colour
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float v = smoothstep(0.95, 0.30, length((v_texcoord - 0.5) * vec2(1.0, 0.9)));
    float l = luma(c);
    c = mix(vec3(l), c, mix(0.7, 1.0, v)) * mix(0.75, 1.0, v);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
