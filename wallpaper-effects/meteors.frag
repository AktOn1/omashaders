#version 440
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
  mat4 qt_Matrix;
  float qt_Opacity;
  float time;
  vec2 mouse;
  vec2 res;
  vec2 imgSize;
  vec4 cBg;
  vec4 cBlue;
  vec4 cMagenta;
  vec4 cPink;
  vec4 cCream;
};
layout(binding = 1) uniform sampler2D src;

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp(uv, 0.0, 1.0))).rgb; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}


void main() {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mouse / res;
  vec2 d = (uv - m) * vec2(asp, 1.0);
  float r = length(d);
  vec2 dir = d / max(r, 0.0001);
  vec3 col = wall(uv) * 0.82;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 md = normalize(vec2(-1.0, 0.55));
  for (int n = 0; n < 6; n++) {
    float fn = float(n);
    float per = 4.0 + fn * 0.9;
    float tt = time + fn * 2.7;
    float id = floor(tt / per);
    float act = fract(tt / per) * per / 1.5;
    if (act < 1.0) {
      vec2 st = vec2((0.35 + 0.9 * hash(vec2(id, fn))) * asp, -0.1 + 0.4 * hash(vec2(fn, id + 3.0)));
      vec2 head = st + md * act * 1.1;
      vec2 pp = p - head;
      float along = dot(pp, md);
      float perp = length(pp - md * along);
      float tail = smoothstep(-0.3, 0.0, along) * step(along, 0.0);
      float line = exp(-perp * perp * 600000.0) * tail;
      float hd = exp(-dot(pp, pp) * 40000.0);
      float fade = sin(act * 3.14159);
      col += cCream.rgb * (line * 0.9 + hd * 0.8) * fade;
    }
  }
  vec2 sp = p * 110.0;
  vec2 sg = floor(sp);
  float star = step(0.995, hash(sg)) * smoothstep(0.25, 0.0, length(fract(sp) - 0.5)) * (0.5 + 0.5 * sin(time * 1.3 + hash(sg + 2.0) * 30.0));
  col += cCream.rgb * star * 0.5;
  fragColor = vec4(col, 1.0) * qt_Opacity;
}
