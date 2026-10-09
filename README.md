# OmaShader

Bar icon (monitor glyph) for full-screen GLSL effects over all monitors.
**Left click** opens a keyboard menu: categories on the left (Comfort, Color, Retro, Devices, Mood, Motion, Off), effects on the right. `h j k l` or arrows move, moving through effects previews them live, `Enter`/`l` keeps one, `Esc`/`q` puts the old effect back, `o` = off, `a` = animated switch, `g`/`G` top/bottom, `1`-`7` jump to a category. The last line shows live GPU % and VRAM. **Right click** off · **scroll** step back/forward through the cycle.
Command line: `omarchy-shell io.github.akton1.omashader toggle|open|close|set NAME` (bind `toggle` to a key if wanted).
Hyprland forgets the shader on a config reload; the icon re-applies it. The icon highlights while a shader is on.
The menu switch is remembered in the state dir; the plugin setting `includeAnimated` (default off) is only its starting value. Animated shaders are added the animated shaders to the cycle (heavy GPU, see below).

Install: link or clone into `~/.config/omarchy/plugins/io.github.akton1.omashader`, then
`omarchy plugin enable io.github.akton1.omashader`. Removal: `omarchy plugin remove io.github.akton1.omashader`,
then `rm -rf ~/.local/state/omarchy/io.github.akton1.omashader` and `hyprctl reload`.


Full-screen GLSL effects over all monitors via Hyprland `decoration:screen_shader`.
Runs inside the compositor on the GPU: no extra window, no CPU use, same cost on every monitor.

    bin/omashader list | status | set NAME | off | toggle [NAME] | next | prev   (add -a to include animated) | animated [on|off|toggle] | gpu

Shaders live in `shaders/*.frag` (GLSL ES 3.00, uniforms `tex`, `time`, input `v_texcoord`).
Validate with `glslangValidator shaders/NAME.frag`. One shader at a time (Hyprland limit).
Hyprland 0.56 uses the Lua parser: set via `hyprctl eval`, `hyprctl keyword` does not work.

## Cost warning (AKT-568)
Any shader that declares `uniform float time;` makes Hyprland show a red warning and need
`debug:damage_tracking = off`, which redraws the whole screen every frame (big GPU cost).
Static shaders must NOT declare `time`. Animated ones (grain, scan-sweep, vhs, heat-haze, glitch, breathe, aurora, tunnel; all in category Motion)
are costly: `omashader` sets `debug:damage_tracking=0` itself when an animated shader is applied
(no Hyprland warning) and back to 2 for static ones/off. A warning left over from before is cleared with `hyprctl reload`.

## Adding a shader
Drop `shaders/NAME.frag` with two comment lines right after `#version 300 es`: `// category: Comfort|Color|Retro|Devices|Mood|Motion` and `// desc: one line shown in the menu`. Check with `glslangValidator -S frag`.

## Reacting to what moves on screen
Not possible inside a Hyprland screen shader: it gets only the current frame (no previous frame, no custom inputs), so it cannot compare frames. Possible variants: a cursor-reactive shader (a helper rewrites a constant and re-applies; recompiles each time, so only a few updates per second) or a Quickshell overlay with a screencopy feedback loop (heavy). Not built.
