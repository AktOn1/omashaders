# OmaShaders

<a href='https://ko-fi.com/akton1' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi3.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

Full-screen shader effects for the [Omarchy](https://omarchy.org/) desktop, from one bar icon: 69 screen effects (CRT, pixel art, e-ink, Game Boy, camouflage and pixel camouflage, halation, oil paint, matrix rain ...), 67 colour grades plus your own custom colour, 70 animated wallpaper effects (a slider sets how much they follow the mouse; one reacts only to a colour you pick) and 30 overlay cursor effects (a trail of twinkles, rain ripples, glows ...) plus 12 that bend the real screen under the pointer. Hover to preview, click to keep, and a strength slider on every menu that starts at a value where text stays readable.

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
- Optional, for the audio-reactive effects (ids starting with `audio-`): `python-numpy` and `parec` (pipewire-pulse). Without them those effects just stay still.
- Optional: `nvidia-smi` (NVIDIA) for the GPU line in the menu footer; on AMD it is read from sysfs. Without either the line is empty.
- No build tools are needed: the compiled wallpaper and cursor shaders (`.frag.qsb`) are included.

## First run

1. Click the monitor icon in the bar. A menu with six columns opens, all always shown: **Screen**, **Color**, **Wallpaper**, **Cursor**, **Windows** and **Combos**. The ticks at the top do not hide anything: they only choose which columns **Surprise all** and **Clear all** act on, and your choice is remembered.
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
| `v` `V` | **Speed** -/+ 10 % of the focused Wallpaper or Cursor menu (Cursor: overlay effects only) - wallpaper effect speed (slider under the Mix row: 0 % freezes the animation, 100 % as made, up to 300 % three times faster) |
| `z` `Z` | wallpaper effect **Zoom** (on the Cursor menu: cursor effect **Size**, 25 % to 300 % around the pointer) -/+ 10 % (25 % to 300 %: how large the effect is drawn; the wallpaper picture under it keeps its size. A stacked second effect is not zoomed again, it follows the first) |
| `(` `)` | wallpaper mouse reaction -/+ 10 % (the **Mouse reaction** slider under the Wallpaper strength slider: 0 % ignores the pointer, 100 % is how the effect was made, up to 200 % exaggerates it). The slider's `Colour range` and `Reacts to #` rows belong to **Colour reactor**; `u` on the Wallpaper menu focuses its hex field, **Pick from screen** is an eyedropper (`hyprpicker`) |
| `Ctrl+Enter`, `Ctrl+click` | mix a second effect (Screen, Wallpaper, Windows) or grade (Color, Windows) with the first, see Mixing below. Plain `Enter` / click replaces both |
| `t`, `,` `.`, `<` `>`, `D`, `Backspace` | with a mix on: stack / blend, mix amount -/+ 5 % and -/+ 1 %, amount back to its start value, remove the second |
| `u`, `U` | custom colour: focus the hex field (`Enter` applies it) / save the custom colour as a favourite (the star next to the field does the same). The H, S and V rails under the Color menu pick it by mouse |
| `p` | pause or resume every effect; they come back exactly as they were |
| `e` | **pause while fullscreen** on or off (the *Fullscreen pause* box in the header row): while the focused monitor shows a fullscreen window, every effect (screen, colour, wallpaper, cursor, windows, frames) switches off and comes back when you leave fullscreen; a manual pause (`p`) is kept separate |
| `f` | favourite (each menu has its own list) |
| `F` | save the current Screen + Color + Wallpaper + Cursor + Windows (effect, colour and frame) combination as a combo (`m` shows the Combos menu) |
| `n` | on the Combos menu: name (rename) the selected combo; `Enter` keeps the name, an empty name goes back to the automatic one, `Esc` cancels |

| `r` / `R` | Surprise me in the focused menu / in every ticked column |
| `o` / `O` | off in the focused menu / in every ticked column (the Clear all button in the header row does the same) |
| `P` | cost report: what each effect costs, written to the state folder and shown as a notification |
| `s` `C` `w` `c` `W` | tick Screen / Color / Wallpaper / Cursor / Windows for Surprise all / Clear all (`m` jumps to Combos) |
| `A` | Windows column: open the app picker (`j` `k` choose, `Enter` edits that app, `Esc` closes) |
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

Command line: `omarchy-shell io.github.akton1.omashaders toggle|open|close|power on|off|toggle|set NAME|setColor NAME|setMouse NAME|wallpaper NAME|strength effect|color N|sections screen|color|wall|mouse|both|all|combo N|combo save|comboRename N NAME|shiftOnly on|off|toggle`. The effect script can also be run directly: `bin/omashaders list|status|set NAME|off|effect ...|color ...|strength ...|power ...`.

### Mixing two effects (1.12)

Hold **Ctrl** while you pick (`Ctrl+Enter`, or `Ctrl+click`) a second effect in the Screen, Wallpaper or Windows menu, or a second grade in the Color or Windows menu (1.17 added Wallpaper and Windows; a window mix belongs to the app you are editing). The first stays; the second is marked `+ stack` / `+ blend`, and a **Mix** row appears under the strength slider. Picking the second again with Ctrl removes it.

- **Stack:** the second runs on the result of the first, and the Mix slider is the second one's strength (pixelate under a CRT, an amber grade on top of a duotone ...).
- **Blend:** both run on the original picture and the slider is the share of the second (0 % = only the first, 100 % = only the second).

Click the mode name (or press `t`) to flip between them. Both layers are merged into the same single shader Hyprland runs, so a mix costs about the sum of both effects; mixing an animated effect needs the same `debug:damage_tracking=0` as any animated one. While a mix is on, hover and key-move previews are off so they cannot throw it away; choosing any item normally replaces both, and so do Surprise me, Off and Combos (combos do not store a mix). The Cursor menu does not mix. A wallpaper mix is drawn by the shell as two layers (the second reads the first one's picture in stack mode), so it costs about both effects. Command line: `omashaders mix effect|color status|set NAME|off|mode stack|blend|toggle|amount N|+N|-N|reset`, and for windows `omashaders window [-a CLASS] mix effect|color ...` the same way.

### Animated effects

Effects that move (grain, scan-sweep, vhs, heat-haze, glitch, hologram, matrix, fireflies, underwater, snowfall and a few more) need Hyprland's damage tracking switched off, which redraws the whole screen every frame and **raises GPU use a lot**. They are hidden until you press `a` (or turn on the setting below). While one is on, the plugin sets `debug:damage_tracking=0` itself so Hyprland shows no warning, and sets it back for static effects and for off. Static effects cost almost nothing.

### What is on, and what it costs (1.14)

At the bottom of each column an **ON:** row lists what is active in that column (Screen: effect and its mix; Color: grade and its mix; Wallpaper: effect and its mix; Cursor; Windows: effect, colour, frame, and each app or panel with its own window setting) as clickable chips: **click a chip to switch just that one off** (an app's chip removes its own setting, so it follows All windows again; clearing the main screen or colour chip also clears its mix). Windows shaders on All windows also reach shell panels, so this menu and other plugin flyouts are shaded too. While the plugin runs it also keeps a small log, `perf.jsonl` in the state folder: every 4 seconds while an effect is on (every 30 s otherwise) it records which layers are on and how much GPU `Hyprland` and the shell use (per process, from `nvidia-smi pmon`, so other apps do not count), their CPU use, VRAM, power and temperature. Nothing leaves the machine.

    omashaders perf report [--days N] [--notify]   cost per effect against the idle baseline, heavy ones first, plus crashes
    omashaders perf bench [--kinds screen,color,wall] [--only a,b]   try effects one by one (about 5 s each) and measure; your own effects are restored afterwards
    omashaders perf crashes [--hours N] [--all]    Hyprland / quickshell / portal crashes and what was on just before
    omashaders perf status | on | off              the sampler

Rating (extra GPU share of Hyprland + shell, median while on): light under 4, moderate under 12, heavy under 25, rework from 25 (or spikes of 40 and up). Measured moderate and heavy effects show `[heavy +18%]` after their description in the menu and in the active line. The log is rotated at 8 MB. Without an NVIDIA card the whole-GPU number from sysfs is used instead. The bench changes your live desktop for a minute or two and runs on a still screen, so it shows the cost of redrawing, not of busy content; a single reading can be off by 10 points, so trust the numbers that come with many samples (or run the bench twice) and let the sampler collect real use over a few days.

### Window frames: shadows, glows and borders (1.13)

The **Windows** column also has **Frame** categories (Shadow, Glow, Border, Spin) with 21 presets: soft, deep and offset shadows, neon / ember / aurora glows, thin gold, mono and chunky borders, and spinning rainbow borders. Hyprland draws shadows and borders itself (they are not shaders), so a frame is a preset of its own options (`decoration:shadow:*`, border colours and size, rounding) and **needs no plugin**. A frame applies to every window, not per app, and has no strength slider. Spin frames turn the active border with Hyprland's `borderangle` animation; the first turn starts after the next focus change (OmaShaders re-focuses the active window once for you). Off, or `window off`, puts back the look you had before, even after a config reload (`hyprctl reload` clears it, OmaShaders re-applies it). New presets are `.frame` files in the plugin's `frames/` folder (format in `docs/DEVELOPMENT.md`). Command line: `omashaders window frame list|status|set NAME|off`.

### Window shaders (optional, 1.11)

The **Windows** column (`W`) draws the same effects and colour grades as Screen and Color, but only on the app windows you pick, so the desktop, bar and other apps stay untouched. Pick who to edit in the **app box next to the Windows title** (click it, or press `A`): *All windows* (new windows are included as they open) or one app, then choose an effect and/or a colour from the categories (**Surprise me** there picks an effect for the app being edited); the box shows who you are editing. An app you edit gets **its own settings**, which are remembered per app and **override All windows** for that app (the first change starts from what All windows had, then only that part changes). Apps with their own setting show it in the app box. **Follow All windows** (in the app's column) removes the override, **Off** in an app's column gives that app no shader at all even when All windows has one, and **Off** under All windows clears everything. Frames stay global. Strength has one slider per part (Effect strength while you are in an effect category, Color strength in a colour one). Shell surfaces are listed in the same app box tagged `panel` (the bar, the AktLabs Companion pill and menu, this OmaShaders menu, other plugin menus, overlays): *All windows* includes them (the Companion pill and its overlays, plugin flyouts, menus, notifications, OSD), except the bar, the wallpaper, the cursor overlay and invisible click-catchers; tick the bar (or any panel) in the list to shade it too, and give a panel its own setting or **Off** to change just that one. Windows follow the pause key (`p`). Combos remember the Windows effect, colour and frame (all windows; per-app settings are not stored).

Hyprland cannot do this by itself, so it needs the third-party plugin [HyprWindowShade](https://github.com/ManofJELLO/HyprWindowShade) (MIT, compiled against your Hyprland version, so it cannot ship with this plugin). If it is missing, the Windows column shows what to install (**Copy install commands** puts it on the clipboard):

```
hyprpm update
hyprpm add https://github.com/ManofJELLO/HyprWindowShade
hyprpm enable HyprWindowShade
```

The plugin must be built for your Hyprland version; if `hyprpm add` fails, the plugin's newest commit may need a newer Hyprland than you run (pick an older commit). OmaShaders loads an installed but not yet loaded copy itself with `hyprctl plugin load` (it looks in `hyprpm`'s cache and in `~/.local/share/hyprland/plugins/HyprWindowShade.so`; with a `.md5` file next to a hand-built copy it checks the file first). It only sets shaders per app class and never adds window rules or tags. Command line: `omashaders window status|effect set NAME|color set NAME|strength effect|color N|target all|none|add CLASS|remove CLASS|toggle CLASS|here|apps|off`; for one app put `-a CLASS` first, e.g. `omashaders window -a kitty effect set vhs`, `window -a kitty strength effect 40`, `window -a kitty off|inherit|status`.

### Shift only (cursor effects)

While the menu is open the effects always show, so a cursor effect you pick appears at once; Shift only matters with the menu closed. Cursor effects and the wallpaper effects' mouse reaction can be limited to "only while Shift is held" (`x` in the menu). For that, Hyprland has to tell the plugin when Shift is down; add this to `~/.config/hypr/bindings.lua`, and the same line for `Shift_R`:

```lua
hl.bind("Shift_L", hl.dsp.global("omashaders:shift"), { non_consuming = true, dont_inhibit = true })
```

Shift still reaches your apps normally. Without this binding the effects never show while the option is on.

### More wallpaper effects (1.10)

- **Merging blobs** (new category, same metaball idea as the lava lamp, the mouse is one more blob): Liquid mercury (chrome that reflects your wallpaper), Glass droplets (slide down, merge, refract), Living cells (outlined membranes with nuclei), Colour goo (three colours that blend where they meet).
- **Fireflies** are now real ones: green, slowly wandering, blinking on and off, shy of the mouse. The old effect (soft drifting lights) is called **Glow dust**.
- **Sparks** (bright streaks that rise and fall, the pointer blows them away) and **Cozy hearth** (flames, logs, glowing coals, warm flickering light on the wallpaper, flames lean towards the pointer).

### Digital rain HD and wallpaper-colour rain (1.19)

Wallpaper > New scenes: **Digital rain HD** draws sharp, antialiased katakana-style glyphs (two depth layers, small far ones and larger near ones, 2 drops per column, bright white-green heads) on near black with a faint ghost of the wallpaper; the pointer lights the rain and makes nearby glyphs flip faster. **Digital rain, wallpaper colours** is the same rain, but each glyph takes the (vivid) colour of the wallpaper under it, with the picture dimmed underneath. Both follow the Mouse reaction, Strength, Speed and Zoom sliders. The glyphs are built from stroke segments in the shader, so no font or texture is needed.

### Abyss combo, Broken screen, combo names (1.20)

A themed set built as one picture, deep-sea bioluminescence, and saved as the combo **Abyss**: Screen **Deep sea** (slow light shafts from the surface, drifting marine snow, depth fog), Color **Abyss** (blue-black shadows, teal mid tones, cyan-white highlights), Wallpaper (Weather and nature) **Plankton** (glowing plankton that flares when the pointer stirs the water) and Cursor **Deep glow** (a bioluminescent wake behind the pointer). The combo is in the starter list, so it shows up after the update. Screen > Lens > **Broken screen** is a cracked-glass effect: radial cracks around an impact point, tilted shards with a rainbow split of the colours, light spectrum glowing along the cracks and an ink-bleed blotch.

A second themed set, a rainy neon night, saved as the combo **Neon Rain**: Screen **Wet window** (drops slide down a cold window and bend the picture, tiny dew drops, cool blue tint), Color **Neon noir** (indigo shadows, magenta mid tones, cyan highlights, text kept readable), Wallpaper (Weather and nature) **Neon rain** (rain over drifting neon bokeh lights, a wet puddle with ripples at the bottom, the pointer is an umbrella that keeps the rain off) and Cursor **Rain ripples** (neon rings and splash dots spread from where the pointer has been).

### Ten calm combos (1.24)

Ten more starter combos, all made to be easy on the eyes for a screen that stays on all day: low contrast, warm or cool washes, slow movement, text stays readable at the starting strengths. Each one is a single picture across Screen, Color, Wallpaper, Cursor and a window shader plus frame. **Golden Porch** (late sun, honey light, dust motes), **Misty Pines** (pine ridges in morning fog, dew on the windows), **Koi Pond** (jade water, lily pads and koi that drift toward the pointer, windows under a film of water), **Lantern Night** (paper lanterns rising, windows as shoji paper), **Tide Pool** (sunlit shallows and caustics, sea-glass windows, bubble cursor), **Snug Cabin** (snow outside, amber warmth, frost growing from the window corners), **Lavender Dusk** (lavender rows and fireflies, violet-rose glass), **Cloud Garden** (soft pastel clouds, airy window veil), **Aurora Calm** (a quiet aurora over a still lake, much subtler than the Aurora wallpaper) and **Moon Lake** (moon, silver reflection path, drifting mist). Ten new wallpaper effects sit in a new **Calm scenes** group of the Wallpaper menu, and nine new cursor overlays (`mote-glow`, `mist-trail`, `water-rings`, `lantern-spark`, `bubble-trail`, `firefly-trail`, `cloud-puff`, `star-dust`, `silver-ripples`) join the Cursor menu. The window parts need the HyprWindowShade plugin and do nothing without it.

### Six more combos, fullscreen pause, cursor Size and Speed, audio effects (1.22)

Six combos join the starter list (each is one picture designed across Screen, Color, Wallpaper, Cursor and a window frame): **Polar Night** (frost on the glass, aurora wallpaper, ice-crystal cursor), **Golden Mirage** (desert heat haze, drifting dunes, sand-kick cursor), **Hyperdrive** (ship's bridge HUD, light-speed streaks, reticle cursor), **Sakura Dusk** (falling blossom, petal-trail cursor), **Ink Wash** (washi paper, ink-wash wallpaper, brush cursor) and **Pulse**, the audio-reactive one. In Pulse the wallpaper and the cursor halo move with the music (level, bass, mid and treble of whatever the default output plays). Hyprland screen shaders cannot receive audio, so the Screen, Color and window frame of Pulse are static.

Five more combos join the starter list in 1.23, this time with real **window shaders** made for windows rather than reused screen effects (they react to which window has focus, the pointer, each window's own size and where it sits on the monitor; a new **Glass / Light / Living** group at the top of the Windows effect list). **Detective Hour**: smoky office, rain wallpaper, spotlight cursor, and venetian-blind light that drifts across each window (open on the focused one). **Dappled Grove**: sun shafts and pollen on the screen, leaf shadows moving over the windows, the pointer stirs the leaves. **Hearth Night**: a room lit only by the fire, firelight washing up each window from below, the focused one nearest the flames. **Observatory**: dome and stars on the screen, a star field with a lens glint and the odd shooting star showing through the dark parts of the windows. **Mainframe**: a dark machine hall with blinking console lamps, amber phosphor, and every window its own CRT with raster lines, a rolling refresh band and glow. The window parts need the HyprWindowShade plugin and do nothing without it.

- Combos now also save and restore the Windows effect, colour and frame (older combos without those fields leave Windows alone). Starter combos up to 1.22 set the frame only; the 1.23 ones also set a window shader (above), which needs the window plugin.
- **Fullscreen pause** (checkbox in the header, key `e`): effects switch off while the focused workspace has a fullscreen window and come back afterwards. A manual pause still wins.
- **Cursor Size and Speed** sliders in the Cursor section (keys `v`/`V` and `z`/`Z`). They apply to the overlay cursor effects; Bend cursor shaders ignore them.

Combos can have a name: press `n` on a combo (or `omarchy-shell io.github.akton1.omashaders comboRename N NAME`, N is the position in the list). The name is the 5th, optional field of a line in the `combos` file (`screen|wall|mouse|color|name`), so older lines keep working.

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
- **Subprocesses:** `bin/omashaders` (sets the shader), `bin/compose-shader` (python, merges effect and colour into one file), `bin/cursor-watch` (python; reads the pointer position from the Hyprland socket about 40 times a second, only while a pointer-following effect is running, and exits with the shell), `bin/gpu-usage` (`nvidia-smi` or sysfs, only while the menu is open), `bin/perf-log` (python; the cost log described above, started with the shell, one copy only; `omashaders perf off` stops it; it runs `nvidia-smi` and `pgrep` every few seconds, and `coredumpctl` only when you ask for a report), `bin/wallpaper-step`, and `notify-send` for the pause key.
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
- **Icon missing or the menu looks old after an update:** `omarchy-restart-shell`. Updating from a version before 1.21 needs that one restart to load the new bar widget; after it, edits to the plugin's own QML files reload by themselves (developers: see `docs/DEVELOPMENT.md`).
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

Forty-two more starter combos (v1.25.0), one for each of the new wallpaper scenes in the groups Cozy corners, Places and eras, Sea and sky, Fantasy realms, Wild places, Seasons and festivals, Sci-fi worlds, Retro machines, Art studio and Mood scenes. Each pairs the scene with a Screen shader, a Color grade, a cursor effect, a window shader and a frame: Izakaya Alley, Rainy Cafe, Seventies Lounge, Aquarelle Studio, Great Wave, Study Lamp, Library Light, Rainy Sunday, Tea House, Sleep Sky, Still Field, Breath Orb, Spa Stones, Bakery Dawn, Campfire Stars, Cumulus Sunset, Golden Sail, Ice Floes, Reef Shallows, Storm Beacon, Elven City, Dragon Hoard, Soul River, Wisp Wood, Wizard Study, Megacity Lights, Orbital Dawn, Green Screen 3270, EGA Desk, Joy Confetti, Blue Lull, Beat Bands, Jungle Mist, Oasis Noon, Prairie Storm, Savanna Dust, Tropic Lagoon, Pumpkin Night, Fairy Lights, Harvest Gold, Midsummer Heat, Green Shoots. New pieces made for them: 15 Color grades, 24 frames, 5 cursor overlays (`brush-bloom`, `neon-tube-trail`, `phosphor-ghost`, `pop-flakes`, `tear-fall`) and 11 Screen/window shaders. Window parts need the HyprWindowShade plugin.

More starter combos (v1.26.0), 58 new ones in waves, each with its own new wallpaper scene plus Screen shader, Color grade, cursor effect, window shader and frame (new or reused). Gothic and dark tales: Haunted Manor, Crypt Candles, Gothic Cathedral, Wolf Moon, Graveyard Mist, Blood Moon Castle, Witching Hour, Rooftop Noir, Ghost Ship, Pirate Cove. Frontier, steam and wastelands: Dusty Saloon, High Noon, Canyon Campfire, Steam Foundry, Airship Harbour, Clockwork Tower, Wasteland Dusk, Fallout Shelter, Overgrown City, Smoky Jazz Club. Neon nights and deep space: Chrome Rain, Ramen Skyline, Drone Alley, Outrun Highway, Vapor Pool, Arcade Night, Star Fleet Dock, Ringed Giant, Derelict Station, Alien Garden. Ancient worlds, mountains and storms: Temple of the Sun, Jungle Ruins, Pharaoh's Night, Acropolis Dawn, Alpine Dawn, Blizzard Pass, Volcano Night, Desert Stars, Thunderhead, Bus Stop Rain. Water, style studies and anime play: Deep Blue, Kelp Forest, Stadium Lights, Concrete Light, Deco Foyer, Baroque Hall, Pop Art Dots, Summer Crossing, Idol Stage, Candy Clouds.
