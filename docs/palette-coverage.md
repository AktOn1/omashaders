# Palette coverage: which colour grades a Palette can reproduce

A Palette (`bin/omspalette.py`) is a small, editable colour grade: a ramp of two to five colour stops that brightness is mapped onto, a few global controls (how much of the original colour to keep, saturation, contrast, a gamma bend, shadow and highlight tint) and an optional posterize step count. This page says honestly how many of the 140 built-in grades in `colors/` a Palette can stand in for, and why the rest are out of reach.

Everything here is measured, not guessed. `bin/palette-fit` renders every grade on a test picture with `bin/shader-preview`, searches for the Palette settings that match best at 100% strength, and compares the two images. Run it again any time with `bin/palette-fit --scratch <dir>`; the usage notes are at the top of the script.

## How "matches" is decided

The error is measured per pixel on the 0 to 1 colour scale, as the mean and as the 99th percentile (the worst 1% of pixels) of the largest channel difference.

| Class | Mean error | 99th percentile error | What it means |
| --- | --- | --- | --- |
| exact | at most 0.012 | at most 0.05 | Hard to tell apart side by side. |
| close | at most 0.030 | at most 0.12 | Same look and mood, small visible differences in some colours. |
| no | above either limit | | A Palette gives a clearly different picture. |

The test picture mixes a brightness ramp, a grid of saturated and pale colours, named colours (skin, sky, grass, foliage and so on) and photo-like gradients. A second picture the fit never saw is used as a check against overfitting. A grade gets the worse of its two classes, so a Palette that only looks right on the fitting picture is not counted as a match. This downgraded ten grades; without the check the table would look better and be less true.

The limits were chosen before the run and not adjusted afterwards.

## Counts

| Class | Grades |
| --- | --- |
| exact | 111 |
| close | 11 |
| no | 18 |
| total | 140 |

All 140 shaders rendered. The 122 exact and close grades are listed with a ready-to-use Palette id in `palettes/presets.tsv` (grade, id, quality, mean error). Every id was checked to be accepted by `bin/compose-shader --custom` and by `glslangValidator`, and the real rendered result agrees with the model used for the fit to within 0.001 mean error.

## Exact (111)

abyss, all-pink, alpenglow, amber, anime-blue, ashen-green, atomic-cream, aurora-night, banked-coals, blade-haze, bleached-tan, blue-note, blueprint, brass-age, calm, candy-pastel, cement-grey, cinema, claret, cocoa, cool, copper-sky, deco-black-gold, derelict-steel, desk-calm, dim-reader, doubloon, dune-blue, dust-orange, earthlight, eink-night, ember-hush, evergreen, fleet-blue, forest, fresh-meadow, gameboy, gaslight, geiger-green, glade, golden-hour, grave-teal, haze-blue, high-contrast, honey, horizon-gold, ice, indigo-hush, jade, kelp-light, kodachrome, lab-cyan, lagoon, lapis-gold, lavender, lavender-dusk, magma, mainframe-mint, marble-rose, miami-night, midnight, mono, moonsilver, moss, moss-concrete, mulled-wine, neon-noir, night-vision, norton-blue, ocean, outrun-dusk, pale-peach, paper, paper-lantern, pastel, pastel-pink, peach-sky, phosphor, pigment-wash, pitch-night, posterize, red-rock, rose-gold, ruin-green, rust-plain, sakura-dusk, sand-ink, sandstone, saturn-gold, silver-screen, sodium-pink, solar-corona, spectral, spore-green, starlight, storm-gold, sundown-rust, sunny-pop, sunset, tallow, teal-orange, temple-gold, terminal-green, thermal, vaporwave, velvet-gold, verdigris, vivid, wet-amber, whiteout-blue, wolfsbane

## Close (11)

These are right on the fitting picture or nearly so, but a few colours differ visibly on the second picture or in the worst pixels.

bleach-bypass, chrome-teal, cipher-red, dusk, eink, eink-color, eink-hard, nightshift, pulse-night, stained-glass, warm

Six of them (dusk, nightshift, warm, pulse-night, bleach-bypass, eink) are exact on the fitting picture and only slip to close on the second one, so they are best read as exact for ordinary content and a little off for unusual colours.

## No (18)

A Palette changes colour as a function of brightness, with a global saturation, contrast and tint. These grades do something that is not a function of brightness. One reason per grade:

**Inverts or snaps to a fixed set of colours**
- invert: flips every colour to its opposite, which a rising brightness ramp cannot do.
- cga: picks one of four fixed colours depending on brightness band and which side of the hue wheel a colour is on.
- pop-primary: replaces each colour with the nearest of red, yellow or blue ink.

**Flat brightness bands with uneven levels**
- gameboy-pocket: four flat grey levels with hard edges; a Palette's steps are evenly spaced in its own ramp and cannot put four unequal flat levels in the right places.
- virtual-boy: four flat red levels (black plus three reds), the same kind of problem.

**Keeps only some hues and treats the rest differently**
- yule-red-green: everything settles into midnight blue except reds and greens, which keep (and gain) their colour.
- sumi-shu: a warm ink-and-paper monochrome in which only reds and oranges survive, as vermilion.
- hex-purple: a violet ramp, except that bright saturated greens keep an acid green accent.

**Colour depends on hue, not just brightness**
- polar-night: warm skin tones and neutral whites are coloured differently from blues of the same brightness.
- stage-pink: warm tones go pink while cool tones go cyan.
- pink-hues: the shade of pink depends on the hue of the source colour.

**Saturation or contrast is applied after the colour mix**
- coin-op: pushes each colour channel towards a pure primary with an S-curve, then adds a blue-black floor.
- cyberpunk: a magenta to cyan gradient is mixed in, then saturation and contrast are boosted on the mixed result.
- cyan-ember: the same late saturation and contrast boost, plus pink and magenta being slid towards blue first.

**A fixed colour multiplier that breaks on extreme colours**
- sepia: a fixed channel mix that is fine for mid tones, but a brightness ramp cannot follow it on very saturated colours.
- candle: the same problem with a warm multiplier.

**A small hue accent a ramp cannot isolate**
- amber-phosphor: a leak of hue into some colours on top of a single-colour ramp.
- xeno-teal: a coral cast on warm colours over a teal ramp.

`sepia`, `candle`, `amber-phosphor` and `xeno-teal` are close on the fitting picture alone; they are listed as `no` because of the second picture.

## What would help

`bin/palette-fit --gaps` lets the fitter try extra Palette features that do not exist yet, one at a time, on the 29 grades that are not exact today. This is a prototype of the maths inside the fitter only; nothing in the Palette changes. Numbers are grades moved to exact, and grades moved from no to close or better:

| Feature tried | To exact | From no to close or better |
| --- | --- | --- |
| a 3x3 colour matrix applied after the ramp | 6 | 8 |
| per-channel gain (a colour multiplier) | 5 | 3 |
| saturation and contrast applied after the mix | 5 | 2 |
| a per-channel weight on the brightness measure | 5 | 3 |
| evenly spaced steps replaced by freely placed brightness levels | 2 | 2 |
| a seventh ramp stop | 2 | 2 |
| keeping one hue range of the original | 1 | 3 |
| smooth (not piecewise-linear) ramp, inversion, nearest-colour snap | 1, 1, 0 | 0, 1, 0 |

A colour matrix is the single most useful addition: it would leave 10 grades as `no` instead of 18. Matrix plus freely placed brightness levels does a little better again (8 more exact, 9 moved up from no), which would leave 9 as `no`. Features such as a hue test, nearest-colour snapping or a smooth ramp do not move the count, so they are not worth the shader code.
