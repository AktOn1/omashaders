# OmaShaders

One bar icon (monitor glyph), three effect menus. Tick **Screen**, **Wallpaper** and/or **Cursor** at the top of the menu; ticked menus sit side by side (your choice is remembered).

- **Screen**: full-screen GLSL shaders over all monitors (Comfort, Color, Retro, Devices, Mood, Motion), applied by Hyprland on the GPU.
- **Wallpaper**: 41 animated effects drawn over your wallpaper in the theme colours (follows the mouse, weather and nature, scenes, looks) and a wallpaper picker (pick an image, next, previous).
- **Cursor**: small overlays around the mouse pointer (Focus, Glow, Trail).

Keys: `h j k l` or arrows move, `Tab` jumps between menus (`l` on the last effect of a menu goes to the next menu), moving onto an effect or hovering it with the mouse previews it live, `Enter` keeps it and closes, `Space` keeps it and stays open, `Esc`/`q` puts the old effects back. `f` favorite (own list per menu), `r` Surprise me in the focused menu, `R` in every ticked menu, `o` off in the focused menu, `O` in every ticked menu, `s` `w` `c` tick Screen / Wallpaper / Cursor, `a` animated screen shaders, `g`/`G` top/bottom, `1`-`9` jump to a category. The last line shows GPU use: this shell (draws wallpaper and cursor effects), Hyprland (the screen shader) and all apps, plus VRAM.

Bar icon: **left click** menu · **right click** all ticked effects off · **middle click** next wallpaper · **scroll** steps the screen shader (wallpapers when Screen is unticked).
Command line: `omarchy-shell io.github.akton1.omashaders toggle|open|close|set NAME|setMouse NAME|wallpaper NAME|sections screen|wall|mouse|both|all`.
## Combos
A combo is Screen + Wallpaper + Cursor effect saved together. Tick **Combos** (`m`) for a fourth menu: `Enter` applies a combo, moving over one previews it, `Esc` undoes. `F` (anywhere in the menu) saves the current combination; `f` on a combo removes it. They live in `~/.local/state/omarchy/io.github.akton1.omashaders/combos`, one `screen|wall|mouse` line each. From a key binding: `omarchy-shell io.github.akton1.omashaders combo N` applies the Nth combo, `combo save` saves the current one.

## Shift only
Cursor effects and the wallpaper effects' mouse reaction can be limited to "only while Shift is held": press `x` in the menu, or `omarchy-shell io.github.akton1.omashaders shiftOnly on|off|toggle` (plugin setting `cursorNeedsShift` is the starting value; default off). Hyprland has to forward the key, add this to `~/.config/hypr/bindings.lua` (and the same line for `Shift_R`):

    hl.bind("Shift_L", hl.dsp.global("omashaders:shift"), { non_consuming = true, dont_inhibit = true })

Without that binding the effects would never show while the option is on. Shift still reaches apps normally.

Hyprland forgets the screen shader on a config reload; the icon re-applies it.
The animated-screen switch is remembered in the state dir; the plugin setting `includeAnimated` (default off) is only its starting value. `fps` (default 30) is the frame rate of wallpaper and cursor effects.
Replaces the separate Wallpaper Switcher plugin (`io.github.akton1.wallpaper-switcher`), which can be disabled.

Install: link or clone into `~/.config/omarchy/plugins/io.github.akton1.omashaders`, then
`omarchy plugin enable io.github.akton1.omashaders`. Removal: `omarchy plugin remove io.github.akton1.omashaders`,
then `rm -rf ~/.local/state/omarchy/io.github.akton1.omashaders` and `hyprctl reload`.


Full-screen GLSL effects over all monitors via Hyprland `decoration:screen_shader`.
Runs inside the compositor on the GPU: no extra window, no CPU use, same cost on every monitor.

    bin/omashaders list | status | set NAME | off | toggle [NAME] | next | prev   (add -a to include animated) | animated [on|off|toggle] | gpu

Shaders live in `shaders/*.frag` (GLSL ES 3.00, uniforms `tex`, `time`, input `v_texcoord`).
Validate with `glslangValidator shaders/NAME.frag`. One shader at a time (Hyprland limit).
Hyprland 0.56 uses the Lua parser: set via `hyprctl eval`, `hyprctl keyword` does not work.

## Cost warning (AKT-568)
Any shader that declares `uniform float time;` makes Hyprland show a red warning and need
`debug:damage_tracking = off`, which redraws the whole screen every frame (big GPU cost).
Static shaders must NOT declare `time`. Animated ones (grain, scan-sweep, vhs, heat-haze, glitch, breathe, aurora, tunnel; all in category Motion)
are costly: `omashaders` sets `debug:damage_tracking=0` itself when an animated shader is applied
(no Hyprland warning) and back to 2 for static ones/off. A warning left over from before is cleared with `hyprctl reload`.

## Adding a shader
Drop `shaders/NAME.frag` with two comment lines right after `#version 300 es`: `// category: Comfort|Color|Retro|Devices|Mood|Motion` and `// desc: one line shown in the menu`. Check with `glslangValidator -S frag`.

## Reacting to what moves on screen
Not possible inside a Hyprland screen shader: it gets only the current frame (no previous frame, no custom inputs), so it cannot compare frames. Possible variants: a cursor-reactive shader (a helper rewrites a constant and re-applies; recompiles each time, so only a few updates per second) or a Quickshell overlay with a screencopy feedback loop (heavy). Not built.

## Wallpaper effects
`wallpaper-effects/NAME.frag` (+ compiled `.frag.qsb`) are Qt shaders drawn by `WallpaperFx.qml` in a layer-shell window above the wallpaper, one per monitor, hosted by the first monitor's bar. Recompile after editing with `bin/build-wallpaper-effects` (needs qt6-shadertools). `bin/wallpaper-step next|prev|status|pick` steps or picks the wallpaper image; `bin/gpu-usage` prints `OVERALL SHELL HYPRLAND USED_MB TOTAL_MB`.
