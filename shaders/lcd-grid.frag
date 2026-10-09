#version 300 es
// category: Devices
// desc: Subpixel LCD grid: fine RGB stripes
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float x = mod(gl_FragCoord.x, 3.0);
    vec3 m = vec3(0.75) + 0.25 * vec3(step(x, 1.0), step(1.0, x) * step(x, 2.0), step(2.0, x));
    float y = mod(gl_FragCoord.y, 3.0);
    c *= m * (y < 1.0 ? 0.88 : 1.0) * 1.08;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
