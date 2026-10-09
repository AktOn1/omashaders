# screen-shaders

Bar icon (monitor glyph) for full-screen GLSL effects over all monitors.
**Left click** opens a list to pick from (off + every static shader; the **Animated effects** switch at the top of the list adds the animated ones, marked "heavy"; the last line shows live GPU % and VRAM) · **right click** off · **scroll** step back/forward through the cycle.
Command line: `omarchy-shell io.github.akton1.screen-shaders toggle|open|close|set NAME` (bind `toggle` to a key if wanted).
Hyprland forgets the shader on a config reload; the icon re-applies it. The icon highlights while a shader is on.
The menu switch is remembered in the state dir; the plugin setting `includeAnimated` (default off) is only its starting value. Animated shaders are added the animated shaders to the cycle (heavy GPU, see below).

Install: link or clone into `~/.config/omarchy/plugins/io.github.akton1.screen-shaders`, then
`omarchy plugin enable io.github.akton1.screen-shaders`. Removal: `omarchy plugin remove io.github.akton1.screen-shaders`,
then `rm -rf ~/.local/state/omarchy/io.github.akton1.screen-shaders` and `hyprctl reload`.


Full-screen GLSL effects over all monitors via Hyprland `decoration:screen_shader`.
Runs inside the compositor on the GPU: no extra window, no CPU use, same cost on every monitor.

    bin/screen-shader list | status | set NAME | off | toggle [NAME] | next | prev   (add -a to include animated) | animated [on|off|toggle] | gpu

Shaders live in `shaders/*.frag` (GLSL ES 3.00, uniforms `tex`, `time`, input `v_texcoord`).
Validate with `glslangValidator shaders/NAME.frag`. One shader at a time (Hyprland limit).
Hyprland 0.56 uses the Lua parser: set via `hyprctl eval`, `hyprctl keyword` does not work.

## Cost warning (AKT-568)
Any shader that declares `uniform float time;` makes Hyprland show a red warning and need
`debug:damage_tracking = off`, which redraws the whole screen every frame (big GPU cost).
Static shaders (vignette, crt, warm, mono, sepia, midnight, phosphor, vivid, invert, posterize) must NOT declare `time`. Animated ones (grain, scan-sweep, vhs, heat-haze, glitch)
are costly: `screen-shader` sets `debug:damage_tracking=0` itself when an animated shader is applied
(no Hyprland warning) and back to 2 for static ones/off. A warning left over from before is cleared with `hyprctl reload`.
