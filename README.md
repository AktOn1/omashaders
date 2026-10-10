# OmaShaders

<a href='https://ko-fi.com/akton1' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi3.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

Full-screen shader effects for the [Omarchy](https://omarchy.org/) desktop, from one bar icon: 45 screen effects (CRT, pixel art, e-ink, Game Boy, camouflage and pixel camouflage, halation, oil paint, matrix rain ...), 44 colour grades plus your own custom colour, 49 animated wallpaper effects and 25 cursor effects (13 overlays such as a trail of twinkles, 12 that bend the real screen under the pointer). Hover to preview, click to keep, and a strength slider on every menu that starts at a value where text stays readable.

> **Brand new: this plugin is one day old** (first written on 9 October 2026, first public release on 10 October 2026). Most of it has only been tried by its author on one machine (NVIDIA GPU, two monitors). Expect rough edges, effects that change or get renamed, and settings that move between versions. Bug reports are welcome.

![Nine of the screen effects, each combined with a colour grade](preview.png)

*The picture is a sample desktop rendered with the plugin's own shaders (`bin/shader-preview`), not a screenshot of the menu.*

## Install

```
omarchy plugin add https://github.com/AktOn1/omashaders.git --enable
```

Then add the **OmaShaders** widget (monitor icon) to your bar in the Omarchy shell settings. Restart the shell once (`omarchy-restart-shell`) if the icon does not appear.

## Requirements

- Omarchy with the shell plugin system and Hyprland 0.56 or newer (Lua config). The screen effects are set with `hyprctl eval`.
- `python` 3 and `bash`. For the wallpaper picker: Omarchy's own `omarchy-menu-images` and `omarchy-theme-bg-set`.
- Optional: `nvidia-smi` (NVIDIA) for the GPU line in the menu footer; on AMD it is read from sysfs. Without either the line is empty.
- No build tools are needed: the compiled wallpaper and cursor shaders (`.frag.qsb`) are included.

## First run

1. Click the monitor icon in the bar. A menu with up to six columns opens: **Screen**, **Color**, **Wallpaper**, **Cursor**, **Windows** and **Combos**. Tick the ones you want at the top; ticked menus sit side by side and your choice is remembered.
2. Move with `h j k l` or the arrow keys. Moving onto an effect with the keys previews it live; hovering with the mouse only highlights it; hold `Shift` while hovering to preview, and the previous setting comes back when you release Shift or move off the item (a click keeps it). Categories (left column) are never selected by hovering; click one.
3. `Enter` keeps the effect and closes, `Space` keeps it and stays open, a click keeps it and stays open, `Esc` puts everything back as it was.
4. Pick an effect and a colour together: the effect runs first, then the colour grade is applied to its result (for example `crt` + `gameboy` is a CRT look in Game Boy greens).
5. Lower the **Strength** slider if an effect is too strong. Every effect starts at a readable value (pixelate 20 %, Game Boy LCD 25 %, C64 25 % ...); 0 % is the original screen.

## Usage

Bar icon: **left click** menu, **right click** pause / resume all effects (they come back exactly as they were), **middle click** next wallpaper, **scroll** steps the screen effect.

| Key | Action |
| --- | --- |
| `h j k l`, arrows | move between categories, effects and menus |
| `Tab` | jump to the next menu |
| `Enter` / `Space` | keep (and close) / keep and stay open |
| `/` | filter every column at once: type to narrow (name, description, category; several words must all match), `Enter` keeps the filter and returns to `h j k l`, `Esc` clears it |
| `Esc`, `q` | clear the filter, or undo and close |
| `[` `]`, `{` `}`, `d` | strength -/+ 5 %, -/+ 1 %, back to the start value (acts on the focused Screen, Color, Wallpaper or Cursor menu; wallpaper and cursor strength is how visible the effect is over the real wallpaper / screen) |
| `Ctrl+Enter`, `Ctrl+click` | mix a second effect (Screen) or grade (Color) with the first, see Mixing below. Plain `Enter` / click replaces both |
| `t`, `,` `.`, `<` `>`, `D`, `Backspace` | with a mix on: stack / blend, mix amount -/+ 5 % and -/+ 1 %, amount back to its start value, remove the second |
| `u`, `U` | custom colour: focus the hex field (`Enter` applies it) / save the custom colour as a favourite (the star next to the field does the same). The H, S and V rails under the Color menu pick it by mouse |
| `p` | pause or resume every effect; they come back exactly as they were |
| `f` | favourite (each menu has its own list) |
| `F` | save the current Screen + Color + Wallpaper + Cursor combination as a combo (`m` shows the Combos menu) |

| `r` / `R` | Surprise me in the focused menu / in every ticked menu |
| `o` / `O` | off in the focused menu / in every ticked menu |
| `s` `C` `w` `c` `W` `m` | tick Screen / Color / Wallpaper / Cursor / Windows / Combos |
| `a` | include the animated (heavy) screen effects |
| `x` | cursor effects only while Shift is held |
| `g` / `G`, `1`-`9` | top / bottom, jump to a category |

The last line of the menu shows GPU use: this shell (draws wallpaper and cursor effects), Hyprland (the screen effect), all apps, and VRAM (the per-process split is NVIDIA only; AMD shows the overall figure). It only updates while the menu is open.

Sample key bindings for `~/.config/hypr/bindings.lua` (they are not added for you):

```lua
-- pause / resume all effects
hl.bind("SUPER + ALT + S", hl.dsp.exec_cmd("omarchy-shell io.github.akton1.omashaders power toggle"))
-- open the menu
hl.bind("SUPER + ALT + D", hl.dsp.exec_cmd("omarchy-shell io.github.akton1.omashaders toggle"))
```

Command line: `omarchy-shell io.github.akton1.omashaders toggle|open|close|power on|off|toggle|set NAME|setColor NAME|setMouse NAME|wallpaper NAME|strength effect|color N|sections screen|color|wall|mouse|both|all|combo N|combo save|shiftOnly on|off|toggle`. The effect script can also be run directly: `bin/omashaders list|status|set NAME|off|effect ...|color ...|strength ...|power ...`.

### Mixing two effects (1.12)

Hold **Ctrl** while you pick (`Ctrl+Enter`, or `Ctrl+click`) a second effect in the Screen menu, or a second grade in the Color menu. The first stays; the second is marked `+ stack` / `+ blend`, and a **Mix** row appears under the strength slider. Picking the second again with Ctrl removes it.

- **Stack:** the second runs on the result of the first, and the Mix slider is the second one's strength (pixelate under a CRT, an amber grade on top of a duotone ...).
- **Blend:** both run on the original picture and the slider is the share of the second (0 % = only the first, 100 % = only the second).

Click the mode name (or press `t`) to flip between them. Both layers are merged into the same single shader Hyprland runs, so a mix costs about the sum of both effects; mixing an animated effect needs the same `debug:damage_tracking=0` as any animated one. While a mix is on, hover and key-move previews are off so they cannot throw it away; choosing any item normally replaces both, and so do Surprise me, Off and Combos (combos do not store a mix). Window shaders and the Wallpaper / Cursor menus do not mix. Command line: `omashaders mix effect|color status|set NAME|off|mode stack|blend|toggle|amount N|+N|-N|reset`.

### Animated effects

Effects that move (grain, scan-sweep, vhs, heat-haze, glitch, hologram, matrix, fireflies, underwater, snowfall and a few more) need Hyprland's damage tracking switched off, which redraws the whole screen every frame and **raises GPU use a lot**. They are hidden until you press `a` (or turn on the setting below). While one is on, the plugin sets `debug:damage_tracking=0` itself so Hyprland shows no warning, and sets it back for static effects and for off. Static effects cost almost nothing.

### Window frames: shadows, glows and borders (1.13)

The **Windows** column also has **Frame** categories (Shadow, Glow, Border, Spin) with 21 presets: soft, deep and offset shadows, neon / ember / aurora glows, thin gold, mono and chunky borders, and spinning rainbow borders. Hyprland draws shadows and borders itself (they are not shaders), so a frame is a preset of its own options (`decoration:shadow:*`, border colours and size, rounding) and **needs no plugin**. A frame applies to every window, not per app, and has no strength slider. Spin frames turn the active border with Hyprland's `borderangle` animation; the first turn starts after the next focus change (OmaShaders re-focuses the active window once for you). Off, or `window off`, puts back the look you had before, even after a config reload (`hyprctl reload` clears it, OmaShaders re-applies it). New presets are `.frame` files in the plugin's `frames/` folder (format in `docs/DEVELOPMENT.md`). Command line: `omashaders window frame list|status|set NAME|off`.

### Window shaders (optional, 1.11)

The **Windows** column (`W`) draws the same effects and colour grades as Screen and Color, but only on the app windows you pick, so the desktop, bar and other apps stay untouched. Pick **Apps** first: *All windows* (new windows are included as they open) or one or more app classes, then choose an effect and/or a colour from the other categories. Strength has one slider per part (Effect strength while you are in an effect category, Color strength in a colour one). Windows follow the pause key (`p`). Combos do not include window shaders.

Hyprland cannot do this by itself, so it needs the third-party plugin [HyprWindowShade](https://github.com/ManofJELLO/HyprWindowShade) (MIT, compiled against your Hyprland version, so it cannot ship with this plugin). If it is missing, the Windows column shows what to install (**Copy install commands** puts it on the clipboard):

```
hyprpm update
hyprpm add https://github.com/ManofJELLO/HyprWindowShade
hyprpm enable HyprWindowShade
```

The plugin must be built for your Hyprland version; if `hyprpm add` fails, the plugin's newest commit may need a newer Hyprland than you run (pick an older commit). OmaShaders loads an installed but not yet loaded copy itself with `hyprctl plugin load` (it looks in `hyprpm`'s cache and in `~/.local/share/hyprland/plugins/HyprWindowShade.so`; with a `.md5` file next to a hand-built copy it checks the file first). It only sets shaders per app class and never adds window rules or tags. Command line: `omashaders window status|effect set NAME|color set NAME|strength effect|color N|target all|none|add CLASS|remove CLASS|toggle CLASS|here|off`.

### Shift only (cursor effects)

Cursor effects and the wallpaper effects' mouse reaction can be limited to "only while Shift is held" (`x` in the menu). For that, Hyprland has to tell the plugin when Shift is down; add this to `~/.config/hypr/bindings.lua`, and the same line for `Shift_R`:

```lua
hl.bind("Shift_L", hl.dsp.global("omashaders:shift"), { non_consuming = true, dont_inhibit = true })
```

Shift still reaches your apps normally. Without this binding the effects never show while the option is on.

### More wallpaper effects (1.10)

- **Merging blobs** (new category, same metaball idea as the lava lamp, the mouse is one more blob): Liquid mercury (chrome that reflects your wallpaper), Glass droplets (slide down, merge, refract), Living cells (outlined membranes with nuclei), Colour goo (three colours that blend where they meet).
- **Fireflies** are now real ones: green, slowly wandering, blinking on and off, shy of the mouse. The old effect (soft drifting lights) is called **Glow dust**.
- **Sparks** (bright streaks that rise and fall, the pointer blows them away) and **Cozy hearth** (flames, logs, glowing coals, warm flickering light on the wallpaper, flames lean towards the pointer).

### Rising smoke wallpaper

Wallpaper > Weather and nature > Rising smoke: smoke drifts upward across the wallpaper, thicker at the bottom, light on dark wallpapers and dark on bright ones. Moving the mouse drags it along the pointer's path (about the last 0.7 s) and stirs up a little more smoke there; it drifts back when you stop. `WallpaperFx.qml` keeps the pointer path and passes it to the shader as `tr0`..`tr3` (only while `smoke` is selected).

### Follow effects

Cursor > Bend > Follow: eight gentle effects that bend or re-draw the real screen along the pointer's recent path and settle after you stop: `smudge` (pixels smear forward like dragged wet paint), `melt` (a soft drip behind the pointer), `wake` (a narrow boat-wake ribbon), `drift` (a faint lens that lags behind and catches up), `streak` (motion blur near the pointer) `echo` (a faint afterimage) and `decode` (screen cells near the moving pointer scramble into green Matrix-style glyphs and decode back to the real pixels as you move on) and `smoke` (a visible wisp of smoke, light on dark screens and dark on bright ones, that is pulled along behind the pointer, curls and thins out upward after you stop). They are small (45-150 px) and fade out within half a second, so text stays readable. `bin/cursor-bend` passes the last 8 pointer positions (35 ms apart) to the shader as `CTR`.

## Configuration

Plugin settings (Omarchy settings UI):

| Setting | Default | Meaning |
| --- | --- | --- |
| `includeAnimated` | off | start value of the "animated screen effects" switch (the switch itself is remembered) |
| `fps` | 30 | frame rate of wallpaper and cursor effects |
| `cursorNeedsShift` | off | start value of "cursor effects only while Shift is held" |

**Starter combos:** the Combos menu comes with ready-made combinations (file `starter-combos`, kept in step with the author's own list). Each release adds the new ones to your list, once: a combo you removed with `f` does not come back, and your own combos are never changed. To ship your own set from a checkout, create an empty file `dev-export` in the state folder; then every save or remove also rewrites `starter-combos`.

State lives in `~/.local/state/omarchy/io.github.akton1.omashaders/` (current effects, mixes, strengths, favourites, combos, pause flag, built shader files). Hyprland forgets a runtime screen shader on a config reload; the icon re-applies it.

## Permissions and behaviour

- **No network access.** Nothing is downloaded, nothing is sent.
- **Hyprland:** the screen effect is set at runtime with `hyprctl eval` (`decoration:screen_shader` and `debug:damage_tracking`). Nothing is written to your Hyprland config files; a `hyprctl reload` or `off` clears it.
- **Subprocesses:** `bin/omashaders` (sets the shader), `bin/compose-shader` (python, merges effect and colour into one file), `bin/cursor-watch` (python; reads the pointer position from the Hyprland socket about 40 times a second, only while a pointer-following effect is running, and exits with the shell), `bin/gpu-usage` (`nvidia-smi` or sysfs, only while the menu is open), `bin/wallpaper-step`, and `notify-send` for the pause key.
- **Wallpaper picker and next/previous:** these change your wallpaper with Omarchy's `omarchy-theme-bg-set`, on your click only. Picking makes a temporary folder of symlinks to your background images under `$XDG_RUNTIME_DIR` and removes it afterwards.
- **Files written:** only the state directory above and the temporary folder just mentioned. Existing config of yours is never overwritten.
- **Bend cursor effects:** a screen shader cannot see the pointer, so while one is selected `bin/cursor-bend` (python; polls the pointer from the Hyprland socket 60 times a second, writes a new shader file at most 30 times a second and only while the pointer moves, plus a short tail for the ripple-like ones) hands Hyprland a fresh composed shader through `hyprctl eval`. Screen and Color effects stay active, merged into the same shader. It starts and stops with the effect, exits with the shell, and then puts your normal shader back. With several monitors a 3x2 pixel marker (magenta, green, magenta) is drawn in the top-left corner of the pointer's monitor so only that monitor is bent; the shader hides it again.
- **Window shaders:** the optional HyprWindowShade plugin is loaded into Hyprland with `hyprctl plugin load` (only when you set a window effect, or at login if one is set) and told per app class which shader file to use through `hyprctl eval`. Nothing is installed, built or downloaded by this plugin.
- **Windows:** wallpaper and cursor effects are drawn in click-through layer-shell windows, one per monitor, that do not take keyboard focus. The menu takes keyboard focus while it is open.
- **Bundled binaries:** the `.frag.qsb` files are compiled Qt shader packages (data, not programs), built from the `.frag` sources next to them with `bin/build-*-effects`.

## Update

```
omarchy plugin update io.github.akton1.omashaders
```

## Remove

```
omarchy plugin remove io.github.akton1.omashaders
rm -rf ~/.local/state/omarchy/io.github.akton1.omashaders
hyprctl reload
```

Also remove the key bindings you added.

## Troubleshooting

- **Red Hyprland warning about `time` and damage tracking:** an animated effect was applied by something other than this plugin. Pick a static effect or `off`, then run `hyprctl reload`.
- **An effect makes text unreadable:** lower its strength (`[`), or press `d` for its start value. Pixel effects start low on purpose.
- **Icon missing or the menu looks old after an update:** `omarchy-restart-shell`.
- **Bend effects cost more than overlays:** the pointer position reaches the shader as a new file about 30 times a second, so Hyprland recompiles it each time (roughly 35% of a CPU core on the author's machine while the pointer moves, none while it rests). Use an overlay effect if that matters.
- **Bend effect only shows on one monitor:** intended, it follows the pointer.
- **Cursor effects never show:** you turned on "only while Shift is held" without the Shift binding above.
- **Windows column says "Setup needed":** HyprWindowShade is not installed (see Window shaders above). After installing, reopen the menu.
- **A window shader does not appear on one app:** the target is the app class (shown in the Apps list while the app is open); a window opened before you picked the effect is covered as soon as its class is targeted. Chrome / Electron apps with several windows share one class.
- **GPU line empty:** neither `nvidia-smi` nor an AMD sysfs reading is available.

Report bugs at https://github.com/AktOn1/omashaders/issues. How the effects work and how to add your own: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Support

If this is useful to you, you can [buy me a coffee on Ko-fi](https://ko-fi.com/akton1).

## License

MIT, see [LICENSE](LICENSE). The shaders were written for this plugin; no third-party code or assets are bundled.
