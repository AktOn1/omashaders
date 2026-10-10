// label: Floating lanterns
// hint: paper lanterns rise into the night, pointer nudges them
// category: Calm scenes
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
  vec4 cTarget;
  float react;
  float range;
  float zoom;
};
layout(binding = 1) uniform sampler2D src;

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; } // the picture stays unzoomed; only the effect scales
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// one depth layer of lanterns. Every grid cell may hold one lantern; the whole pattern climbs slowly and sways sideways.
// Returns the added halo light in rgb (additive) and, through `body`, the lantern body (premultiplied colour + coverage).
vec3 lnLayer(vec2 p, vec2 mp, float asp, float sc, float speed, float seed, float dens, float bright, float blur, inout vec4 body) {
  vec2 off = vec2(sin(time * 0.045 + seed) * 0.35 + time * 0.0025, time * speed);   // wind and the climb
  vec2 g = (p + off) * sc;
  vec2 id = floor(g);
  float ew = (1.4 + blur) * sc / res.y;                    // edge softness in cell units
  vec3 halo = vec3(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = id + vec2(float(i), float(j));
      float h = hash(cell + seed);
      if (h > dens) continue;
      float h2 = hash(cell + seed + 4.3), h3 = hash(cell + seed + 8.9), h4 = hash(cell + seed + 12.1);
      vec2 c = cell + 0.3 + 0.4 * vec2(h2, h3);
      c.x += 0.14 * sin(time * (0.10 + 0.08 * h4) + h * 60.0);                        // lazy sideways sway
      vec2 pw = (c / sc) - off;                                                       // where it is in the picture
      vec2 dp = pw - mp;
      float dm = length(dp);
      c += dp / max(dm, 1e-3) * exp(-dm * dm / (0.17 * 0.17)) * 0.40;                // the pointer pushes it aside
      float r = 0.17 + 0.08 * h4;                                                     // half width (cell units)
      float tilt = 0.10 * sin(time * 0.17 + h2 * 30.0);
      vec2 d = g - c;
      d = vec2(cos(tilt) * d.x - sin(tilt) * d.y, sin(tilt) * d.x + cos(tilt) * d.y);
      vec2 q = d / vec2(r, r * 1.28);                                                 // unit lantern: |q| = 1 on the outline
      float qd = length(q);
      // gentle flicker: a slow breath plus a slower wander, never faster than about half a hertz
      float fl = 1.0 + 0.075 * sin(time * 1.9 + h * 70.0) + 0.05 * sin(time * 0.8 + h3 * 40.0);
      // colour of the paper: mostly warm orange, some amber, some rose-red
      vec3 tint = h3 < 0.55 ? vec3(1.0, 0.54, 0.16) : (h3 < 0.85 ? vec3(1.0, 0.70, 0.24) : vec3(1.0, 0.40, 0.22));
      // halo: warm light spilled on the night air
      float hl = exp(-qd * 0.95) * 0.62 + exp(-qd * 0.34) * 0.20;
      halo += tint * hl * fl * bright * 0.85 * (1.0 - smoothstep(0.55, 1.25, length(d)));
      // body: a barrel, a little wider in the middle than at the caps
      float yy = abs(q.y);
      float wid = 1.0 - 0.20 * pow(yy, 3.0);
      float sd = (length(vec2(q.x / wid, q.y)) - 1.0) * r;
      float cover = smoothstep(ew, -ew, sd);
      if (cover > 0.0) {
        float cx = q.x / wid;
        float core = pow(max(1.0 - cx * cx, 0.0), 0.6) * (1.0 - 0.35 * q.y * q.y) * (1.0 - 0.25 * smoothstep(0.0, 1.0, q.y));  // flame sits in the lower middle
        vec3 paper = mix(tint * vec3(0.95, 0.52, 0.30), mix(tint, vec3(1.0, 0.92, 0.66), 0.6), core);
        float rib = 1.0 - 0.14 * pow(abs(cos(cx * 3.0 + 0.0)), 14.0);                   // paper ribs
        paper *= rib * (0.92 + 0.12 * core) * fl;
        float cap = smoothstep(0.80, 0.93, yy);                                         // dark wooden cap and base
        paper = mix(paper, vec3(0.20, 0.07, 0.04), cap * 0.75);
        paper *= 0.80 * bright * 1.3 / (0.2 + bright);
        body.rgb = paper * cover + body.rgb * (1.0 - cover);
        body.a = cover + body.a * (1.0 - cover);
      }
    }
  }
  return halo;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);

  // the night sky: the wallpaper seen through deep indigo, warm air near the ground
  vec3 col = wall(uv);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(l) * vec3(0.30, 0.40, 1.0), 0.62) * 0.50;
  col += vec3(0.010, 0.012, 0.045) * (1.0 - uv.y);
  col += vec3(0.075, 0.032, 0.012) * smoothstep(0.45, 1.0, uv.y);          // far festival glow near the horizon

  // three depths, far to near; each one is composited over the last
  for (int k = 0; k < 3; k++) {
    float sc = k == 0 ? 11.0 : (k == 1 ? 6.4 : 3.5);
    float spd = k == 0 ? 0.0050 : (k == 1 ? 0.0085 : 0.0125);
    float dens = k == 0 ? 0.15 : (k == 1 ? 0.12 : 0.07);
    float br = k == 0 ? 0.40 : (k == 1 ? 0.65 : 0.85);
    float blur = k == 0 ? 0.8 : (k == 1 ? 1.4 : 3.5);                      // near ones are out of focus
    vec4 body = vec4(0.0);
    vec3 halo = lnLayer(p, mp, asp, sc, spd, 13.0 * float(k) + 1.0, dens, br, blur, body);
    col += halo;
    col = body.rgb + col * (1.0 - body.a);
  }

  col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
  fragColor = vec4(col, 1.0) * qt_Opacity;
  return fragColor;
}

// mouse reaction slider: 1 = as designed, 0 = the pointer is ignored, above 1 = exaggerated (extrapolated from the no-pointer look)
void main() {
  vec2 away = vec2(-10000.0);
  vec4 c;
  if (react >= 0.995 && react <= 1.005) c = fxMain(mouse);
  else if (react <= 0.005) c = fxMain(away);
  else c = mix(fxMain(away), fxMain(mouse), react);
  fragColor = clamp(c, 0.0, 1.0);
}
