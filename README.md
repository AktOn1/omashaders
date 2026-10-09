# screen-shaders

Bar icon (monitor glyph) that cycles full-screen GLSL effects over all monitors.
**Left click** next effect (crt, vignette, warm, then off) · **right click** off · **scroll** step back/forward.
Hyprland forgets the shader on a config reload; the icon re-applies it. The icon highlights while a shader is on.
Setting `includeAnimated` (default off) adds the animated shaders to the cycle (heavy GPU, see below).

Install: link or clone into `~/.config/omarchy/plugins/io.github.akton1.screen-shaders`, then
`omarchy plugin enable io.github.akton1.screen-shaders`. Removal: `omarchy plugin remove io.github.akton1.screen-shaders`,
then `rm -rf ~/.local/state/omarchy/io.github.akton1.screen-shaders` and `hyprctl reload`.
Keybind example: `bind = SUPER SHIFT, S, exec, ~/.config/omarchy/plugins/io.github.akton1.screen-shaders/bin/screen-shader next`


Full-screen GLSL effects over all monitors via Hyprland `decoration:screen_shader`.
Runs inside the compositor on the GPU: no extra window, no CPU use, same cost on every monitor.

    bin/screen-shader list | status | set NAME | off | toggle [NAME] | next | prev   (add -a to include animated)

Shaders live in `shaders/*.frag` (GLSL ES 3.00, uniforms `tex`, `time`, input `v_texcoord`).
Validate with `glslangValidator shaders/NAME.frag`. One shader at a time (Hyprland limit).
Hyprland 0.56 uses the Lua parser: set via `hyprctl eval`, `hyprctl keyword` does not work.

## Cost warning (AKT-568)
Any shader that declares `uniform float time;` makes Hyprland show a red warning and need
`debug:damage_tracking = off`, which redraws the whole screen every frame (big GPU cost).
Static shaders (vignette, crt, warm) must NOT declare `time`. Animated ones (grain, scan-sweep)
are "costly" until damage tracking is handled. A stuck warning is cleared with `hyprctl reload`.
