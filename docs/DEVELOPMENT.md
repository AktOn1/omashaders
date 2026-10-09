# OmaShaders: how it works and how to add effects

Full-screen GLSL effects over all monitors via Hyprland `decoration:screen_shader`.
They run inside the compositor on the GPU: no extra window, no CPU use, same cost on every monitor.

    bin/omashaders list | status | set NAME | off | toggle [NAME] | next | prev   (add -a to include animated) | animated [on|off|toggle] | gpu
    bin/omashaders effect [status|list|set NAME|off] | color [status|list|set NAME|off]
    bin/omashaders strength [effect|color [N|+N|-N|reset]] | power [status|on|off|toggle] [--notify]

Effects live in `shaders/*.frag`, colour grades in `colors/*.frag` (GLSL ES 3.00, uniforms `tex`, `time`, input `v_texcoord`).
Validate with `glslangValidator -S frag shaders/NAME.frag`. Hyprland runs only one screen shader, so with an effect and a colour set,
`bin/compose-shader` merges them into `<state dir>/built/EFFECT@S+COLOR@S.frag` (effect first, the colour then reads the effect's result, each with its strength baked in as a constant because Hyprland has no custom uniforms);
`off` clears both, `effect off` / `color off` one layer. `set NAME` with a colour name sets the colour layer.
Hyprland 0.56 uses the Lua parser: the shader is set at runtime with `hyprctl eval`, `hyprctl keyword` does not work.

## Cost of animated shaders
Any shader that declares `uniform float time;` makes Hyprland show a red warning and need
`debug:damage_tracking = off`, which redraws the whole screen every frame (big GPU cost).
Static shaders must NOT declare `time`. Animated ones (Motion, plus hologram, matrix, fireflies, underwater, snowfall in Ambient)
are costly: `omashaders` sets `debug:damage_tracking=0` itself when an animated shader is applied
(no Hyprland warning) and back to 2 for static ones and for off. A warning left over from before is cleared with `hyprctl reload`.

## Adding a shader
Effect: drop `shaders/NAME.frag` with two comment lines right after `#version 300 es`: `// category: Lens|Retro|Devices|Art|Mood|Ambient|Motion` and `// desc: one line shown in the menu`.
Colour: `colors/NAME.frag`, category `Comfort|Color|Retro|Devices`; it must be a per-pixel function of `texture(tex, v_texcoord)` only (one such call, no other `v_texcoord`, no `gl_FragCoord`, no `time`), because the composer swaps that call for the effect's output and prefixes the colour's helper functions with `c_`.
Strength: add `// strength: N` for the start value (default 100). By default the result is blended with the untouched screen (`mix(input, result, S)`), which is right for tints and overlays. Shaders whose look changes shape (pixel blocks, blur radius, curvature) add `// strength-mode: native` and read `STRENGTH` (0.0-1.0) themselves, so 0 % really is the original screen and the start value is readable.
Check everything with `bin/shader-check` (composes every effect and colour at 50 % and validates it with glslangValidator; standalone validation of a native shader fails on `STRENGTH`). Preview without touching the desktop: `bin/shader-preview IN.png SHADER.frag OUT.png [TIME]` (CPU rendering with Mesa; build the shader first with `bin/compose-shader`).

## Reacting to what moves on screen
Not possible inside a Hyprland screen shader: it gets only the current frame (no previous frame, no custom inputs), so it cannot compare frames. Possible variants: a cursor-reactive shader (a helper rewrites a constant and re-applies; recompiles each time, so only a few updates per second) or a Quickshell overlay with a screencopy feedback loop (heavy). Built since as the Bend cursor effects (below), though not as a frame-comparing shader.

## Wallpaper and cursor effects
`wallpaper-effects/NAME.frag` and `mouse-effects/NAME.frag` are Qt shaders; the compiled `.frag.qsb` next to each is committed so users need no build tools.
They are drawn by `WallpaperFx.qml` and `MouseFx.qml` in layer-shell windows (one per monitor) hosted by the first monitor's bar.
Recompile after editing with `bin/build-wallpaper-effects` / `bin/build-mouse-effects` (needs qt6-shadertools).
`bin/wallpaper-step next|prev|status|pick` steps or picks the wallpaper image; `bin/gpu-usage` prints `OVERALL SHELL HYPRLAND USED_MB TOTAL_MB`.
`bin/cursor-watch` prints the pointer position from the Hyprland socket (about 40 times a second) and exits when its parent exits.

## Bend cursor effects

`cursor-shaders/NAME.frag` defines `vec4 bend(vec2 uv)` and may use `CUR` (pointer, pixels, monitor-local), `CVEL` (pixels per second), `CT` (seconds since the pointer last moved), `RES` and `texture(tex, ...)`. Header lines: `// category: Bend`, `// desc: ...`, and `// tail: N` if the effect keeps changing for N seconds after the pointer stops. `bin/compose-shader --cur FILE` merges it with the Screen and Color layers (the Screen layer's `texture(tex, ...)` calls are redirected through the bend). `bin/cursor-bend` rewrites the `CUR`/`CVEL`/`CT`/`CMARK` constants and applies the file, at most 30 times a second; the multi-monitor marker is described in the README. Besides the pointer, a bend shader gets the trail: `CTR[8]` holds the 8 previous pointer positions (newest first, about 35 ms apart, monitor-local pixels). `cur_pt(i)` returns the trail point i (0 = pointer, up to 8) and `cur_seg(p, i, dir, len, h)` returns the distance from pixel `p` to trail segment i, with its direction, length and position h along it (see `// category: Follow` shaders such as `smudge.frag`). Use `// tail: 0.5` or more so the trail has time to collapse before updates stop. `bin/shader-check` validates every bend shader.
