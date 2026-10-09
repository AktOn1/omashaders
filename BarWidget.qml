import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Hyprland
import qs.Commons
import qs.Ui

// One bar icon, four effect menus (tick any of them at the top, ticked menus sit side by side):
//   Screen    full-screen GLSL effects applied by Hyprland (bin/omashaders)
//   Color     a colour grade on top of the screen effect (merged into one shader by bin/compose-shader)
//   Wallpaper animated GPU effects drawn over the wallpaper (WallpaperFx.qml) plus wallpaper picking
//   Cursor    small overlay effects drawn around the mouse pointer (MouseFx.qml)
// hjkl / arrows move, hovering highlights an effect and previews it only while Shift is held (keys preview as you move), a mouse click or Space keeps it and stays open, Enter keeps it and closes,
// Esc undoes previews.
BarWidget {
  id: root
  moduleName: "io.github.akton1.omashaders"

  function path(rel) { return Qt.resolvedUrl(rel).toString().replace(/^file:\/\//, "") }
  readonly property string script: path("bin/omashaders")
  readonly property string stepScript: path("bin/wallpaper-step")
  readonly property string cursorScript: path("bin/cursor-watch")
  readonly property string gpuScript: path("bin/gpu-usage")
  readonly property string omarchyDir: (Quickshell.env("XDG_STATE_HOME") || (Quickshell.env("HOME") + "/.local/state")) + "/omarchy"
  readonly property string stateDir: omarchyDir + "/io.github.akton1.omashaders"
  readonly property string stateFile: stateDir + "/current"
  readonly property string colorFile: stateDir + "/color"
  readonly property string colorFavFile: stateDir + "/color-favorites"
  readonly property string animatedFile: stateDir + "/animated"
  readonly property string mouseFile: stateDir + "/mouse"
  readonly property string screenFavFile: stateDir + "/screen-favorites"
  readonly property string wallEffectFile: stateDir + "/wp-effect"
  readonly property string wallPreviewFile: stateDir + "/wp-preview"
  readonly property string wallFavFile: stateDir + "/wp-favorites"
  readonly property string mouseFavFile: stateDir + "/mouse-favorites"
  readonly property string comboFile: stateDir + "/combos"
  readonly property string sectionsFile: stateDir + "/sections"
  readonly property string shiftOnlyFile: stateDir + "/shift-only"
  readonly property int fps: Number(setting("fps", 30)) || 30

  readonly property color fg: root.bar.barForeground
  function fgA(a) { return Qt.rgba(fg.r, fg.g, fg.b, a) }
  readonly property string boxOn: "󰄲"
  readonly property string boxOff: "󰄱"
  readonly property string checkGlyph: "󰄬"
  readonly property string barGlyph: "󰍹"

  function writeFile(file, content) {
    Quickshell.execDetached(["bash", "-c", 'mkdir -p "$(dirname "$1")" && printf %s "$2" > "$1"', "bash", file, content])
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

  // ---------------------------------------------------------------- which menus are shown
  property bool showScreen: true
  property bool showColor: true
  property bool showWall: true
  property bool showMouse: false
  property bool showCombo: false
  property string activeKind: "screen"
  function isShown(k) { return k === "screen" ? showScreen : (k === "color" ? showColor : (k === "wall" ? showWall : (k === "mouse" ? showMouse : showCombo))) }
  function secOf(k) { return k === "screen" ? screenSec : (k === "color" ? colorSec : (k === "wall" ? wallSec : (k === "mouse" ? mouseSec : comboSec))) }
  function kindTitle(k) { return k === "screen" ? "Screen" : (k === "color" ? "Color" : (k === "wall" ? "Wallpaper" : (k === "mouse" ? "Cursor" : "Combos"))) }
  readonly property var visibleKinds: ["screen", "color", "wall", "mouse", "combo"].filter(function(k) { return isShown(k) })
  readonly property int nVis: visibleKinds.length
  // effect menus that "off" and "surprise" act on; with only Combos shown they act on all three
  readonly property var effectKinds: {
    var k = visibleKinds.filter(function(x) { return x !== "combo" })
    return k.length > 0 ? k : ["screen", "color", "wall", "mouse"]
  }
  readonly property int nEffectVis: visibleKinds.filter(function(x) { return x !== "combo" }).length
  readonly property real comboWeight: 1
  readonly property real colorWeight: 0.85
  readonly property real widthUnits: (showScreen ? 1 : 0) + (showColor ? colorWeight : 0) + (showWall ? 1 : 0) + (showMouse ? 1 : 0) + (showCombo ? comboWeight : 0)
  readonly property string focusKind: visibleKinds.indexOf(activeKind) >= 0 ? activeKind : (visibleKinds[0] || "screen")
  readonly property var activeSec: secOf(focusKind)

  function setShown(s, w, m, persist, c, k) {
    if (c === undefined) c = showCombo
    if (k === undefined) k = showColor
    if (!s && !w && !m && !c && !k) return
    var before = { screen: showScreen, color: showColor, wall: showWall, mouse: showMouse, combo: showCombo }
    showScreen = s
    showColor = k
    showWall = w
    showMouse = m
    showCombo = c
    ;["screen", "color", "wall", "mouse", "combo"].forEach(function(kind) {
      if (isShown(kind) && !before[kind]) { secOf(kind).sync(); activeKind = kind }
    })
    if (persist) writeFile(sectionsFile, visibleKinds.join(" "))
  }
  function toggleSection(kind) {
    setShown(kind === "screen" ? !showScreen : showScreen,
             kind === "wall" ? !showWall : showWall,
             kind === "mouse" ? !showMouse : showMouse, true,
             kind === "combo" ? !showCombo : showCombo,
             kind === "color" ? !showColor : showColor)
  }
  function setSections(mode) {
    var w = String(mode).toLowerCase().split(/[\s,+]+/)
    var all = w.indexOf("all") >= 0
    var both = all || w.indexOf("both") >= 0
    setShown(both || w.indexOf("screen") >= 0, both || w.indexOf("wall") >= 0 || w.indexOf("wallpaper") >= 0,
             all || w.indexOf("mouse") >= 0 || w.indexOf("cursor") >= 0, true,
             all || w.indexOf("combo") >= 0 || w.indexOf("combos") >= 0,
             both || w.indexOf("color") >= 0 || w.indexOf("colour") >= 0)
  }
  FileView {
    path: root.sectionsFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      var t = String(text() || "")
      var s = t.indexOf("screen") >= 0, w = t.indexOf("wall") >= 0, m = t.indexOf("mouse") >= 0, c = t.indexOf("combo") >= 0, k = t.indexOf("color") >= 0
      if (!s && !w && !m && !c && !k) { s = true; k = true; w = true }
      root.setShown(s, w, m, false, c, k)
    }
  }

  function catList(entries, order) {
    var seen = {}, out = []
    order.forEach(function(c) { seen[c] = true; out.push(c) })
    entries.forEach(function(e) { if (!seen[e.cat]) { seen[e.cat] = true; out.push(e.cat) } })
    return out
  }
  function favList(all, favs) {
    var out = []
    favs.forEach(function(id) {
      for (var i = 0; i < all.length; i++) if (all[i].id === id) { out.push(all[i]); break }
    })
    return out
  }
  readonly property string favNote: "No favorites yet. Select an effect and press f."

  // ---------------------------------------------------------------- screen shaders (Hyprland)
  property var allEntries: []          // { name, animated, motion, cat, desc, section }
  property string current: ""
  property string animatedFlag: ""
  readonly property bool includeAnimated: animatedFlag !== "" ? animatedFlag === "1" : setting("includeAnimated", false) === true
  readonly property bool shaderOn: current !== ""
  property var screenFavs: []
  property string screenOrigin: ""
  property bool screenPreviewed: false
  property string screenPending: ""

  readonly property var screenEntries: allEntries.filter(function(e) { return e.section === "screen" })
  function screenItem(e) { return { id: e.name, label: e.name, desc: e.desc, hint: e.animated ? "heavy" : "" } }
  readonly property var screenItems: screenEntries.filter(function(e) { return includeAnimated || !e.animated }).map(screenItem)
  readonly property var screenCats: {
    var out = [{ id: "fav", label: "Favorites", items: favList(screenItems, screenFavs), note: favNote }]
    catList(screenEntries, ["Retro", "Devices", "Mood", "Motion"]).forEach(function(c) {
      out.push({ id: c, label: c,
                 items: screenEntries.filter(function(e) { return e.cat === c && (includeAnimated || !e.animated) }).map(screenItem),
                 note: (c === "Motion" && !includeAnimated) ? "Heavy GPU use. Press a to turn animated screen effects on." : "" })
    })
    out.push({ id: "@random", label: "Surprise me", action: true })
    out.push({ id: "@off", label: "Off", action: true })
    return out
  }

  function applyScreen(name) {
    Quickshell.execDetached(name === "" ? [root.script, "effect", "off"] : [root.script, "effect", "set", name])
  }
  function previewScreen(it) {
    if (!it || it.id.charAt(0) === "@" || it.id === current) { screenTimer.stop(); return }
    screenPending = it.id
    screenPreviewed = true
    screenTimer.restart()
  }
  Timer { id: screenTimer; interval: 140; onTriggered: root.applyScreen(root.screenPending) }
  function chooseScreen(it, keep) {
    if (!it) return
    screenTimer.stop()
    applyScreen(it.id)
    screenOrigin = it.id
    screenPreviewed = false
    if (!keep) popupOpen = false
  }
  function setAnimated() {
    Quickshell.execDetached([root.script, "animated", root.includeAnimated ? "off" : "on"])
  }
  function screenStep(verb) {
    var cmd = [root.script, verb]
    if (root.includeAnimated && (verb === "next" || verb === "prev")) cmd.push("-a")
    Quickshell.execDetached(cmd)
  }

  Process {
    id: lister
    command: [root.script, "listall"]
    stdout: StdioCollector {
      onStreamFinished: {
        var out = []
        String(text).split("\n").forEach(function(line) {
          var p = line.split("\t")
          if (p[0]) out.push({ name: p[0], animated: p[1] === "animated", motion: p[1] === "motion", cat: p[2] || "Other", desc: p[3] || "", section: p[4] || "screen" })
        })
        var first = root.allEntries.length === 0
        root.allEntries = out
        if (first && root.popupOpen) { screenSec.sync(); colorSec.sync(); mouseSec.sync() }
      }
    }
  }
  FileView {
    path: root.animatedFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.animatedFlag = String(text() || "").trim()
    onLoadFailed: root.animatedFlag = ""
  }
  FileView {
    path: root.stateFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.current = String(text() || "").trim()
    onLoadFailed: root.current = ""
  }
  FileView {
    path: root.screenFavFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.screenFavs = String(text() || "").split(/\s+/).filter(function(f) { return f !== "" })
  }
  // Hyprland forgets the screen shader on a config reload, so it is re-applied
  Connections {
    target: Hyprland
    function onRawEvent(event) {
      if (event.name === "configreloaded" && (root.shaderOn || root.colorOn)) reapplyTimer.restart()
    }
  }
  Timer { id: reapplyTimer; interval: 400; onTriggered: root.screenStep("reapply") }

  // ---------------------------------------------------------------- colour grade (merged with the screen effect)
  property string colorCurrent: ""
  property var colorFavs: []
  property string colorOrigin: ""
  property bool colorPreviewed: false
  property string colorPending: ""
  readonly property bool colorOn: colorCurrent !== ""

  readonly property var colorEntries: allEntries.filter(function(e) { return e.section === "color" })
  function colorItem(e) { return { id: e.name, label: e.name, desc: e.desc, hint: "" } }
  readonly property var colorItems: colorEntries.map(colorItem)
  readonly property var colorCats: {
    var out = [{ id: "fav", label: "Favorites", items: favList(colorItems, colorFavs), note: favNote }]
    catList(colorEntries, ["Comfort", "Color", "Retro", "Devices"]).forEach(function(c) {
      out.push({ id: c, label: c, items: colorEntries.filter(function(e) { return e.cat === c }).map(colorItem), note: "" })
    })
    out.push({ id: "@random", label: "Surprise me", action: true })
    out.push({ id: "@off", label: "Off", action: true })
    return out
  }

  function applyColor(name) {
    Quickshell.execDetached(name === "" ? [root.script, "color", "off"] : [root.script, "color", "set", name])
  }
  function previewColor(it) {
    if (!it || it.id.charAt(0) === "@" || it.id === colorCurrent) { colorTimer.stop(); return }
    colorPending = it.id
    colorPreviewed = true
    colorTimer.restart()
  }
  Timer { id: colorTimer; interval: 140; onTriggered: root.applyColor(root.colorPending) }
  function chooseColor(it, keep) {
    if (!it) return
    colorTimer.stop()
    applyColor(it.id)
    colorOrigin = it.id
    colorPreviewed = false
    if (!keep) popupOpen = false
  }
  FileView {
    path: root.colorFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.colorCurrent = String(text() || "").trim()
    onLoadFailed: root.colorCurrent = ""
  }
  FileView {
    path: root.colorFavFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.colorFavs = String(text() || "").split(/\s+/).filter(function(f) { return f !== "" })
  }

  // ---------------------------------------------------------------- cursor overlays (MouseFx)
  property string mouseCurrent: ""
  property var mouseFavs: []
  property string mouseOrigin: ""
  property bool mousePreviewed: false
  property string mousePending: ""
  readonly property bool mouseOn: mouseCurrent !== ""

  readonly property var mouseEntries: allEntries.filter(function(e) { return e.section === "mouse" })
  function mouseItem(e) { return { id: e.name, label: e.name, desc: e.desc, hint: e.motion ? "animated" : "" } }
  readonly property var mouseItems: mouseEntries.map(mouseItem)
  readonly property var mouseCats: {
    var out = [{ id: "fav", label: "Favorites", items: favList(mouseItems, mouseFavs), note: favNote }]
    catList(mouseEntries, ["Focus", "Glow", "Trail"]).forEach(function(c) {
      out.push({ id: c, label: c, items: mouseEntries.filter(function(e) { return e.cat === c }).map(mouseItem), note: "" })
    })
    out.push({ id: "@random", label: "Surprise me", action: true })
    out.push({ id: "@off", label: "Off", action: true })
    return out
  }
  readonly property bool mouseMotion: {
    for (var i = 0; i < mouseEntries.length; i++) if (mouseEntries[i].name === mouseCurrent) return mouseEntries[i].motion
    return false
  }

  function applyMouse(name) {
    Quickshell.execDetached(name === "" ? [root.script, "mouse", "off"] : [root.script, "mouse", "set", name])
  }
  function previewMouse(it) {
    if (!it || it.id.charAt(0) === "@" || it.id === mouseCurrent) { mouseTimer.stop(); return }
    mousePending = it.id
    mousePreviewed = true
    mouseTimer.restart()
  }
  Timer { id: mouseTimer; interval: 140; onTriggered: root.applyMouse(root.mousePending) }
  function chooseMouse(it, keep) {
    if (!it) return
    mouseTimer.stop()
    applyMouse(it.id)
    mouseOrigin = it.id
    mousePreviewed = false
    if (!keep) popupOpen = false
  }
  FileView {
    path: root.mouseFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.mouseCurrent = String(text() || "").trim()
    onLoadFailed: root.mouseCurrent = ""
  }
  FileView {
    path: root.mouseFavFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.mouseFavs = String(text() || "").split(/\s+/).filter(function(f) { return f !== "" })
  }

  // ---------------------------------------------------------------- wallpaper effects
  readonly property var wallBase: [
    { id: "wall", label: "Wallpaper", items: [
      { id: "@pick", label: "Pick an image…", hint: root.wallStatus },
      { id: "@next", label: "Next wallpaper", hint: "" },
      { id: "@prev", label: "Previous wallpaper", hint: "" }
    ] },
    { id: "mouse", label: "Follows the mouse", items: [
      { id: "ripples",   label: "Water ripples",   hint: "spread from mouse" },
      { id: "spotlight", label: "Spotlight",       hint: "warm light" },
      { id: "parallax",  label: "Parallax drift",  hint: "shifts with mouse" },
      { id: "lens",      label: "Magnifier",       hint: "lens at mouse" },
      { id: "chroma",    label: "Chromatic edges", hint: "colour split" },
      { id: "pixel",     label: "Pixel reveal",    hint: "sharp at mouse" },
      { id: "shock",     label: "Shockwave",       hint: "rings from mouse" },
      { id: "blackhole", label: "Black hole",      hint: "bends the wallpaper" },
      { id: "xray",      label: "Negative lens",   hint: "inverts at mouse" },
      { id: "grid",      label: "Gravity grid",    hint: "grid pulled to mouse" }
    ] },
    { id: "nature", label: "Weather and nature", items: [
      { id: "rain",      label: "Rain on glass",   hint: "mouse wipes it dry" },
      { id: "snow",      label: "Snowfall",        hint: "swerves from mouse" },
      { id: "petals",    label: "Sakura petals",   hint: "falling petals" },
      { id: "fireflies", label: "Fireflies",       hint: "flee the mouse" },
      { id: "fog",       label: "Fog drift",       hint: "mouse clears it" },
      { id: "storm",     label: "Thunderstorm",    hint: "rain, lightning" },
      { id: "embers",    label: "Embers",          hint: "sparks flee mouse" },
      { id: "meteors",   label: "Meteor shower",   hint: "shooting stars" },
      { id: "rays",      label: "Light rays",      hint: "sun shafts, dust" },
      { id: "bubbles",   label: "Bubbles",         hint: "rising, refracting" }
    ] },
    { id: "scenes", label: "New scenes", items: [
      { id: "aurora",    label: "Night aurora",    hint: "moon and stars" },
      { id: "silk",      label: "Silk flow",       hint: "glow at mouse" },
      { id: "warp",      label: "Star warp",       hint: "mouse steers" },
      { id: "nebula",    label: "Nebula",          hint: "space clouds" },
      { id: "ocean",     label: "Moonlit ocean",   hint: "waves, reflection" },
      { id: "plasma",    label: "Plasma",          hint: "theme colours" },
      { id: "lava",      label: "Lava lamp",       hint: "blobs, mouse attracts" },
      { id: "synth",     label: "Synthwave",       hint: "sun and grid" },
      { id: "matrix",    label: "Digital rain",    hint: "mouse lights it" },
      { id: "crystals",  label: "Crystals",        hint: "glowing cells" }
    ] },
    { id: "looks", label: "Looks on your wallpaper", items: [
      { id: "liquid",    label: "Liquid shimmer",  hint: "slow warp" },
      { id: "crt",       label: "Retro CRT",       hint: "scanlines, flicker" },
      { id: "glitch",    label: "Glitch",          hint: "bursts near mouse" },
      { id: "wash",      label: "Colour wash",     hint: "theme tint" },
      { id: "vhs",       label: "VHS tape",        hint: "tracking, noise" },
      { id: "halftone",  label: "Halftone",        hint: "dots, mouse reveals" },
      { id: "haze",      label: "Heat haze",       hint: "shimmer" },
      { id: "kaleido",   label: "Kaleidoscope",    hint: "mirrored, turning" },
      { id: "duotone",   label: "Duotone",         hint: "theme gradient map" },
      { id: "neon",      label: "Neon edges",      hint: "glowing outlines" },
      { id: "cinema",    label: "Film grain",      hint: "vignette, flicker" }
    ] }
  ]
  readonly property var wallEffects: {
    var out = []
    for (var i = 1; i < wallBase.length; i++) out = out.concat(wallBase[i].items)
    return out
  }
  property var wallFavs: []
  readonly property var wallCats: {
    var out = [wallBase[0], { id: "fav", label: "Favorites", items: favList(wallEffects, wallFavs), note: favNote }]
    for (var i = 1; i < wallBase.length; i++) out.push(wallBase[i])
    out.push({ id: "@random", label: "Surprise me", action: true })
    out.push({ id: "@off", label: "Off", action: true })
    return out
  }
  function wallLabel(id) {
    for (var i = 0; i < wallEffects.length; i++) if (wallEffects[i].id === id) return wallEffects[i].label
    return id
  }

  property string wallSaved: ""
  property string wallPreview: ""
  readonly property string wallShown: wallPreview !== "" ? wallPreview : wallSaved
  readonly property bool wallOn: wallShown !== ""
  property bool wallPreviewed: false
  property string wallHoverId: ""
  property string wallStatus: ""
  property string wallpaperPath: ""
  property real wheelAccum: 0
  // every monitor's bar loads this widget; only the first one hosts the effect windows
  readonly property bool fxHost: QsWindow.window !== null && QsWindow.window.screen === Quickshell.screens[0]
  onWallShownChanged: if (wallShown !== "") resolver.running = true

  function previewWall(it) {
    if (!it || it.id.charAt(0) === "@" || it.id === wallShown) { wallHoverTimer.stop(); return }
    wallHoverId = it.id
    wallHoverTimer.restart()
  }
  // a preview goes through a file: only the first monitor's instance draws, the others must see it too
  Timer {
    id: wallHoverTimer
    interval: 150
    onTriggered: { root.wallPreviewed = true; root.writeFile(root.wallPreviewFile, root.wallHoverId) }
  }
  function clearWallPreview() {
    wallHoverTimer.stop()
    if (!wallPreviewed) return
    wallPreviewed = false
    wallPreview = ""
    writeFile(wallPreviewFile, "")
  }
  function setWall(id, keep) {
    wallSaved = id
    clearWallPreview()
    writeFile(wallEffectFile, id)
    resolver.running = true
    if (!keep) popupOpen = false
  }
  function chooseWall(it, keep) {
    if (!it) return
    if (it.id === "@pick") pickWallpaper()
    else if (it.id === "@next") wallStep("next")
    else if (it.id === "@prev") wallStep("prev")
    else setWall(it.id, keep)
  }

  Process {
    id: stepProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: { root.wallStatus = String(text).trim(); resolver.running = true }
    }
  }
  function wallStep(action) {
    if (stepProc.running) return
    stepProc.command = [root.stepScript, action]
    stepProc.running = true
  }
  function pickWallpaper() {
    popupOpen = false
    Quickshell.execDetached([root.stepScript, "pick"])
    pickRefresh.restart()
  }
  Timer {
    id: pickRefresh
    interval: 15000
    repeat: true
    property int n: 0
    onTriggered: { resolver.running = true; if (++n >= 8) { n = 0; stop() } }
  }

  // real path of the current wallpaper (the effects sample it as a texture)
  Process {
    id: resolver
    command: ["readlink", "-f", root.omarchyDir + "/current/background"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.wallpaperPath = String(text).trim()
    }
  }
  Timer { interval: 4000; repeat: true; running: root.wallOn && root.fxHost; onTriggered: resolver.running = true }

  FileView {
    path: root.wallEffectFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.wallSaved = String(text() || "").trim()
    onLoadFailed: root.wallSaved = ""
  }
  FileView {
    path: root.wallPreviewFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.wallPreview = String(text() || "").trim()
    onLoadFailed: root.wallPreview = ""
  }
  FileView {
    path: root.wallFavFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.wallFavs = String(text() || "").split(/\s+/).filter(function(f) { return f !== "" })
  }

  // theme colours for the wallpaper effects
  property var palette: ({})
  FileView {
    path: root.omarchyDir + "/current/theme/colors.toml"
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      var t = String(text()), p = {}
      var re = /^\s*([a-z_0-9]+)\s*=\s*"(#[0-9a-fA-F]{6})"/gm, m
      while ((m = re.exec(t)) !== null) p[m[1]] = m[2]
      root.palette = p
    }
  }
  function pal(key, fallback) { return root.palette[key] || fallback }

  WallpaperFx {
    effect: root.fxHost ? root.wallShown : ""
    wallpaper: root.wallpaperPath
    mouse: root.cursorLive ? root.cursor : Qt.point(-10000, -10000)
    fps: root.fps
    cBg: root.pal("background", "#050318")
    cBlue: root.pal("bright_blue", "#7a8cff")
    cMagenta: root.pal("bright_magenta", "#da6fef")
    cPink: root.pal("bright_yellow", "#f56c90")
    cCream: root.pal("foreground", "#FAF0BF")
  }
  // ---------------------------------------------------------------- "only while Shift is held"
  // Hyprland has to forward Shift to the shell: bind = Shift_L (see README, "Shift only").
  property string shiftOnlyFlag: ""
  readonly property bool shiftOnly: shiftOnlyFlag === "" ? setting("cursorNeedsShift", false) === true : shiftOnlyFlag === "on"
  property bool shiftDown: false
  readonly property bool cursorLive: !shiftOnly || shiftDown
  function setShiftOnly(v) { writeFile(shiftOnlyFile, v ? "on" : "off") }
  FileView {
    path: root.shiftOnlyFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.shiftOnlyFlag = String(text() || "").trim()
    onLoadFailed: root.shiftOnlyFlag = ""
  }
  Loader {
    active: root.fxHost && root.shiftOnly
    sourceComponent: GlobalShortcut {
      appid: "omashaders"
      name: "shift"
      onPressed: root.shiftDown = true
      onReleased: root.shiftDown = false
    }
  }
  onShiftOnlyChanged: if (!shiftOnly) shiftDown = false

  MouseFx {
    effect: root.fxHost && root.mouseOn && root.cursorLive ? root.mouseCurrent : ""
    motion: root.mouseMotion
    mouse: root.cursor
    fps: root.fps
  }

  // cursor position, polled from Hyprland only while an effect that follows it is running
  property point cursor: Qt.point(-10000, -10000)
  Process {
    running: (root.wallOn || (root.mouseOn && root.cursorLive)) && root.fxHost
    command: [root.cursorScript]
    stdout: SplitParser {
      onRead: function(line) {
        var p = line.split(",")
        if (p.length === 2) root.cursor = Qt.point(Number(p[0]), Number(p[1]))
      }
    }
  }

  // ---------------------------------------------------------------- combination favorites
  // A combo is the Screen effect, Wallpaper effect, Cursor effect and Color together; one line per combo
  // in the state file: "screen|wall|mouse|color" (an empty part means off; older 3-part lines have no colour).
  property var combos: []
  property string comboFlash: ""
  function comboKey(s, w, m, c) { return s + "|" + w + "|" + m + "|" + c }
  function comboItem(line) {
    var p = line.split("|")
    var s = p[0] || "", w = p[1] || "", m = p[2] || "", c = p[3] || ""
    var names = [s, c, w !== "" ? wallLabel(w) : "", m].filter(function(x) { return x !== "" })
    return { id: line, screen: s, wall: w, mouse: m, color: c, label: names.join(" + "),
             desc: "Screen " + (s || "off") + " · Color " + (c || "off") + " · Wallpaper " + (w !== "" ? wallLabel(w) : "off") + " · Cursor " + (m || "off") }
  }
  readonly property var comboItems: combos.map(comboItem)
  readonly property string comboNow: comboKey(current, wallShown, mouseCurrent, colorCurrent)
  readonly property var comboCats: [
    { id: "combos", label: "Saved", items: comboItems,
      note: "No combos yet. Set up Screen, Color, Wallpaper and Cursor the way you like, then press F." },
    { id: "@save", label: "Save current  (F)", action: true }
  ]
  function flash(msg) { comboFlash = msg; comboFlashTimer.restart() }
  Timer { id: comboFlashTimer; interval: 3000; onTriggered: root.comboFlash = "" }

  function saveCombo() {
    var key = comboNow
    if (key === "|||") { flash("Nothing to save: every effect is off"); return }
    var label = comboItem(key).label
    if (combos.indexOf(key) >= 0) { flash("Already saved: " + label); return }
    combos = combos.concat([key])
    writeFile(comboFile, combos.join("\n"))
    flash("Saved combo: " + label)
  }
  function deleteCombo(id) {
    if (combos.indexOf(id) < 0) return
    combos = combos.filter(function(c) { return c !== id })
    writeFile(comboFile, combos.join("\n"))
    var s = comboSec
    if (s.curItems.length === 0) s.col = 0
    else s.itemIdx = clamp(s.itemIdx, 0, s.curItems.length - 1)
    flash("Removed combo: " + comboItem(id).label)
  }
  function previewCombo(it) {
    if (!it || it.id.charAt(0) === "@") return
    previewScreen({ id: it.screen })
    previewColor({ id: it.color })
    previewMouse({ id: it.mouse })
    if (it.wall !== "") previewWall({ id: it.wall })
  }
  function applyCombo(it, keep) {
    if (!it || it.id.charAt(0) === "@") return
    chooseScreen({ id: it.screen }, true)
    chooseColor({ id: it.color }, true)
    chooseMouse({ id: it.mouse }, true)
    setWall(it.wall, true)
    if (!keep) popupOpen = false
  }
  function comboAt(n) {
    var i = Math.floor(Number(n)) - 1
    return i >= 0 && i < combos.length ? comboItem(combos[i]) : null
  }
  FileView {
    path: root.comboFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.combos = String(text() || "").split("\n").map(function(l) { return l.split("|").length === 3 ? l + "|" : l })
                                .filter(function(l) { return l.split("|").length === 4 && l !== "|||" })
  }

  // ---------------------------------------------------------------- GPU use (only while the menu is open)
  property string gpuText: ""
  function pct(v) { return v === "na" ? "–" : v + "%" }
  Process {
    id: gpuProc
    command: [root.gpuScript]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var p = String(text).trim().split(/\s+/)
        if (p.length !== 5) { root.gpuText = ""; return }
        var vram = p[3] === "na" ? "" : " · VRAM " + (p[3] / 1024).toFixed(1) + "/" + (p[4] / 1024).toFixed(1) + "G"
        root.gpuText = "GPU: this shell " + root.pct(p[1]) + " · Hyprland " + root.pct(p[2]) + " · all apps " + root.pct(p[0]) + vram
      }
    }
  }
  Timer {
    id: gpuTimer
    interval: 2500
    repeat: true
    running: root.popupOpen
    triggeredOnStart: true
    onTriggered: if (!gpuProc.running) gpuProc.running = true
  }

  // ---------------------------------------------------------------- menu actions
  property bool popupOpen: false
  property bool viaEnter: false
  // the bar addresses panel widgets through these
  readonly property bool opened: popupOpen
  property bool popoutSwitchClosing: false
  function open() { popupOpen = true }
  function close() { popupOpen = false }
  function toggle() { popupOpen = !popupOpen }
  function closeForPopoutSwitch() {
    popoutSwitchClosing = true
    popupOpen = false
    Qt.callLater(function() { popoutSwitchClosing = false })
  }
  onPopupOpenChanged: {
    if (popupOpen) {
      screenOrigin = current
      colorOrigin = colorCurrent
      mouseOrigin = mouseCurrent
      screenPreviewed = false
      colorPreviewed = false
      mousePreviewed = false
      wallPreviewed = false
      activeKind = visibleKinds[0]
      screenSec.sync()
      colorSec.sync()
      wallSec.sync()
      mouseSec.sync()
      comboSec.sync()
    } else {
      screenTimer.stop()
      colorTimer.stop()
      mouseTimer.stop()
      if (screenPreviewed) { applyScreen(screenOrigin); screenPreviewed = false }
      if (colorPreviewed) { applyColor(colorOrigin); colorPreviewed = false }
      if (mousePreviewed) { applyMouse(mouseOrigin); mousePreviewed = false }
      clearWallPreview()
    }
  }

  function savedOf(k) { return k === "screen" ? current : (k === "color" ? colorCurrent : (k === "wall" ? wallSaved : mouseCurrent)) }
  function favsOf(k) { return k === "screen" ? screenFavs : (k === "color" ? colorFavs : (k === "wall" ? wallFavs : mouseFavs)) }
  function favFileOf(k) { return k === "screen" ? screenFavFile : (k === "color" ? colorFavFile : (k === "wall" ? wallFavFile : mouseFavFile)) }
  function itemsOf(k) { return k === "screen" ? screenItems : (k === "color" ? colorItems : (k === "wall" ? wallEffects : mouseItems)) }
  function chooseIn(k, it, keep) {
    if (k === "screen") chooseScreen(it, keep)
    else if (k === "color") chooseColor(it, keep)
    else if (k === "wall") chooseWall(it, keep)
    else chooseMouse(it, keep)
  }
  function offIn(k) {
    if (k === "combo") offAll()
    else if (k === "wall") setWall("", true)
    else chooseIn(k, { id: "" }, true)
  }
  function randomIn(k) {
    if (k === "combo") { randomAll(); return }
    var cur = k === "wall" ? wallShown : savedOf(k)
    var pool = itemsOf(k).filter(function(e) { return e.id !== cur })
    if (pool.length > 0) chooseIn(k, pool[Math.floor(Math.random() * pool.length)], true)
  }
  function randomAll() { effectKinds.forEach(randomIn) }
  function offAll() { effectKinds.forEach(offIn) }
  function runAction(k, id) {
    if (k === "combo") { if (id === "@save") saveCombo(); return }
    if (id === "@off") offIn(k)
    else if (id === "@random") randomIn(k)
  }
  function toggleFav(k) {
    var s = secOf(k), it = s.selected
    if (!it || it.id.charAt(0) === "@") return
    if (k === "combo") { deleteCombo(it.id); return }
    var next = favsOf(k).filter(function(f) { return f !== it.id })
    if (next.length === favsOf(k).length) next.push(it.id)
    if (k === "screen") screenFavs = next
    else if (k === "color") colorFavs = next
    else if (k === "wall") wallFavs = next
    else mouseFavs = next
    writeFile(favFileOf(k), next.join("\n"))
    if (s.curItems.length === 0) s.col = 0
    else s.itemIdx = clamp(s.itemIdx, 0, s.curItems.length - 1)
  }
  function shiftFocus(dir) {
    var i = visibleKinds.indexOf(focusKind) + dir
    if (i < 0 || i >= nVis) return false
    activeKind = visibleKinds[i]
    return true
  }
  function moveKeys(dx, dy) {
    var s = secOf(focusKind)
    var r = s.move(dx, dy)
    if (r === 1) {
      if (shiftFocus(1)) secOf(focusKind).col = 0
      else s.activate(false)
    } else if (r === -1) {
      if (shiftFocus(-1)) { var p = secOf(focusKind); if (p.curItems.length > 0) p.col = 1 }
    }
  }
  function handleText(t) {
    var k = focusKind, s = secOf(k)
    if (t === "q") close()
    else if (t === "a") setAnimated()
    else if (t === "o" || t === "0") offIn(k)
    else if (t === "O") offAll()
    else if (t === "r") randomIn(k)
    else if (t === "R") randomAll()
    else if (t === "g") s.jump(false)
    else if (t === "G") s.jump(true)
    else if (t === "f") toggleFav(k)
    else if (t === "F") saveCombo()
    else if (t === "m") toggleSection("combo")
    else if (t === "s") toggleSection("screen")
    else if (t === "C") toggleSection("color")
    else if (t === "w") toggleSection("wall")
    else if (t === "c") toggleSection("mouse")
    else if (t === "x") setShiftOnly(!shiftOnly)
    else if (t >= "1" && t <= "9") s.gotoCat(parseInt(t) - 1)
  }

  IpcHandler {
    target: "io.github.akton1.omashaders"
    function toggle(): void { root.toggle() }
    function open(): void { root.open() }
    function close(): void { root.close() }
    function set(name: string): void { root.applyScreen(name === "off" ? "" : name) }
    function setColor(name: string): void { root.applyColor(name === "off" ? "" : name) }
    function setMouse(name: string): void { root.applyMouse(name === "off" ? "" : name) }
    function wallpaper(name: string): void { root.setWall(name === "off" ? "" : name, true) }
    function sections(mode: string): void { root.setSections(mode) }
    function combo(which: string): void { if (which === "save") root.saveCombo(); else root.applyCombo(root.comboAt(which), true) }
    function shiftOnly(mode: string): void { root.setShiftOnly(mode === "toggle" ? !root.shiftOnly : (mode === "on" || mode === "1")) }
  }

  Component.onCompleted: {
    lister.running = true
    resolver.running = true
    wallStep("status")
    // a watch on a missing file never fires, so the state files must exist; the preview file starts empty
    Quickshell.execDetached(["bash", "-c", 'mkdir -p "$1"; : > "$2"; shift 2; for f in "$@"; do [ -e "$f" ] || : > "$f"; done', "bash",
                             root.stateDir, root.wallPreviewFile, root.stateFile, root.colorFile, root.colorFavFile, root.animatedFile, root.mouseFile, root.sectionsFile, root.shiftOnlyFile,
                             root.screenFavFile, root.wallEffectFile, root.wallFavFile, root.mouseFavFile, root.comboFile])
  }

  // ---------------------------------------------------------------- the bar icon
  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.barGlyph
    active: root.shaderOn || root.colorOn || root.wallOn || root.mouseOn
    tooltipText: "OmaShaders\nScreen: " + (root.shaderOn ? root.current : "off")
                 + "\nColor: " + (root.colorOn ? root.colorCurrent : "off")
                 + "\nWallpaper effect: " + (root.wallOn ? root.wallLabel(root.wallShown) : "off")
                 + "\nCursor: " + (root.mouseOn ? root.mouseCurrent : "off") + (root.shiftOnly ? " (only while Shift is held)" : "")
                 + (root.wallStatus !== "" ? "\nWallpaper image: " + root.wallStatus : "")
                 + "\nclick: menu (hjkl) · right-click: effects off · middle-click: next wallpaper · scroll: step"
    onPressed: function(b) {
      if (b === Qt.RightButton) root.offAll()
      else if (b === Qt.MiddleButton) root.wallStep("next")
      else root.toggle()
    }
    onWheelMoved: function(delta) {
      if (root.showScreen) { root.screenStep(delta > 0 ? "prev" : "next"); return }
      root.wheelAccum += delta
      if (Math.abs(root.wheelAccum) < 120) return
      root.wallStep(root.wheelAccum > 0 ? "prev" : "next")
      root.wheelAccum = 0
    }
  }

  // ---------------------------------------------------------------- menu widgets
  component MenuRow: Rectangle {
    id: row
    property string label: ""
    property bool dim: false
    signal clicked()
    width: parent ? parent.width : 0
    height: Style.space(28)
    radius: Style.space(6)
    color: mouse.containsMouse && !dim ? root.fgA(0.14) : root.fgA(0.06)
    opacity: dim ? 0.4 : 1

    Text {
      anchors.left: parent.left
      anchors.leftMargin: Style.space(10)
      anchors.right: parent.right
      anchors.rightMargin: Style.space(6)
      anchors.verticalCenter: parent.verticalCenter
      elide: Text.ElideRight
      textFormat: Text.PlainText
      text: row.label
      color: root.fg
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body
    }
    MouseArea {
      id: mouse
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: row.dim ? Qt.ArrowCursor : Qt.PointingHandCursor
      onClicked: if (!row.dim) row.clicked()
    }
  }

  // One effect menu: categories on the left, effects on the right. Keyboard state lives here;
  // the widget reacts to pointed (hover or keyboard highlight), chosen and acted signals.
  component SectionMenu: Item {
    id: sec
    property string title: ""
    property var cats: []
    property string saved: ""
    property var favs: []
    property bool focused: false
    property int defaultCat: 0
    property int col: 0
    property int catIdx: 0
    property int itemIdx: 0
    property point lastPt: Qt.point(-100, -100)
    readonly property int rowH: Style.space(28)
    readonly property int rowGap: Style.space(2)
    readonly property int visibleRows: 13
    readonly property var curCat: cats.length > 0 ? cats[root.clamp(catIdx, 0, cats.length - 1)] : null
    readonly property var curItems: (curCat && curCat.items) ? curCat.items : []
    readonly property var selected: (col === 1 && itemIdx >= 0 && itemIdx < curItems.length) ? curItems[itemIdx] : null
    signal pointed(var item)
    signal chosen(var item, bool keep)
    signal acted(string id)
    signal focusRequested()

    implicitHeight: Style.space(24) + visibleRows * (rowH + rowGap)

    function indexOfSaved(ci) {
      if (saved === "" || ci < 0 || ci >= cats.length) return -1
      var it = cats[ci].items || []
      for (var j = 0; j < it.length; j++) if (it[j].id === saved) return j
      return -1
    }
    function catOfSaved() {
      for (var i = 0; i < cats.length; i++) if (cats[i].id !== "fav" && indexOfSaved(i) >= 0) return i
      return -1
    }
    function sync() {
      var ci = catOfSaved()
      if (ci >= 0) { catIdx = ci; itemIdx = indexOfSaved(ci); col = 1 }
      else { catIdx = Math.min(defaultCat, Math.max(0, cats.length - 1)); itemIdx = 0; col = 0 }
    }
    function gotoCat(n) {
      if (n < 0 || n >= cats.length) return
      col = 0
      catIdx = n
      itemIdx = Math.max(0, indexOfSaved(n))
    }
    // returns 1 when "right" was pressed on an effect (nothing further right in this menu),
    // -1 when "left" was pressed on a category (nothing further left), else 0
    function move(dx, dy) {
      if (dy !== 0) {
        if (col === 0) {
          catIdx = root.clamp(catIdx + dy, 0, cats.length - 1)
          itemIdx = Math.max(0, indexOfSaved(catIdx))
        } else if (curItems.length > 0) {
          itemIdx = root.clamp(itemIdx + dy, 0, curItems.length - 1)
          pointed(selected)
        }
      } else if (dx > 0) {
        if (col === 0) {
          if (curCat && curCat.action) acted(curCat.id)
          else if (curItems.length > 0) { col = 1; itemIdx = root.clamp(itemIdx, 0, curItems.length - 1); pointed(selected) }
        } else {
          return 1
        }
      } else if (dx < 0) {
        if (col === 1) col = 0
        else return -1
      }
      return 0
    }
    function jump(last) {
      if (col === 0) { catIdx = last ? cats.length - 1 : 0; itemIdx = Math.max(0, indexOfSaved(catIdx)) }
      else if (curItems.length > 0) { itemIdx = last ? curItems.length - 1 : 0; pointed(selected) }
    }
    function activate(keep) {
      if (col === 0) {
        if (curCat && curCat.action) acted(curCat.id)
        else if (curItems.length > 0) { col = 1; itemIdx = root.clamp(itemIdx, 0, curItems.length - 1); pointed(selected) }
      } else if (selected) {
        chosen(selected, keep)
      }
    }
    // pointer events also arrive when a list scrolls under a resting mouse; only real movement counts
    function realMove(area, m) {
      var p = area.mapToItem(null, m.x, m.y)
      if (Math.abs(p.x - lastPt.x) < 2 && Math.abs(p.y - lastPt.y) < 2) return false
      lastPt = p
      return true
    }
    function showSelected() {
      if (curItems.length > 0) list.positionViewAtIndex(root.clamp(itemIdx, 0, curItems.length - 1), ListView.Contain)
    }
    onItemIdxChanged: showSelected()
    onCurItemsChanged: Qt.callLater(showSelected)

    Text {
      id: titleText
      height: Style.space(24)
      verticalAlignment: Text.AlignVCenter
      leftPadding: Style.space(10)
      textFormat: Text.PlainText
      text: sec.title.toUpperCase()
      opacity: sec.focused ? 0.95 : 0.45
      color: root.fg
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body * 0.8
      font.bold: true
      font.letterSpacing: 1
    }

    Row {
      id: panes
      anchors.top: titleText.bottom
      anchors.left: parent.left
      anchors.right: parent.right
      spacing: Style.space(8)

      Column {
        id: catCol
        width: Math.round(sec.width * 0.34)
        spacing: sec.rowGap

        Repeater {
          model: sec.cats

          Rectangle {
            id: catRow
            required property var modelData
            required property int index
            readonly property bool selected: index === sec.catIdx
            readonly property bool hasSaved: modelData.id !== "fav" && sec.indexOfSaved(index) >= 0
            width: catCol.width
            height: sec.rowH
            radius: Style.space(6)
            color: selected ? root.fgA(sec.col === 0 && sec.focused ? 0.2 : 0.09) : "transparent"

            Text {
              anchors.left: parent.left
              anchors.leftMargin: Style.space(10)
              anchors.right: marker.left
              anchors.verticalCenter: parent.verticalCenter
              elide: Text.ElideRight
              textFormat: Text.PlainText
              text: catRow.modelData.label
              color: root.fg
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body
            }
            Text {
              id: marker
              anchors.right: parent.right
              anchors.rightMargin: Style.space(10)
              anchors.verticalCenter: parent.verticalCenter
              textFormat: Text.PlainText
              text: catRow.hasSaved ? "●" : (catRow.modelData.action ? "" : "›")
              opacity: catRow.hasSaved ? 1 : 0.45
              color: root.fg
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body * 0.85
            }
            MouseArea {
              id: catMouse
              anchors.fill: parent
              hoverEnabled: true
              cursorShape: Qt.PointingHandCursor
              onPositionChanged: function(m) {
                if (!sec.realMove(catMouse, m)) return
                sec.focusRequested()
                if (sec.catIdx !== catRow.index) { sec.catIdx = catRow.index; sec.itemIdx = Math.max(0, sec.indexOfSaved(catRow.index)) }
                sec.col = 0
              }
              onClicked: {
                sec.focusRequested()
                sec.catIdx = catRow.index
                if (catRow.modelData.action) sec.acted(catRow.modelData.id)
                else { sec.itemIdx = Math.max(0, sec.indexOfSaved(catRow.index)); sec.col = 1 }
              }
            }
          }
        }
      }

      ListView {
        id: list
        width: panes.width - catCol.width - panes.spacing
        height: sec.visibleRows * (sec.rowH + sec.rowGap)
        spacing: sec.rowGap
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        model: sec.curItems

        delegate: Rectangle {
          id: itemRow
          required property var modelData
          required property int index
          readonly property bool isSaved: modelData.id === sec.saved
          readonly property bool selected: index === sec.itemIdx
          width: list.width
          height: sec.rowH
          radius: Style.space(6)
          color: selected ? root.fgA(sec.col === 1 && sec.focused ? 0.2 : 0.07) : "transparent"

          Text {
            id: itemLabel
            anchors.left: parent.left
            anchors.leftMargin: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            textFormat: Text.PlainText
            text: (sec.favs.indexOf(itemRow.modelData.id) >= 0 ? "★ " : "") + itemRow.modelData.label
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
          }
          Text {
            anchors.left: itemLabel.right
            anchors.leftMargin: Style.space(8)
            anchors.right: parent.right
            anchors.rightMargin: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            horizontalAlignment: Text.AlignRight
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: itemRow.isSaved ? root.checkGlyph : (itemRow.modelData.hint || "")
            opacity: itemRow.isSaved ? 1 : 0.5
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: itemRow.isSaved ? Style.font.body : Style.font.body * 0.8
          }
          MouseArea {
            id: itemMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onPositionChanged: function(m) {
              if (!sec.realMove(itemMouse, m)) return
              sec.focusRequested()
              sec.col = 1
              sec.itemIdx = itemRow.index
              if (m.modifiers & Qt.ShiftModifier) sec.pointed(itemRow.modelData)
            }
            onClicked: {
              sec.focusRequested()
              sec.col = 1
              sec.itemIdx = itemRow.index
              sec.chosen(itemRow.modelData, true)
            }
          }
        }
      }
    }

    Text {
      visible: sec.curItems.length === 0 && sec.curCat !== null && !sec.curCat.action
      x: catCol.width + panes.spacing + Style.space(10)
      y: titleText.height + Style.space(8)
      width: list.width - Style.space(20)
      wrapMode: Text.WordWrap
      textFormat: Text.PlainText
      text: sec.curCat && sec.curCat.note ? sec.curCat.note : ""
      opacity: 0.55
      color: root.fg
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body * 0.9
    }
  }

  // ---------------------------------------------------------------- the menu
  KeyboardPanel {
    id: popup
    anchorItem: root
    bar: root.bar
    owner: root
    open: root.popupOpen
    focusTarget: keys
    contentWidth: popup.fittedContentWidth(Style.space(Math.round(540 * Math.max(1, root.widthUnits) + 20 * (root.nVis - 1))))
    contentHeight: popup.fittedContentHeight(body.implicitHeight)

    PanelKeyCatcher {
      id: keys
      anchors.fill: parent
      onMoveRequested: function(dx, dy) { root.moveKeys(dx, dy) }
      onTabRequested: function(dir) {
        var i = root.visibleKinds.indexOf(root.focusKind) + dir
        root.activeKind = root.visibleKinds[(i + root.nVis) % root.nVis]
      }
      onReturnRequested: root.viaEnter = true
      onActivateRequested: { root.activeSec.activate(!root.viaEnter); root.viaEnter = false }
      onCloseRequested: root.close()
      onTextKey: function(t) { root.handleText(t) }

      Column {
        id: body
        width: parent.width
        spacing: Style.space(4)

        Row {
          id: header
          width: body.width
          height: Style.space(28)
          spacing: Style.space(6)
          readonly property real cell: (width - spacing * 6) / 7

          MenuRow {
            width: header.cell
            label: (root.showScreen ? root.boxOn : root.boxOff) + "  Screen  (s)"
            onClicked: root.toggleSection("screen")
          }
          MenuRow {
            width: header.cell
            label: (root.showColor ? root.boxOn : root.boxOff) + "  Color  (C)"
            onClicked: root.toggleSection("color")
          }
          MenuRow {
            width: header.cell
            label: (root.showWall ? root.boxOn : root.boxOff) + "  Wallpaper  (w)"
            onClicked: root.toggleSection("wall")
          }
          MenuRow {
            width: header.cell
            label: (root.showMouse ? root.boxOn : root.boxOff) + "  Cursor  (c)"
            onClicked: root.toggleSection("mouse")
          }
          MenuRow {
            width: header.cell
            label: (root.showCombo ? root.boxOn : root.boxOff) + "  Combos  (m)"
            onClicked: root.toggleSection("combo")
          }
          MenuRow {
            width: header.cell
            dim: !root.showScreen
            label: (root.includeAnimated ? root.boxOn : root.boxOff) + "  Animated  (a)"
            onClicked: root.setAnimated()
          }
          MenuRow {
            width: header.cell
            label: (root.nEffectVis > 1 ? "Surprise all" : "Surprise me") + "  (R)"
            onClicked: root.randomAll()
          }
        }

        Rectangle { width: body.width; height: 1; color: root.fgA(0.2) }

        Row {
          id: secRow
          width: body.width
          spacing: Style.space(8)
          readonly property real secWidth: Math.floor((width - (2 * root.nVis - 2) * spacing - (root.nVis - 1)) / root.widthUnits)

          SectionMenu {
            id: screenSec
            visible: root.showScreen
            width: secRow.secWidth
            title: "Screen"
            cats: root.screenCats
            saved: root.current
            favs: root.screenFavs
            focused: root.focusKind === "screen"
            defaultCat: 1
            onPointed: function(item) { root.previewScreen(item) }
            onChosen: function(item, keep) { root.chooseScreen(item, keep) }
            onActed: function(id) { root.runAction("screen", id) }
            onFocusRequested: root.activeKind = "screen"
          }

          Rectangle {
            visible: root.showScreen && (root.showColor || root.showWall || root.showMouse || root.showCombo)
            width: 1
            height: screenSec.implicitHeight
            color: root.fgA(0.2)
          }

          SectionMenu {
            id: colorSec
            visible: root.showColor
            width: Math.floor(secRow.secWidth * root.colorWeight)
            title: "Color"
            cats: root.colorCats
            saved: root.colorCurrent
            favs: root.colorFavs
            focused: root.focusKind === "color"
            defaultCat: 1
            onPointed: function(item) { root.previewColor(item) }
            onChosen: function(item, keep) { root.chooseColor(item, keep) }
            onActed: function(id) { root.runAction("color", id) }
            onFocusRequested: root.activeKind = "color"
          }

          Rectangle {
            visible: root.showColor && (root.showWall || root.showMouse || root.showCombo)
            width: 1
            height: screenSec.implicitHeight
            color: root.fgA(0.2)
          }

          SectionMenu {
            id: wallSec
            visible: root.showWall
            width: secRow.secWidth
            title: "Wallpaper"
            cats: root.wallCats
            saved: root.wallShown
            favs: root.wallFavs
            focused: root.focusKind === "wall"
            defaultCat: 2
            onPointed: function(item) { root.previewWall(item) }
            onChosen: function(item, keep) { root.chooseWall(item, keep) }
            onActed: function(id) { root.runAction("wall", id) }
            onFocusRequested: root.activeKind = "wall"
          }

          Rectangle {
            visible: root.showWall && (root.showMouse || root.showCombo)
            width: 1
            height: screenSec.implicitHeight
            color: root.fgA(0.2)
          }

          SectionMenu {
            id: mouseSec
            visible: root.showMouse
            width: secRow.secWidth
            title: "Cursor"
            cats: root.mouseCats
            saved: root.mouseCurrent
            favs: root.mouseFavs
            focused: root.focusKind === "mouse"
            defaultCat: 1
            onPointed: function(item) { root.previewMouse(item) }
            onChosen: function(item, keep) { root.chooseMouse(item, keep) }
            onActed: function(id) { root.runAction("mouse", id) }
            onFocusRequested: root.activeKind = "mouse"
          }

          Rectangle {
            visible: root.showMouse && root.showCombo
            width: 1
            height: screenSec.implicitHeight
            color: root.fgA(0.2)
          }

          SectionMenu {
            id: comboSec
            visible: root.showCombo
            width: Math.floor(secRow.secWidth * root.comboWeight)
            title: "Combos"
            cats: root.comboCats
            saved: root.comboNow
            favs: []
            focused: root.focusKind === "combo"
            defaultCat: 0
            onPointed: function(item) { root.previewCombo(item) }
            onChosen: function(item, keep) { root.applyCombo(item, keep) }
            onActed: function(id) { root.runAction("combo", id) }
            onFocusRequested: root.activeKind = "combo"
          }
        }

        Rectangle { width: body.width; height: 1; color: root.fgA(0.2) }

        Text {
          width: body.width
          height: Style.space(24)
          verticalAlignment: Text.AlignVCenter
          leftPadding: Style.space(10)
          elide: Text.ElideRight
          textFormat: Text.PlainText
          text: {
            if (root.comboFlash !== "") return root.comboFlash
            var it = root.activeSec.selected
            if (it) return root.kindTitle(root.focusKind) + " · " + it.label + (it.desc ? ": " + it.desc : (it.hint && it.id.charAt(0) !== "@" ? ": " + it.hint : ""))
            return "Screen: " + (root.shaderOn ? root.current : "off") + " · Color: " + (root.colorOn ? root.colorCurrent : "off") + " · Wallpaper: " + (root.wallOn ? root.wallLabel(root.wallShown) : "off") + " · Cursor: " + (root.mouseOn ? root.mouseCurrent : "off")
          }
          color: root.fg
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.body
        }
        Text {
          width: body.width
          height: Style.space(20)
          verticalAlignment: Text.AlignVCenter
          leftPadding: Style.space(10)
          elide: Text.ElideRight
          textFormat: Text.PlainText
          text: "hjkl move · ⏎ apply · space try · tab menu · f fav · F save combo · r/R surprise · o/O off · s C w c m menus · esc undo"
          opacity: 0.6
          color: root.fg
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.body * 0.85
        }
        Text {
          width: body.width
          height: Style.space(20)
          verticalAlignment: Text.AlignVCenter
          leftPadding: Style.space(10)
          elide: Text.ElideRight
          textFormat: Text.PlainText
          text: root.gpuText
          opacity: 0.6
          color: root.fg
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.body * 0.85
        }
      }
    }
  }
}
