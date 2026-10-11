#version 300 es
// category: Comfort
// desc: Sand ink: warm paper whites and soft charcoal, like ink on raked-sand paper; luminance is kept so text stays crisp
// strength: 50
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    // charcoal -> warm stone grey -> sand -> paper white
    vec3 k0 = vec3(0.075, 0.072, 0.070);
    vec3 k1 = vec3(0.36, 0.34, 0.31);
    vec3 k2 = vec3(0.78, 0.73, 0.64);
    vec3 k3 = vec3(0.975, 0.955, 0.915);
    vec3 grad = mix(k0, k1, smoothstep(0.0, 0.35, l));
    grad = mix(grad, k2, smoothstep(0.30, 0.72, l));
    grad = mix(grad, k3, smoothstep(0.70, 1.0, l));
    // hold the original luminance so contrast is unchanged
    float gl = max(luma(grad), 0.001);
    grad = clamp(grad * (l / gl), 0.0, 1.0);
    vec3 g = mix(c, grad, 0.62);
    // quieten colour a little, ink is nearly neutral
    float gg = luma(g);
    g = mix(vec3(gg), g, 0.82);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
