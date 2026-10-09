#version 300 es
// category: Motion
// desc: A bright line sweeping down the screen
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 c = texture(tex, v_texcoord);
    float y = fract(time * 0.12);
    float band = exp(-abs(v_texcoord.y - y) * 40.0);
    fragColor = vec4(c.rgb + band * vec3(0.03, 0.06, 0.08), c.a);
}
