import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Hyprland
import qs.Commons
import qs.Ui

// One bar icon, five effect menus (tick any of them at the top, ticked menus sit side by side):
//   Screen    full-screen GLSL effects applied by Hyprland (bin/omashaders)
//   Color     a colour grade on top of the screen effect (merged into one shader by bin/compose-shader)
//   Wallpaper animated GPU effects drawn over the wallpaper (WallpaperFx.qml) plus wallpaper picking
//   Cursor    small overlay effects drawn around the mouse pointer (MouseFx.qml), and Bend shaders that
//             distort the real screen around it (bin/cursor-bend + BendMarker.qml)
//   Windows   the Screen and Color lists drawn on chosen app windows only (needs the HyprWindowShade Hyprland plugin; bin/omashaders window)
// hjkl / arrows move, hovering highlights an effect and previews it only while Shift is held (releasing Shift or leaving the item restores the saved setting) (keys preview as you move), a mouse click or Space keeps it and stays open, Enter keeps it and closes,
// Esc undoes previews.
BarWidget {
  id: root
  moduleName: "io.github.akton1.omashaders"

  function path(rel) { return decodeURIComponent(Qt.resolvedUrl(rel).toString().replace(/^file:\/\//, "")) }
  readonly property string script: path("bin/omashaders")
  readonly property string stepScript: path("bin/wallpaper-step")
  readonly property string cursorScript: path("bin/cursor-watch")
  readonly property string bendScript: path("bin/cursor-bend")
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
  readonly property string wall2File: stateDir + "/wp-effect2"
  readonly property string wallMixFile: stateDir + "/wp-mix"
  readonly property string wallPreviewFile: stateDir + "/wp-preview"
  readonly property string wallFavFile: stateDir + "/wp-favorites"
  readonly property string mouseFavFile: stateDir + "/mouse-favorites"
  readonly property string comboFile: stateDir + "/combos"
  readonly property string sectionsFile: stateDir + "/sections"
  readonly property string shiftOnlyFile: stateDir + "/shift-only"
  readonly property string disabledFile: stateDir + "/disabled"
  readonly property string fxStrengthFile: stateDir + "/strength-effect"
  readonly property string colStrengthFile: stateDir + "/strength-color"
  readonly property string wallStrengthFile: stateDir + "/strength-wall"
  readonly property string mouseStrengthFile: stateDir + "/strength-mouse"
  readonly property string wallReactFile: stateDir + "/react-wall"
  readonly property string wallRangeFile: stateDir + "/wall-range"
  readonly property string wallTargetFile: stateDir + "/wall-target"
  readonly property string effect2File: stateDir + "/effect2"
  readonly property string color2File: stateDir + "/color2"
  readonly property string mixEffectFile: stateDir + "/mix-effect"
  readonly property string mixColorFile: stateDir + "/mix-color"
  readonly property string winEffectFile: stateDir + "/window-effect"
  readonly property string winColorFile: stateDir + "/window-color"
  readonly property string winFrameFile: stateDir + "/window-frame"
  readonly property string winTargetFile: stateDir + "/window-target"
  readonly property string winAppsFile: stateDir + "/window-apps"
  readonly property string winMixFile: stateDir + "/window-mix"
  readonly property string winFxStrengthFile: stateDir + "/window-strength-effect"
  readonly property string winColStrengthFile: stateDir + "/window-strength-color"
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
  property bool showWin: false
  property string activeKind: "screen"
  function isShown(k) { return k === "screen" ? showScreen : (k === "color" ? showColor : (k === "wall" ? showWall : (k === "mouse" ? showMouse : (k === "win" ? showWin : showCombo)))) }
  function secOf(k) { return k === "screen" ? screenSec : (k === "color" ? colorSec : (k === "wall" ? wallSec : (k === "mouse" ? mouseSec : (k === "win" ? winSec : comboSec)))) }
  function kindIcon(k) { return k === "screen" ? "󰍹" : (k === "color" ? "󰏘" : (k === "wall" ? "󰋩" : (k === "mouse" ? "󰍽" : (k === "win" ? "󰖲" : "󰽗")))) }
  function kindTitle(k) { return k === "screen" ? "Screen" : (k === "color" ? "Color" : (k === "wall" ? "Wallpaper" : (k === "mouse" ? "Cursor" : (k === "win" ? "Windows" : "Combos")))) }
  readonly property var visibleKinds: ["screen", "color", "wall", "mouse", "win", "combo"].filter(function(k) { return isShown(k) })
  readonly property int nVis: visibleKinds.length
  // effect menus that "off" and "surprise" act on; with only Combos shown they act on all three
  readonly property var effectKinds: {
    var k = visibleKinds.filter(function(x) { return x !== "combo" })
    return k.length > 0 ? k : ["screen", "color", "wall", "mouse"]
  }
  readonly property int nEffectVis: visibleKinds.filter(function(x) { return x !== "combo" }).length
  readonly property real comboWeight: 1
  readonly property real colorWeight: 0.85
  readonly property real widthUnits: (showScreen ? 1 : 0) + (showColor ? colorWeight : 0) + (showWall ? 1 : 0) + (showMouse ? 1 : 0) + (showWin ? 1 : 0) + (showCombo ? comboWeight : 0)
  readonly property string focusKind: visibleKinds.indexOf(activeKind) >= 0 ? activeKind : (visibleKinds[0] || "screen")
  readonly property var activeSec: secOf(focusKind)

  function setShown(s, w, m, persist, c, k, x) {
    if (c === undefined) c = showCombo
    if (k === undefined) k = showColor
    if (x === undefined) x = showWin
    if (!s && !w && !m && !c && !k && !x) return
    var before = { screen: showScreen, color: showColor, wall: showWall, mouse: showMouse, combo: showCombo, win: showWin }
    showScreen = s
    showColor = k
    showWall = w
    showMouse = m
    showCombo = c
    showWin = x
    ;["screen", "color", "wall", "mouse", "win", "combo"].forEach(function(kind) {
      if (isShown(kind) && !before[kind]) { secOf(kind).sync(); activeKind = kind }
    })
    if (persist) writeFile(sectionsFile, visibleKinds.join(" "))
  }
  function toggleSection(kind) {
    setShown(kind === "screen" ? !showScreen : showScreen,
             kind === "wall" ? !showWall : showWall,
             kind === "mouse" ? !showMouse : showMouse, true,
             kind === "combo" ? !showCombo : showCombo,
             kind === "color" ? !showColor : showColor,
             kind === "win" ? !showWin : showWin)
  }
  function setSections(mode) {
    var w = String(mode).toLowerCase().split(/[\s,+]+/)
    var all = w.indexOf("all") >= 0
    var both = all || w.indexOf("both") >= 0
    setShown(both || w.indexOf("screen") >= 0, both || w.indexOf("wall") >= 0 || w.indexOf("wallpaper") >= 0,
             all || w.indexOf("mouse") >= 0 || w.indexOf("cursor") >= 0, true,
             all || w.indexOf("combo") >= 0 || w.indexOf("combos") >= 0,
             both || w.indexOf("color") >= 0 || w.indexOf("colour") >= 0,
             all || w.indexOf("win") >= 0)
  }
  FileView {
    path: root.sectionsFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      var t = String(text() || "")
      var s = t.indexOf("screen") >= 0, w = t.indexOf("wall") >= 0, m = t.indexOf("mouse") >= 0, c = t.indexOf("combo") >= 0, k = t.indexOf("color") >= 0, x = t.indexOf("win") >= 0
      if (!s && !w && !m && !c && !k && !x) { s = true; k = true; w = true }
      root.setShown(s, w, m, false, c, k, x)
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

  // ---------------------------------------------------------------- strength and pause
  // Screen and Color each have a strength (0-100); bin/omashaders remembers it per effect and starts every effect
  // at the value its shader file asks for (// strength: N). "paused" switches every effect off without forgetting them.
  property int fxStrength: 100
  property int colStrength: 100
  property string disabledFlag: ""
  readonly property bool paused: disabledFlag !== ""
  function defaultStrengthOf(section, name) {
    if (section === "color" && customRe.test(name)) return 80
    for (var i = 0; i < allEntries.length; i++) if (allEntries[i].section === section && allEntries[i].name === name) return allEntries[i].dflt
    return 100
  }
  component Rail: Item {
    id: rl
    property string name: ""
    property real value: 0
    property var stops: []
    property color fg: "white"
    property string fontFamily: ""
    property real cellW: 100
    property real cellH: 28
    signal moved(real v)
    function stopAt(i) {
      if (stops.length >= 7) return stops[i]
      var a = Qt.color(stops[0]), b = Qt.color(stops[1]), t = i / 6
      return Qt.rgba(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t, 1)
    }
    width: cellW
    height: cellH
    Text {
      id: rlName
      anchors.verticalCenter: parent.verticalCenter
      textFormat: Text.PlainText
      text: rl.name
      opacity: 0.7
      color: rl.fg
      font.family: rl.fontFamily
      font.pixelSize: Style.font.body * 0.85
    }
    Rectangle {
      id: rlBar
      anchors.left: rlName.right
      anchors.leftMargin: Style.space(6)
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      height: Style.space(8)
      radius: height / 2
      border.width: 1
      border.color: Qt.rgba(rl.fg.r, rl.fg.g, rl.fg.b, 0.3)
      gradient: Gradient {
        orientation: Gradient.Horizontal
        GradientStop { position: 0 / 6; color: rl.stopAt(0) }
        GradientStop { position: 1 / 6; color: rl.stopAt(1) }
        GradientStop { position: 2 / 6; color: rl.stopAt(2) }
        GradientStop { position: 3 / 6; color: rl.stopAt(3) }
        GradientStop { position: 4 / 6; color: rl.stopAt(4) }
        GradientStop { position: 5 / 6; color: rl.stopAt(5) }
        GradientStop { position: 6 / 6; color: rl.stopAt(6) }
      }
      Rectangle {
        x: parent.width * rl.value - width / 2
        anchors.verticalCenter: parent.verticalCenter
        width: Style.space(12)
        height: width
        radius: width / 2
        color: rl.fg
        border.width: 1
        border.color: Qt.rgba(0, 0, 0, 0.6)
      }
    }
    MouseArea {
      anchors.fill: rlBar
      anchors.topMargin: -Style.space(8)
      anchors.bottomMargin: -Style.space(8)
      cursorShape: Qt.PointingHandCursor
      function at(mx) { return Math.max(0, Math.min(1, mx / rlBar.width)) }
      onPressed: function(m) { rl.moved(at(m.x)) }
      onPositionChanged: function(m) { if (pressed) rl.moved(at(m.x)) }
      onWheel: function(w) { rl.moved(Math.max(0, Math.min(1, rl.value + (w.angleDelta.y > 0 ? 0.03 : -0.03)))) }
    }
  }
  component StrengthSender: Process {
    property string kind: "effect"
    property var prefix: []
    property int pending: -1
    readonly property bool busy: running || pending >= 0
    function send(v) { pending = v; if (!running) kick() }
    function kick() {
      if (pending < 0) return
      var v = pending
      pending = -1
      command = [root.script].concat(prefix, ["strength", kind, String(v)])
      running = true
    }
    onRunningChanged: if (!running && pending >= 0) kick()
  }
  StrengthSender { id: fxSender; kind: "effect" }
  StrengthSender { id: colSender; kind: "color" }
  StrengthSender { id: winFxSender; kind: "effect"; prefix: root.winScope === "*" ? ["window"] : ["window", "-a", root.winScope] }
  StrengthSender { id: winColSender; kind: "color"; prefix: root.winScope === "*" ? ["window"] : ["window", "-a", root.winScope] }
  property int winFxStrength: 100
  property int winColStrength: 100
  // Wallpaper and Cursor effects have one strength each (the effect's opacity, or for bend effects how far the screen is bent):
  // a plain number in strength-wall / strength-mouse that the effect windows and bin/cursor-bend read.
  property int wallStrength: 100
  property int mouseStrength: 100
  property int pendingWallStrength: -1
  property int pendingMouseStrength: -1
  Timer { id: wallStrengthTimer; interval: 80; onTriggered: { root.writeFile(root.wallStrengthFile, String(root.wallStrength)); root.pendingWallStrength = -1 } }
  Timer { id: mouseStrengthTimer; interval: 80; onTriggered: { root.writeFile(root.mouseStrengthFile, String(root.mouseStrength)); root.pendingMouseStrength = -1 } }
  // Wallpaper effect options: how much the effect follows the pointer (0-200, 100 = as designed) and, for the Colour reactor, the colour it looks for and how far from it still counts.
  property int wallReact: 100
  property int wallRange: 50
  property string wallTarget: "e8a33d"
  property int pendingWallReact: -1
  property int pendingWallRange: -1
  Timer { id: wallReactTimer; interval: 80; onTriggered: { root.writeFile(root.wallReactFile, String(root.wallReact)); root.pendingWallReact = -1 } }
  Timer { id: wallRangeTimer; interval: 80; onTriggered: { root.writeFile(root.wallRangeFile, String(root.wallRange)); root.pendingWallRange = -1 } }
  function setWallReact(v) { v = clamp(Math.round(v), 0, 200); wallReact = v; pendingWallReact = v; wallReactTimer.restart() }
  function setWallRange(v) { v = clamp(Math.round(v), 0, 100); wallRange = v; pendingWallRange = v; wallRangeTimer.restart() }
  function setWallTarget(t) {
    t = String(t).replace(/^#/, "").toLowerCase()
    if (!/^[0-9a-f]{6}$/.test(t)) return false
    wallTarget = t
    writeFile(wallTargetFile, t)
    return true
  }
  Process {
    id: eyedropper
    command: ["hyprpicker", "-n", "-b", "-q", "-f", "hex", "-l"]
    stdout: StdioCollector {
      onStreamFinished: root.setWallTarget(String(text).trim())
    }
  }
  function pickWallTarget() { if (!eyedropper.running) eyedropper.running = true }
  readonly property bool wallReactorOn: wallOn && wallShown === "colorreact"
  function setStrength(kind, v) {
    v = clamp(Math.round(v), 0, 100)
    if (kind === "color") { colStrength = v; colSender.send(v) }
    else if (kind === "wall") { wallStrength = v; pendingWallStrength = v; wallStrengthTimer.restart() }
    else if (kind === "mouse") { mouseStrength = v; pendingMouseStrength = v; mouseStrengthTimer.restart() }
    else if (kind === "winfx") { if (winScope === "*") winFxStrength = v; else setWinAppValue("fx", v); winFxSender.send(v) }
    else if (kind === "wincol") { if (winScope === "*") winColStrength = v; else setWinAppValue("col", v); winColSender.send(v) }
    else { fxStrength = v; fxSender.send(v) }
  }
  function strengthKind(k) { return k === "color" ? "color" : (k === "wall" ? "wall" : (k === "mouse" ? "mouse" : (k === "win" ? (winPart === "color" ? "wincol" : "winfx") : "effect"))) }
  function strengthLiveOf(kind) { return kind === "color" ? colorOn : (kind === "wall" ? wallOn : (kind === "mouse" ? mouseOn : (kind === "winfx" ? winEffectOnS : (kind === "wincol" ? winColorOnS : shaderOn)))) }
  function strengthOf(kind) { return kind === "color" ? colStrength : (kind === "wall" ? wallStrength : (kind === "mouse" ? mouseStrength : (kind === "winfx" ? winFxStrengthS : (kind === "wincol" ? winColStrengthS : fxStrength)))) }
  function nudgeStrength(delta) {
    if (focusKind === "combo") return
    var kind = strengthKind(focusKind)
    if (!strengthLiveOf(kind)) return
    setStrength(kind, strengthOf(kind) + delta)
  }
  function resetStrength() {
    if (focusKind === "combo") return
    var kind = strengthKind(focusKind)
    if (!strengthLiveOf(kind)) return
    if (kind === "wall" || kind === "mouse") setStrength(kind, 100)
    else if (kind === "winfx" || kind === "wincol") winRunS(["strength", kind === "winfx" ? "effect" : "color", "reset"])
    else Quickshell.execDetached([root.script, "strength", kind, "reset"])
  }
  function setPower(mode) { Quickshell.execDetached([root.script, "power", mode]) }
  function togglePause() { setPower(paused ? "on" : "off") }
  FileView {
    path: root.fxStrengthFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: { var v = parseInt(String(text() || "").trim()); if (!fxSender.busy) root.fxStrength = isNaN(v) ? 100 : root.clamp(v, 0, 100) }
    onLoadFailed: root.fxStrength = 100
  }
  FileView {
    path: root.colStrengthFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: { var v = parseInt(String(text() || "").trim()); if (!colSender.busy) root.colStrength = isNaN(v) ? 100 : root.clamp(v, 0, 100) }
    onLoadFailed: root.colStrength = 100
  }
  FileView {
    path: root.wallStrengthFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: { var v = parseInt(String(text() || "").trim()); if (root.pendingWallStrength < 0) root.wallStrength = isNaN(v) ? 100 : root.clamp(v, 0, 100) }
    onLoadFailed: root.wallStrength = 100
  }
  FileView {
    path: root.mouseStrengthFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: { var v = parseInt(String(text() || "").trim()); if (root.pendingMouseStrength < 0) root.mouseStrength = isNaN(v) ? 100 : root.clamp(v, 0, 100) }
    onLoadFailed: root.mouseStrength = 100
  }
  FileView {
    path: root.wallReactFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: { var v = parseInt(String(text() || "").trim()); if (root.pendingWallReact < 0) root.wallReact = isNaN(v) ? 100 : root.clamp(v, 0, 200) }
    onLoadFailed: root.wallReact = 100
  }
  FileView {
    path: root.wallRangeFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: { var v = parseInt(String(text() || "").trim()); if (root.pendingWallRange < 0) root.wallRange = isNaN(v) ? 50 : root.clamp(v, 0, 100) }
    onLoadFailed: root.wallRange = 50
  }
  FileView {
    path: root.wallTargetFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: { var t = String(text() || "").trim().toLowerCase(); root.wallTarget = /^[0-9a-f]{6}$/.test(t) ? t : "e8a33d" }
    onLoadFailed: root.wallTarget = "e8a33d"
  }
  FileView {
    path: root.winFxStrengthFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: { var v = parseInt(String(text() || "").trim()); if (!winFxSender.busy) root.winFxStrength = isNaN(v) ? 100 : root.clamp(v, 0, 100) }
    onLoadFailed: root.winFxStrength = 100
  }
  FileView {
    path: root.winColStrengthFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: { var v = parseInt(String(text() || "").trim()); if (!winColSender.busy) root.winColStrength = isNaN(v) ? 100 : root.clamp(v, 0, 100) }
    onLoadFailed: root.winColStrength = 100
  }
  // ---------------------------------------------------------------- mixing two effects of the same menu (Ctrl+Enter / Ctrl+click)
  // Screen and Color can each hold a second item next to the first. bin/omashaders mix ... keeps it in effect2 / color2 and
  // mix-effect / mix-color ("stack|blend AMOUNT"). Stack: the second runs on the first's result, AMOUNT is its strength.
  // Blend: both run on the original picture, AMOUNT is the share of the second.
  property string effect2: ""
  property string color2: ""
  property string mixEffectMode: "stack"
  property string mixColorMode: "stack"
  property int mixEffectAmt: 100
  property int mixColorAmt: 100
  // The Windows column mixes per scope (All windows or one app) the same way; bin/omashaders window [-a CLASS] mix ...
  // keeps it per scope and lists every scope in window-mix, which winMix mirrors.
  property var winMix: ({})
  readonly property var winMixEntry: winMix[winApp ? winScope : "*"] || { fx2: "", col2: "", fxMode: "stack", fxAmt: 100, colMode: "stack", colAmt: 100 }
  function setWinMixValue(part, v) {
    var m = Object.assign({}, winMix), key = winApp ? winScope : "*"
    var e = Object.assign({ fx2: "", col2: "", fxMode: "stack", fxAmt: 100, colMode: "stack", colAmt: 100 }, m[key] || {})
    e[part === "color" ? "colAmt" : "fxAmt"] = v
    m[key] = e
    winMix = m
  }
  // Wallpaper effects mix inside the shell (no CLI): wp-effect2 and wp-mix ("stack|blend AMOUNT") next to wp-effect.
  property string wall2: ""
  property string wallMixMode: "stack"
  property int wallMixAmt: 100
  property int pendingWallMix: -1
  Timer { id: wallMixTimer; interval: 80; onTriggered: { root.writeWallMix(); root.pendingWallMix = -1 } }
  function writeWallMix() { writeFile(wallMixFile, wallMixMode + " " + wallMixAmt) }
  function wallMixSet(name) {
    if (name === "" || name === wallSaved) { wall2 = ""; writeFile(wall2File, ""); return }
    wall2 = name
    wallMixAmt = wallMixMode === "blend" ? 50 : 100
    writeFile(wall2File, name)
    writeWallMix()
  }
  function wallMixSetMode(m) {
    wallMixMode = m
    wallMixAmt = m === "blend" ? 50 : 100
    writeWallMix()
  }
  function wallMixSetAmount(v) { wallMixAmt = clamp(Math.round(v), 0, 100); pendingWallMix = wallMixAmt; wallMixTimer.restart() }
  function mixKindOf(k) { return k === "screen" ? "effect" : (k === "color" ? "color" : (k === "wall" ? "wall" : (k === "win" ? (winPart === "frame" ? "" : winPart) : ""))) }
  function mixSecondOf(k) {
    if (k === "win") {
      if (winPart === "effect") return winEffectOnS ? winMixEntry.fx2 : ""
      if (winPart === "color") return winColorOnS ? winMixEntry.col2 : ""
      return ""
    }
    if (k === "wall") return wallSaved !== "" ? wall2 : ""
    return k === "screen" ? (shaderOn ? effect2 : "") : (k === "color" ? (colorOn ? color2 : "") : "")
  }
  function mixModeOf(k) { return k === "wall" ? wallMixMode : (k === "win" ? (winPart === "color" ? winMixEntry.colMode : winMixEntry.fxMode) : (k === "screen" ? mixEffectMode : mixColorMode)) }
  function mixAmtOf(k) { return k === "wall" ? wallMixAmt : (k === "win" ? (winPart === "color" ? winMixEntry.colAmt : winMixEntry.fxAmt) : (k === "screen" ? mixEffectAmt : mixColorAmt)) }
  function mixDefaultOf(k) {
    if (mixModeOf(k) === "blend") return 50
    if (k === "wall") return 100
    return defaultStrengthOf(k === "win" ? (winPart === "color" ? "color" : "screen") : k, mixSecondOf(k))
  }
  function mixCmd(k, tail) {
    if (k === "win") return [script, "window"].concat(winScope === "*" ? [] : ["-a", winScope], ["mix", mixKindOf(k)], tail)
    return [script, "mix", mixKindOf(k)].concat(tail)
  }
  function parseMix(t, kind) {
    var p = String(t || "").trim().split(/\s+/)
    var mode = p[0] === "blend" ? "blend" : "stack"
    var v = parseInt(p[1])
    v = isNaN(v) ? 100 : clamp(v, 0, 100)
    if (kind === "effect") { mixEffectMode = mode; if (!mixFxSender.busy) mixEffectAmt = v }
    else { mixColorMode = mode; if (!mixColSender.busy) mixColorAmt = v }
  }
  component MixSender: Process {
    property string kind: "effect"
    property bool win: false
    property int pending: -1
    readonly property bool busy: running || pending >= 0
    function send(v) { pending = v; if (!running) kick() }
    function kick() {
      if (pending < 0) return
      var v = pending
      pending = -1
      command = win ? [root.script, "window"].concat(root.winScope === "*" ? [] : ["-a", root.winScope], ["mix", kind, "amount", String(v)])
                    : [root.script, "mix", kind, "amount", String(v)]
      running = true
    }
    onRunningChanged: if (!running && pending >= 0) kick()
  }
  MixSender { id: mixFxSender; kind: "effect" }
  MixSender { id: mixColSender; kind: "color" }
  MixSender { id: winMixFxSender; kind: "effect"; win: true }
  MixSender { id: winMixColSender; kind: "color"; win: true }
  function setMixAmount(k, v) {
    v = clamp(Math.round(v), 0, 100)
    if (mixSecondOf(k) === "") return
    if (k === "wall") wallMixSetAmount(v)
    else if (k === "win") { setWinMixValue(winPart, v); (winPart === "color" ? winMixColSender : winMixFxSender).send(v) }
    else if (k === "screen") { mixEffectAmt = v; mixFxSender.send(v) }
    else { mixColorAmt = v; mixColSender.send(v) }
  }
  function nudgeMix(delta) {
    if (mixSecondOf(focusKind) === "") return
    setMixAmount(focusKind, mixAmtOf(focusKind) + delta)
  }
  function resetMix() {
    if (mixSecondOf(focusKind) === "") return
    if (focusKind === "wall") { wallMixSetAmount(mixDefaultOf("wall")); return }
    Quickshell.execDetached(mixCmd(focusKind, ["amount", "reset"]))
  }
  function toggleMixMode() {
    if (mixSecondOf(focusKind) === "") return
    if (focusKind === "wall") { wallMixSetMode(wallMixMode === "stack" ? "blend" : "stack"); return }
    Quickshell.execDetached(mixCmd(focusKind, ["mode", "toggle"]))
  }
  function clearMix() {
    if (mixSecondOf(focusKind) === "") return
    if (focusKind === "wall") { wallMixSet(""); return }
    Quickshell.execDetached(mixCmd(focusKind, ["off"]))
  }
  function pickSecond(k, it, keep) {
    var mk = mixKindOf(k)
    if (mk === "" || !it || it.id.charAt(0) === "@") return
    screenTimer.stop(); colorTimer.stop(); winTimer.stop()
    if (k === "wall") {
      wallHoverTimer.stop()
      if (wallSaved === "") { flash("Pick a first wallpaper effect before mixing a second one"); return }
      if (it.id === wallSaved) { flash("The second one has to differ from the first"); return }
      wallMixSet(it.id === wall2 ? "" : it.id)
      if (!keep) popupOpen = false
      return
    }
    var id = k === "win" ? it.id.slice(2) : it.id
    if (k === "win" && it.id.charAt(0) !== (mk === "effect" ? "e" : "c")) return
    var primary = k === "win" ? (mk === "effect" ? winEffectS : winColorS) : (k === "screen" ? current : colorCurrent)
    if (primary === "") { flash("Pick a first " + (k === "screen" ? "effect" : "colour grade") + " before mixing a second one"); return }
    if (id === primary) { flash("The second one has to differ from the first"); return }
    if (id === mixSecondOf(k)) Quickshell.execDetached(mixCmd(k, ["off"]))
    else Quickshell.execDetached(mixCmd(k, ["set", id]))
    if (!keep) popupOpen = false
  }
  FileView {
    path: root.wall2File
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.wall2 = String(text() || "").trim()
    onLoadFailed: root.wall2 = ""
  }
  FileView {
    path: root.wallMixFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      var p = String(text() || "").trim().split(/\s+/), v = parseInt(p[1])
      root.wallMixMode = p[0] === "blend" ? "blend" : "stack"
      if (root.pendingWallMix < 0) root.wallMixAmt = isNaN(v) ? 100 : root.clamp(v, 0, 100)
    }
  }
  readonly property var screenMarks: mixSecondOf("screen") !== "" ? [effect2] : []
  readonly property var colorMarks: mixSecondOf("color") !== "" ? [color2] : []
  FileView {
    path: root.effect2File
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.effect2 = String(text() || "").trim()
    onLoadFailed: root.effect2 = ""
  }
  FileView {
    path: root.color2File
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.color2 = String(text() || "").trim()
    onLoadFailed: root.color2 = ""
  }
  FileView {
    path: root.mixEffectFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.parseMix(text(), "effect")
  }
  FileView {
    path: root.mixColorFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.parseMix(text(), "color")
  }
  FileView {
    path: root.disabledFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.disabledFlag = String(text() || "").trim()
    onLoadFailed: root.disabledFlag = ""
  }

  // ---------------------------------------------------------------- screen shaders (Hyprland)
  property var allEntries: []          // { name, animated, motion, cat, desc, section, dflt = start strength in percent }
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
    catList(screenEntries, ["Lens", "Retro", "Devices", "Art", "Mood", "Ambient", "Motion"]).forEach(function(c) {
      out.push({ id: c, label: c,
                 items: screenEntries.filter(function(e) { return e.cat === c && (includeAnimated || !e.animated) }).map(screenItem),
                 note: (!includeAnimated && screenEntries.some(function(e) { return e.cat === c && e.animated })) ? "Heavy GPU use. Press a to turn animated screen effects on." : "" })
    })
    out.push({ id: "@random", label: "Surprise me", action: true })
    out.push({ id: "@off", label: "Off", action: true })
    return out
  }

  function applyScreen(name) {
    Quickshell.execDetached(name === "" ? [root.script, "effect", "off"] : [root.script, "effect", "set", name])
  }
  function previewScreen(it) {
    if (!it || it.id.charAt(0) === "@" || it.id === current || mixSecondOf("screen") !== "") { screenTimer.stop(); return }
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
          if (p[0]) out.push({ name: p[0], animated: p[1] === "animated", motion: p[1] === "motion", bend: p[5] === "bend", cat: p[2] || "Other", desc: p[3] || "", section: p[4] || "screen", dflt: (p[5] !== undefined && p[5] !== "" && !isNaN(Number(p[5]))) ? Number(p[5]) : 100 })
        })
        var first = root.allEntries.length !== out.length
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
      else if ((event.name === "openwindow" || event.name === "openlayer") && root.winAll && (root.winEffectOn || root.winColorOn)) winSyncTimer.restart()
      if (event.name === "configreloaded" && root.winFrameOn) frameReloadTimer.restart()
    }
  }
  Timer { id: frameReloadTimer; interval: 500; onTriggered: Quickshell.execDetached([root.script, "window", "frame", "reload"]) }
  Timer { id: winSyncTimer; interval: 400; onTriggered: Quickshell.execDetached([root.script, "window", "sync"]) }
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
  // a custom colour is the generated grade "custom-RRGGBB" (bin/compose-shader --custom), so it works with strength, favorites and combos like any other
  readonly property var customRe: /^custom-[0-9a-f]{6}$/
  function colorFavItems() {
    var out = []
    colorFavs.forEach(function(id) {
      if (customRe.test(id)) { out.push({ id: id, label: "Custom #" + id.slice(7), desc: "Your own colour", hint: "" }); return }
      for (var i = 0; i < colorItems.length; i++) if (colorItems[i].id === id) { out.push(colorItems[i]); break }
    })
    return out
  }
  property string customHex: "ff8a00"
  property real customH: 0.09
  property real customS: 1.0
  property real customV: 1.0
  readonly property bool customActive: colorCurrent === "custom-" + customHex
  readonly property bool customIsFav: colorFavs.indexOf("custom-" + customHex) >= 0
  function hex2(x) { var h = Math.round(x * 255).toString(16); return h.length < 2 ? "0" + h : h }
  function setCustomHsv(h, sat, v) {
    customH = clamp(h, 0, 1); customS = clamp(sat, 0, 1); customV = clamp(v, 0, 1)
    var c = Qt.hsva(customH, customS, customV, 1)
    customHex = hex2(c.r) + hex2(c.g) + hex2(c.b)
    customTimer.restart()
  }
  function setCustomHex(t) {
    t = String(t).replace(/^#/, "").toLowerCase()
    if (!/^[0-9a-f]{6}$/.test(t)) return false
    syncCustom(t)
    applyCustom()
    return true
  }
  function syncCustom(t) {
    var c = Qt.color("#" + t)
    customHex = t
    if (c.hsvHue >= 0) customH = c.hsvHue
    customS = c.hsvSaturation
    customV = c.hsvValue
  }
  function applyCustom() {
    customTimer.stop()
    colorOrigin = "custom-" + customHex
    colorPreviewed = false
    applyColor(colorOrigin)
  }
  Timer { id: customTimer; interval: 140; onTriggered: root.applyCustom() }
  onColorCurrentChanged: {
    if (customRe.test(colorCurrent) && colorCurrent.slice(7) !== customHex && !customTimer.running) syncCustom(colorCurrent.slice(7))
  }
  function toggleCustomFav() {
    var id = "custom-" + customHex
    var next = colorFavs.filter(function(f) { return f !== id })
    if (next.length === colorFavs.length) next.push(id)
    colorFavs = next
    writeFile(colorFavFile, next.join("\n"))
  }
  readonly property var colorCats: {
    var out = [{ id: "fav", label: "Favorites", items: colorFavItems(), note: favNote }]
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
    if (!it || it.id.charAt(0) === "@" || it.id === colorCurrent || mixSecondOf("color") !== "") { colorTimer.stop(); return }
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

  // ---------------------------------------------------------------- window shaders (HyprWindowShade plugin)
  // The Screen effect and Color lists, drawn on windows only. Targets are app classes (or all windows);
  // bin/omashaders window does the work and only tells the plugin which class gets which shader.
  // Item ids in this menu: "t:CLASS" / "t:layer:NAMESPACE" / "t:*" target, "e:NAME" effect, "c:NAME" colour.
  property string winEffect: ""
  property string winColor: ""
  property var winTargets: []
  property var winClasses: []
  // Which settings the Windows column edits: "*" = all windows, otherwise one app class that keeps its own settings.
  // winApps maps each app with its own settings to { effect, color, fx, col } (from the window-apps state file).
  property string winScope: "*"
  property var winApps: ({})
  property bool winOriginInherit: false
  readonly property var winApp: winScope === "*" ? null : (winApps[winScope] || null)
  readonly property string winEffectS: winApp ? winApp.effect : winEffect
  readonly property string winColorS: winApp ? winApp.color : winColor
  readonly property int winFxStrengthS: winApp ? winApp.fx : winFxStrength
  readonly property int winColStrengthS: winApp ? winApp.col : winColStrength
  readonly property bool winEffectOnS: winEffectS !== ""
  readonly property bool winColorOnS: winColorS !== ""
  readonly property string winScopeLabel: winScope.indexOf("layer:") === 0 ? winScope.slice(6) : winScope
  readonly property int winAppCount: Object.keys(winApps).length
  function setWinAppValue(which, v) {
    var m = Object.assign({}, winApps)
    var a = Object.assign({}, m[winScope] || { effect: winEffect, color: winColor, fx: winFxStrength, col: winColStrength })
    a[which] = v
    m[winScope] = a
    winApps = m
  }
  function winAppSummary(c) {
    var a = winApps[c]
    if (!a) return ""
    var p = [a.effect, a.color].filter(function(x) { return x !== "" })
    return p.length > 0 ? p.join(" + ") : "off"
  }
  property string winPlugin: "unknown"
  property string winOriginFx: ""
  property string winOriginCol: ""
  property string winFrame: ""
  property string winOriginFrame: ""
  property bool winPreviewed: false
  property string winPending: ""
  readonly property bool winEffectOn: winEffect !== ""
  readonly property bool winColorOn: winColor !== ""
  readonly property bool winFrameOn: winFrame !== ""
  readonly property bool winAnyOn: winEffectOn || winColorOn || winFrameOn || winAppCount > 0
  readonly property var frameEntries: allEntries.filter(function(e) { return e.section === "frame" })
  function winFrameItem(e) { return { id: "f:" + e.name, label: e.name, desc: e.desc, hint: e.motion ? "spins" : "" } }
  readonly property var winFrameCats: catList(frameEntries, ["Shadow", "Glow", "Border", "Spin"]).map(function(c) {
    return { id: "f:" + c, label: "Frame · " + c, items: frameEntries.filter(function(e) { return e.cat === c }).map(winFrameItem), note: "" }
  })
  readonly property bool winAll: winTargets.indexOf("*") >= 0
  readonly property string winPart: (winSec.curCat && String(winSec.curCat.id).indexOf("f:") === 0) ? "frame" : ((winSec.curCat && String(winSec.curCat.id).indexOf("c:") === 0) ? "color" : "effect")
  readonly property string installCmd: "hyprpm update && hyprpm add https://github.com/ManofJELLO/HyprWindowShade && hyprpm enable HyprWindowShade"

  function winFxItem(e) { return { id: "e:" + e.name, label: e.name, desc: e.desc, hint: e.animated ? "heavy" : "" } }
  function winColItem(e) { return { id: "c:" + e.name, label: e.name, desc: e.desc, hint: "" } }
  function winShownFx(e) { return includeAnimated || !e.animated }
  readonly property var winEffectItems: screenEntries.filter(winShownFx).map(winFxItem)
  readonly property var winAppItems: {
    var gsum = [winEffect, winColor].filter(function(x) { return x !== "" }).join(" + ")
    var out = [{ id: "t:*", label: "All windows", desc: "The setting for every window. Apps that have their own setting keep it.", hint: gsum }]
    var seen = {}
    winClasses.concat(Object.keys(winApps), winTargets.filter(function(t) { return t !== "*" })).forEach(function(c) {
      if (!c || seen[c]) return
      seen[c] = true
      var own = winApps[c] !== undefined, sum = winAppSummary(c)
      var what = c.indexOf("layer:") === 0 ? "Shell panel or overlay (bar, Companion pill, plugin menus), not a normal window. " : "Every window of this app. "
      out.push({ id: "t:" + c, label: c.indexOf("layer:") === 0 ? c.slice(6) : c,
                 desc: what + (own ? "Own setting: " + sum + "." : "Follows All windows. Pick an effect or colour to give it its own."),
                 hint: own ? sum : (c.indexOf("layer:") === 0 ? "panel" : "") })
    })
    return out
  }
  readonly property var winCats: {
    if (winPlugin === "missing") return [
      { id: "setup", label: "Setup needed", items: [], note: "Window shaders need the HyprWindowShade plugin, which is not installed. In a terminal run:\n\nhyprpm update\nhyprpm add https://github.com/ManofJELLO/HyprWindowShade\nhyprpm enable HyprWindowShade\n\nThen reopen this menu. Pick the next row to copy the commands." },
      { id: "@copy", label: "Copy install commands", action: true }
    ].concat(winFrameCats).concat([{ id: "@off", label: "Off", action: true }])
    var out = []
    catList(screenEntries, ["Lens", "Retro", "Devices", "Art", "Mood", "Ambient", "Motion"]).forEach(function(c) {
      var items = screenEntries.filter(function(e) { return e.cat === c && winShownFx(e) }).map(winFxItem)
      if (items.length > 0) out.push({ id: "e:" + c, label: c, items: items, note: "" })
    })
    catList(colorEntries, ["Comfort", "Color", "Retro", "Devices"]).forEach(function(c) {
      out.push({ id: "c:" + c, label: "Color · " + c, items: colorEntries.filter(function(e) { return e.cat === c }).map(winColItem), note: "" })
    })
    if (winScope === "*") winFrameCats.forEach(function(c) { out.push(c) })
    else out.push({ id: "@inherit", label: "Follow All windows", action: true })
    out.push({ id: "@random", label: "Surprise me", action: true })
    out.push({ id: "@off", label: "Off", action: true })
    return out
  }
  readonly property var winMarks: {
    var out = []
    if (winEffectOnS) out.push("e:" + winEffectS)
    if (winColorOnS) out.push("c:" + winColorS)
    if (winEffectOnS && winMixEntry.fx2 !== "") out.push("e:" + winMixEntry.fx2)
    if (winColorOnS && winMixEntry.col2 !== "") out.push("c:" + winMixEntry.col2)
    if (winFrameOn && winScope === "*") out.push("f:" + winFrame)
    return out
  }

  function winRun(args) { Quickshell.execDetached([root.script, "window"].concat(args)) }
  function winRunS(args) { winRun(winScope === "*" ? args : ["-a", winScope].concat(args)) }
  function applyWinPart(kind, name) { winRunS(name === "" ? [kind, "off"] : [kind, "set", name]) }
  function applyWinFrame(name) { winRun(name === "" ? ["frame", "off"] : ["frame", "set", name]) }
  function applyWin(id) {
    if (id.charAt(0) === "f") applyWinFrame(id.slice(2))
    else applyWinPart(id.charAt(0) === "e" ? "effect" : "color", id.slice(2))
  }
  function previewWin(it) {
    if (!it || it.id.charAt(1) !== ":" || it.id.charAt(0) === "t") { winTimer.stop(); return }
    if (it.id === "e:" + winEffectS || it.id === "c:" + winColorS || it.id === "f:" + winFrame) { winTimer.stop(); return }
    if (mixSecondOf("win") !== "" && it.id.charAt(0) === (winPart === "color" ? "c" : "e")) { winTimer.stop(); return }
    if (!winPreviewed) winOriginInherit = winScope !== "*" && winApp === null
    winPending = it.id
    winPreviewed = true
    winTimer.restart()
  }
  Timer { id: winTimer; interval: 140; onTriggered: root.applyWin(root.winPending) }
  property bool winPickOpen: false
  function toggleWinPicker() {
    winPickOpen = !winPickOpen
    if (winPickOpen) {
      winSec.pickerIdx = Math.max(0, winAppItems.findIndex(function(it) { return it.id === "t:" + winScope }))
      activeKind = "win"
    }
  }
  function pickWinApp(it) {
    winPickOpen = false
    if (it) chooseWin(it, true)
  }
  function setWinScope(cls) {
    revertWinPreview()
    winScope = cls
    winOriginFx = winEffectS
    winOriginCol = winColorS
    winPreviewed = false
  }
  function chooseWin(it, keep) {
    if (!it || it.id.charAt(1) !== ":") return
    winTimer.stop()
    if (it.id.charAt(0) === "t") { setWinScope(it.id.slice(2)); return }
    else {
      applyWin(it.id)
      if (it.id.charAt(0) === "e") winOriginFx = it.id.slice(2)
      else if (it.id.charAt(0) === "f") winOriginFrame = it.id.slice(2)
      else winOriginCol = it.id.slice(2)
      winPreviewed = false
    }
    if (!keep) popupOpen = false
  }
  function revertWinPreview() {
    winTimer.stop()
    if (!winPreviewed) return
    winPreviewed = false
    if (winOriginInherit) { winRunS(["inherit"]); return }
    applyWinPart("effect", winOriginFx)
    applyWinPart("color", winOriginCol)
    if (winScope === "*") applyWinFrame(winOriginFrame)
  }
  function refreshWin() { winStatus.running = true; winLister.running = true }
  Process {
    id: winStatus
    command: [root.script, "window", "status"]
    stdout: StdioCollector {
      onStreamFinished: {
        var m = /plugin=(\w+)/.exec(String(text))
        root.winPlugin = m ? m[1] : "unknown"
      }
    }
  }
  Process {
    id: winLister
    command: [root.script, "window", "classes"]
    stdout: StdioCollector {
      onStreamFinished: root.winClasses = String(text).split("\n").filter(function(c) { return c !== "" })
    }
  }
  FileView {
    path: root.winEffectFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.winEffect = String(text() || "").trim()
    onLoadFailed: root.winEffect = ""
  }
  FileView {
    path: root.winColorFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.winColor = String(text() || "").trim()
    onLoadFailed: root.winColor = ""
  }
  FileView {
    path: root.winFrameFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.winFrame = String(text() || "").trim()
    onLoadFailed: root.winFrame = ""
  }
  FileView {
    path: root.winAppsFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      if (winFxSender.busy || winColSender.busy) return
      var m = {}
      String(text() || "").split("\n").forEach(function(l) {
        if (l === "") return
        var q = l.split("\t"), fx = parseInt(q[3]), col = parseInt(q[4])
        m[q[0]] = { effect: q[1] || "", color: q[2] || "", fx: isNaN(fx) ? 100 : fx, col: isNaN(col) ? 100 : col }
      })
      root.winApps = m
    }
    onLoadFailed: root.winApps = ({})
  }
  FileView {
    path: root.winMixFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      if (winMixFxSender.busy || winMixColSender.busy) return
      var m = {}
      String(text() || "").split("\n").forEach(function(l) {
        if (l === "") return
        var q = l.split("\t"), fa = parseInt(q[4]), ca = parseInt(q[6])
        m[q[0]] = { fx2: q[1] || "", col2: q[2] || "", fxMode: q[3] === "blend" ? "blend" : "stack", fxAmt: isNaN(fa) ? 100 : fa,
                    colMode: q[5] === "blend" ? "blend" : "stack", colAmt: isNaN(ca) ? 100 : ca }
      })
      root.winMix = m
    }
    onLoadFailed: root.winMix = ({})
  }
  FileView {
    path: root.winTargetFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.winTargets = String(text() || "").split("\n").filter(function(c) { return c !== "" })
    onLoadFailed: root.winTargets = []
  }

  // ---------------------------------------------------------------- cursor overlays (MouseFx)
  property string mouseCurrent: ""
  property var mouseFavs: []
  property string mouseOrigin: ""
  property bool mousePreviewed: false
  property string mousePending: ""
  readonly property bool mouseOn: mouseCurrent !== ""

  readonly property var mouseEntries: allEntries.filter(function(e) { return e.section === "mouse" })
  function mouseItem(e) { return { id: e.name, label: e.name, desc: e.desc, hint: e.bend ? "bends screen" : (e.motion ? "animated" : "") } }
  readonly property var mouseItems: mouseEntries.map(mouseItem)
  readonly property var mouseCats: {
    var out = [{ id: "fav", label: "Favorites", items: favList(mouseItems, mouseFavs), note: favNote }]
    catList(mouseEntries, ["Focus", "Glow", "Trail", "Bend"]).forEach(function(c) {
      out.push({ id: c, label: c, items: mouseEntries.filter(function(e) { return e.cat === c }).map(mouseItem), note: "" })
    })
    out.push({ id: "@random", label: "Surprise me", action: true })
    out.push({ id: "@off", label: "Off", action: true })
    return out
  }
  readonly property bool mouseBend: {
    for (var i = 0; i < mouseEntries.length; i++) if (mouseEntries[i].name === mouseCurrent) return mouseEntries[i].bend
    return false
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
      { id: "grid",      label: "Gravity grid",    hint: "grid pulled to mouse" },
      { id: "colorreact", label: "Colour reactor", hint: "only the picked colour reacts" }
    ] },
    { id: "nature", label: "Weather and nature", items: [
      { id: "rain",      label: "Rain on glass",   hint: "mouse wipes it dry" },
      { id: "snow",      label: "Snowfall",        hint: "swerves from mouse" },
      { id: "petals",    label: "Sakura petals",   hint: "falling petals" },
      { id: "glowdust", label: "Glow dust",       hint: "soft lights flee mouse" },
      { id: "fireflies", label: "Fireflies",      hint: "green, blinking, shy" },
      { id: "fog",       label: "Fog drift",       hint: "mouse clears it" },
      { id: "storm",     label: "Thunderstorm",    hint: "rain, lightning" },
      { id: "embers",    label: "Embers",          hint: "sparks flee mouse" },
      { id: "sparks",    label: "Sparks",          hint: "bright streaks rise, fall" },
      { id: "hearth",    label: "Cozy hearth",     hint: "fire, logs, warm light" },
      { id: "meteors",   label: "Meteor shower",   hint: "shooting stars" },
      { id: "rays",      label: "Light rays",      hint: "sun shafts, dust" },
      { id: "bubbles",   label: "Bubbles",         hint: "rising, refracting" },
      { id: "smoke",     label: "Rising smoke",    hint: "mouse drags it along" }
    ] },
    { id: "scenes", label: "New scenes", items: [
      { id: "aurora",    label: "Night aurora",    hint: "moon and stars" },
      { id: "silk",      label: "Silk flow",       hint: "glow at mouse" },
      { id: "warp",      label: "Star warp",       hint: "mouse steers" },
      { id: "nebula",    label: "Nebula",          hint: "space clouds" },
      { id: "ocean",     label: "Moonlit ocean",   hint: "waves, reflection" },
      { id: "plasma",    label: "Plasma",          hint: "theme colours" },
      { id: "synth",     label: "Synthwave",       hint: "sun and grid" },
      { id: "matrix",    label: "Digital rain",    hint: "mouse lights it" },
      { id: "crystals",  label: "Crystals",        hint: "glowing cells" }
    ] },
    { id: "blobs", label: "Merging blobs", items: [
      { id: "lava",      label: "Lava lamp",       hint: "blobs, mouse attracts" },
      { id: "mercury",   label: "Liquid mercury",  hint: "chrome, reflects wallpaper" },
      { id: "droplets",  label: "Glass droplets",  hint: "slide down, merge" },
      { id: "cells",     label: "Living cells",    hint: "membranes, nuclei" },
      { id: "goo",       label: "Colour goo",      hint: "colours blend where they meet" }
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
  // wallpaper effect files the list above does not know (added later) show up without a shell restart
  readonly property var wallAll: {
    var known = {}
    for (var i = 1; i < wallBase.length; i++) wallBase[i].items.forEach(function(it) { known[it.id] = true })
    var extra = []
    allEntries.forEach(function(e) {
      if (e.section === "wall" && !known[e.name]) extra.push({ id: e.name, label: e.cat, hint: e.desc })
    })
    return extra.length > 0 ? wallBase.concat([{ id: "more", label: "More", items: extra }]) : wallBase
  }
  readonly property var wallEffects: {
    var out = []
    for (var i = 1; i < wallAll.length; i++) out = out.concat(wallAll[i].items)
    return out
  }
  property var wallFavs: []
  readonly property var wallCats: {
    var out = [wallBase[0], { id: "fav", label: "Favorites", items: favList(wallEffects, wallFavs), note: favNote }]
    for (var i = 1; i < wallAll.length; i++) out.push(wallAll[i])
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
    if (!it || it.id.charAt(0) === "@" || it.id === wallShown || mixSecondOf("wall") !== "") { wallHoverTimer.stop(); return }
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
    if (id !== "" && paused) setPower("on")
    if (id !== wallSaved) { wall2 = ""; writeFile(wall2File, "") }
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
    strength: root.wallStrength / 100
    react: root.wallReact / 100
    range: root.wallRange / 100
    targetColor: "#" + root.wallTarget
    effect: root.fxHost && !root.paused ? root.wallShown : ""
    effect2: root.fxHost && !root.paused && root.wallPreview === "" ? root.mixSecondOf("wall") : ""
    mixMode: root.wallMixMode
    mixAmount: root.wallMixAmt / 100
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
  readonly property bool cursorLive: !shiftOnly || shiftDown || popupOpen // menu open: show a picked cursor effect at once
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

  // mouse hover previews only while Shift is held, and goes back to the saved settings on release or when the pointer leaves
  property bool menuShiftHeld: false
  property bool hoverPreviewing: false
  property var hoverItem: null
  property var hoverSec: null
  function hoverPoint(sec, item) {
    hoverSec = sec
    hoverItem = item
    hoverLeaveTimer.stop()
    if (menuShiftHeld) { hoverPreviewing = true; sec.pointed(item) }
    else revertHoverPreview()
  }
  function hoverLeave(item) {
    if (hoverItem === item) hoverItem = null
    hoverLeaveTimer.restart()
  }
  function setMenuShift(down) {
    if (menuShiftHeld === down) return
    menuShiftHeld = down
    if (down) { if (hoverItem && hoverSec) { hoverPreviewing = true; hoverSec.pointed(hoverItem) } }
    else revertHoverPreview()
  }
  function revertHoverPreview() {
    hoverLeaveTimer.stop()
    if (!hoverPreviewing) return
    hoverPreviewing = false
    screenTimer.stop(); colorTimer.stop(); mouseTimer.stop()
    if (screenPreviewed) { applyScreen(screenOrigin); screenPreviewed = false }
    if (colorPreviewed) { applyColor(colorOrigin); colorPreviewed = false }
    if (mousePreviewed) { applyMouse(mouseOrigin); mousePreviewed = false }
    clearWallPreview()
  }
  Timer { id: hoverLeaveTimer; interval: 220; onTriggered: root.revertHoverPreview() }

  MouseFx {
    strength: root.mouseStrength / 100
    effect: root.fxHost && !root.paused && root.mouseOn && !root.mouseBend && root.cursorLive ? root.mouseCurrent : ""
    motion: root.mouseMotion
    mouse: root.cursor
    fps: root.fps
  }

  // Bend effects: bin/cursor-bend feeds the pointer position into the Hyprland screen shader; with several
  // monitors the cursor's monitor is marked by a 3x2 pixel block in its corner (BendMarker) so only it is bent
  readonly property bool bendRunning: root.fxHost && !root.paused && root.mouseOn && root.mouseBend && root.cursorLive
  Process {
    running: root.bendRunning
    command: [root.bendScript]
  }
  BendMarker {
    active: root.bendRunning && Quickshell.screens.length > 1
    mouse: root.cursor
  }

  // cursor position, polled from Hyprland only while an effect that follows it is running
  property point cursor: Qt.point(-10000, -10000)
  Process {
    running: !root.paused && (root.wallOn || (root.mouseOn && root.cursorLive)) && root.fxHost
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

  // the developer's own copy ships what they save: with a "dev-export" file in the state folder, every save or remove also rewrites starter-combos
  function writeCombos() {
    Quickshell.execDetached(["bash", "-c", 'mkdir -p "$1" && printf %s "$2" > "$3" && [ -e "$1/dev-export" ] && printf %s "$2" > "$4"; true', "bash",
                             stateDir, combos.join("\n"), comboFile, path("starter-combos")])
  }
  function saveCombo() {
    var key = comboNow
    if (key === "|||") { flash("Nothing to save: every effect is off"); return }
    var label = comboItem(key).label
    if (combos.indexOf(key) >= 0) { flash("Already saved: " + label); return }
    combos = combos.concat([key])
    writeCombos()
    flash("Saved combo: " + label)
  }
  function deleteCombo(id) {
    if (combos.indexOf(id) < 0) return
    combos = combos.filter(function(c) { return c !== id })
    writeCombos()
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

  // ---------------------------------------------------------------- measured cost (bin/perf-log) and the "Active now" list
  property var perfCost: ({})
  FileView {
    path: root.stateDir + "/perf-summary.tsv"
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      var m = {}
      String(text() || "").split("\n").forEach(function(l) {
        var f = l.split("\t")
        if (f.length >= 4) m[f[0] + ":" + f[1]] = { rating: f[2], cost: f[3] }
      })
      root.perfCost = m
    }
  }
  function costTag(kind, name) {
    var r = perfCost[kind + ":" + name]
    return r && r.rating !== "light" ? (r.rating === "heavy" || r.rating === "rework" ? " ⚠" : " ") + "[" + r.rating + " +" + r.cost + "%]" : ""
  }
  function perfName(n) { return n.indexOf("custom-") === 0 ? "custom" : n }
  readonly property var activeNow: {
    var a = []
    function add(key, text) { a.push({ key: key, text: text }) }
    if (shaderOn) {
      add("screen", "Screen " + current + " " + fxStrength + "%" + costTag("screen", current))
      if (mixSecondOf("screen") !== "") add("screen2", (mixEffectMode === "blend" ? "~ " : "+ ") + effect2 + " " + mixEffectAmt + "%" + costTag("screen", effect2))
    }
    if (colorOn) {
      add("color", "Color " + colorCurrent + " " + colStrength + "%" + costTag("color", perfName(colorCurrent)))
      if (mixSecondOf("color") !== "") add("color2", (mixColorMode === "blend" ? "~ " : "+ ") + color2 + " " + mixColorAmt + "%")
    }
    if (wallOn) add("wall", "Wallpaper " + wallLabel(wallShown) + costTag("wall", wallShown))
    if (mouseOn) add("mouse", "Cursor " + mouseCurrent + costTag("cursor", mouseCurrent))
    var gm = winMix["*"] || { fx2: "", col2: "", fxMode: "stack", fxAmt: 100, colMode: "stack", colAmt: 100 }
    if (winEffectOn) add("winfx", "Windows " + winEffect + costTag("win", winEffect))
    if (winEffectOn && gm.fx2 !== "") add("winfx2", "Windows " + (gm.fxMode === "blend" ? "~ " : "+ ") + gm.fx2 + " " + gm.fxAmt + "%")
    if (winColorOn) add("wincol", "Windows " + winColor + costTag("wincolor", perfName(winColor)))
    if (winColorOn && gm.col2 !== "") add("wincol2", "Windows " + (gm.colMode === "blend" ? "~ " : "+ ") + gm.col2 + " " + gm.colAmt + "%")
    if (winFrameOn) add("winframe", "Frame " + winFrame)
    Object.keys(winApps).forEach(function(c) { add("app:" + c, (c.indexOf("layer:") === 0 ? c.slice(6) : c) + ": " + winAppSummary(c)) })
    return a
  }
  function removeActive(key) {
    if (key === "screen") offIn("screen")
    else if (key === "screen2") Quickshell.execDetached([script, "mix", "effect", "off"])
    else if (key === "color") offIn("color")
    else if (key === "color2") Quickshell.execDetached([script, "mix", "color", "off"])
    else if (key === "wall") setWall("", true)
    else if (key === "mouse") offIn("mouse")
    else if (key === "winfx") winRun(["effect", "off"])
    else if (key === "wincol") winRun(["color", "off"])
    else if (key === "winfx2") winRun(["mix", "effect", "off"])
    else if (key === "wincol2") winRun(["mix", "color", "off"])
    else if (key === "winframe") winRun(["frame", "off"])
    else if (key.indexOf("app:") === 0) winRun(["-a", key.slice(4), "inherit"])
  }
  function winOwnText() {
    var l = Object.keys(winApps).map(function(c) { return (c.indexOf("layer:") === 0 ? c.slice(6) : c) + ": " + winAppSummary(c) })
    return l.length > 0 ? "(own: " + l.join(", ") + ") " : ""
  }
  function costReport() { Quickshell.execDetached(["bash", "-c", 'python3 "$1" report --notify >/dev/null 2>&1', "bash", root.path("bin/perf-log")]) }

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
  property bool ctrlDown: false
  // "/" filter: one query narrows every column at once (label, description, hint and category name; all words must match)
  property string query: ""
  function focusSearch() { searchField.forceActiveFocus(); searchField.selectAll() }
  function leaveSearch() { keys.forceActiveFocus() }
  function clearSearch() { searchField.text = ""; leaveSearch() }
  function applyQuery() {
    Qt.callLater(function() {
      ["screen", "color", "wall", "mouse", "win", "combo"].forEach(function(k) { secOf(k).resetForQuery() })
      if (query.trim() !== "" && secOf(focusKind).cats.length === 0) {
        for (var i = 0; i < visibleKinds.length; i++) if (secOf(visibleKinds[i]).cats.length > 0) { activeKind = visibleKinds[i]; break }
      }
    })
  }
  function matchTotal() {
    var n = 0
    visibleKinds.forEach(function(k) { n += secOf(k).matchCount })
    return n
  }
  function cycleKind(dir) {
    winPickOpen = false
    var i = visibleKinds.indexOf(focusKind) + dir
    activeKind = visibleKinds[(i + nVis) % nVis]
  }
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
      lister.running = true
      screenOrigin = current
      colorOrigin = colorCurrent
      mouseOrigin = mouseCurrent
      screenPreviewed = false
      colorPreviewed = false
      mousePreviewed = false
      wallPreviewed = false
      winPreviewed = false
      winScope = "*"
      winPickOpen = false
      winOriginFx = winEffect
      winOriginCol = winColor
      winOriginFrame = winFrame
      refreshWin()
      hoverPreviewing = false
      hoverItem = null
      menuShiftHeld = false
      activeKind = visibleKinds[0]
      searchField.text = ""
      screenSec.sync()
      colorSec.sync()
      wallSec.sync()
      mouseSec.sync()
      winSec.sync()
      comboSec.sync()
    } else {
      screenTimer.stop()
      colorTimer.stop()
      mouseTimer.stop()
      revertWinPreview()
      if (screenPreviewed) { applyScreen(screenOrigin); screenPreviewed = false }
      if (colorPreviewed) { applyColor(colorOrigin); colorPreviewed = false }
      if (mousePreviewed) { applyMouse(mouseOrigin); mousePreviewed = false }
      clearWallPreview()
    }
  }

  function savedOf(k) { return k === "screen" ? current : (k === "color" ? colorCurrent : (k === "wall" ? wallSaved : (k === "win" ? (winEffectOnS ? "e:" + winEffectS : "") : mouseCurrent))) }
  function favsOf(k) { return k === "screen" ? screenFavs : (k === "color" ? colorFavs : (k === "wall" ? wallFavs : mouseFavs)) }
  function favFileOf(k) { return k === "screen" ? screenFavFile : (k === "color" ? colorFavFile : (k === "wall" ? wallFavFile : mouseFavFile)) }
  function itemsOf(k) { return k === "screen" ? screenItems : (k === "color" ? colorItems : (k === "wall" ? wallEffects : (k === "win" ? winEffectItems : mouseItems))) }
  function chooseIn(k, it, keep) {
    if (k === "screen") chooseScreen(it, keep)
    else if (k === "color") chooseColor(it, keep)
    else if (k === "wall") chooseWall(it, keep)
    else if (k === "win") chooseWin(it, keep)
    else chooseMouse(it, keep)
  }
  function offIn(k) {
    if (k === "combo") offAll()
    else if (k === "wall") setWall("", true)
    else if (k === "win") { if (winScope === "*") winRun(["off"]); else winRunS(["off"]) }
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
    if (k === "win" && id === "@copy") { Quickshell.execDetached(["wl-copy", installCmd]); flash("Copied: " + installCmd); return }
    if (k === "win" && id === "@inherit") { winRunS(["inherit"]); return }
    if (k === "win" && id === "@off" && winScope !== "*") { winRunS(["off"]); return }
    if (id === "@off") offIn(k)
    else if (id === "@random") randomIn(k)
  }
  function toggleFav(k) {
    var s = secOf(k), it = s.selected
    if (!it || it.id.charAt(0) === "@" || k === "win") return
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
    hoverPreviewing = false
    if (winPickOpen) {
      if (dy !== 0) winSec.pickerIdx = clamp(winSec.pickerIdx + dy, 0, winAppItems.length - 1)
      else if (dx < 0) winPickOpen = false
      else pickWinApp(winAppItems[winSec.pickerIdx])
      return
    }
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
    if (t === "A") { if (showWin && winPlugin !== "missing") { activeKind = "win"; toggleWinPicker() } }
    else if (winPickOpen) { if (t === "q") close(); else if (t === "g") winSec.pickerIdx = 0; else if (t === "G") winSec.pickerIdx = winAppItems.length - 1 }
    else if (t === "/") focusSearch()
    else if (t === "q") close()
    else if (t === "a") setAnimated()
    else if (t === "o" || t === "0") offIn(k)
    else if (t === "O") offAll()
    else if (t === "P") costReport()
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
    else if (t === "W") toggleSection("win")
    else if (t === "c") toggleSection("mouse")
    else if (t === "x") setShiftOnly(!shiftOnly)
    else if (t === "p") togglePause()
    else if (t === "]" || t === "=" || t === "+") nudgeStrength(5)
    else if (t === "[" || t === "-") nudgeStrength(-5)
    else if (t === "}") nudgeStrength(1)
    else if (t === "{") nudgeStrength(-1)
    else if (t === "d") resetStrength()
    else if (t === ")") { if (focusKind === "wall" && wallOn) setWallReact(wallReact + 10) }
    else if (t === "(") { if (focusKind === "wall" && wallOn) setWallReact(wallReact - 10) }
    else if (t === ".") nudgeMix(5)
    else if (t === ",") nudgeMix(-5)
    else if (t === ">") nudgeMix(1)
    else if (t === "<") nudgeMix(-1)
    else if (t === "t") toggleMixMode()
    else if (t === "D") resetMix()
    else if (t === "\b" || t === "\x7f") clearMix()
    else if (t === "u") {
      if (focusKind === "wall" && showWall && wallReactorOn) wallSec.focusTarget()
      else if (showColor) { activeKind = "color"; colorSec.focusHex() }
    }
    else if (t === "U") { if (showColor) toggleCustomFav() }
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
    function windows(args: string): void { root.winRun(args.split(" ").filter(function(a) { return a !== "" })) }
    function combo(which: string): void { if (which === "save") root.saveCombo(); else root.applyCombo(root.comboAt(which), true) }
    function power(mode: string): void { root.setPower(mode === "" ? "toggle" : mode) }
    function strength(kind: string, value: string): void { Quickshell.execDetached([root.script, "strength", kind, value]) }
    function shiftOnly(mode: string): void { root.setShiftOnly(mode === "toggle" ? !root.shiftOnly : (mode === "on" || mode === "1")) }
  }

  Component.onCompleted: {
    Quickshell.execDetached(["python3", root.path("bin/perf-log"), "run"])
    lister.running = true
    resolver.running = true
    wallStep("status")
    winRun(["apply"])
    winRun(["frame", "sync"])
    // a watch on a missing file never fires, so the state files must exist; the preview file starts empty
    // starter combos: each shipped line is added to the user's list once (tracked in starter-seen), so new releases deliver new combos
    // and a combo the user removed does not come back
    Quickshell.execDetached(["bash", "-c", 'mkdir -p "$1"; : > "$2"; seen="$1/starter-seen"; touch "$seen" "$3"; while IFS= read -r l; do [ -n "$l" ] || continue; grep -qxF -- "$l" "$seen" && continue; grep -qxF -- "$l" "$3" || { [ -s "$3" ] && [ -n "$(tail -c1 "$3")" ] && echo >> "$3"; printf "%s\\n" "$l" >> "$3"; }; printf "%s\\n" "$l" >> "$seen"; done < "$4" 2>/dev/null; shift 4; for f in "$@"; do [ -e "$f" ] || : > "$f"; done', "bash",
                             root.stateDir, root.wallPreviewFile, root.comboFile, root.path("starter-combos"), root.stateFile, root.colorFile, root.colorFavFile, root.animatedFile, root.mouseFile, root.sectionsFile, root.shiftOnlyFile, root.disabledFile, root.fxStrengthFile, root.colStrengthFile, root.wallStrengthFile, root.mouseStrengthFile, root.wallReactFile, root.wallRangeFile, root.wallTargetFile, root.winEffectFile, root.winColorFile, root.winFrameFile, root.winTargetFile, root.winAppsFile, root.winFxStrengthFile, root.winColStrengthFile,
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
    active: !root.paused && (root.shaderOn || root.colorOn || root.wallOn || root.mouseOn || root.winAnyOn)
    tooltipText: "OmaShaders" + (root.paused ? " (paused)" : "") + "\nScreen: " + (root.shaderOn ? root.current + " " + root.fxStrength + "%" : "off")
                 + "\nColor: " + (root.colorOn ? root.colorCurrent + " " + root.colStrength + "%" : "off")
                 + "\nWallpaper effect: " + (root.wallOn ? root.wallLabel(root.wallShown) : "off")
                 + "\nWindows: " + (root.winAnyOn ? root.winOwnText() + [root.winEffect, root.winColor, root.winFrame].filter(function(x) { return x !== "" }).join(" + ") : "off")
                 + "\nCursor: " + (root.mouseOn ? root.mouseCurrent : "off") + (root.shiftOnly ? " (only while Shift is held)" : "")
                 + (root.wallStatus !== "" ? "\nWallpaper image: " + root.wallStatus.replace(/[<>&]/g, "?") : "")
                 + "\nclick: menu (hjkl) · right-click: pause / resume effects · middle-click: next wallpaper · scroll: step"
    onPressed: function(b) {
      if (b === Qt.RightButton) root.togglePause()
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
    // toggles (menu filters) are outlined and fill in when on; actions are solid, bold and centred
    property bool toggle: false
    property bool checked: false
    signal clicked()
    width: parent ? parent.width : 0
    height: Style.space(28)
    radius: Style.space(6)
    color: toggle ? root.fgA(checked ? (mouse.containsMouse && !dim ? 0.24 : 0.17) : (mouse.containsMouse && !dim ? 0.1 : 0.03))
                  : root.fgA(mouse.containsMouse && !dim ? 0.32 : 0.22)
    border.width: toggle ? 1 : 0
    border.color: root.fgA(checked ? 0.5 : 0.22)
    opacity: dim ? 0.4 : 1

    Text {
      anchors.left: parent.left
      anchors.leftMargin: Style.space(10)
      anchors.right: parent.right
      anchors.rightMargin: Style.space(6)
      anchors.verticalCenter: parent.verticalCenter
      horizontalAlignment: row.toggle ? Text.AlignLeft : Text.AlignHCenter
      elide: Text.ElideRight
      textFormat: Text.PlainText
      text: row.label
      color: root.fg
      opacity: row.toggle && !row.checked ? 0.75 : 1
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body
      font.bold: !row.toggle
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
  // a labelled 0..max slider row (drag, wheel, right-click = default), used under a menu's strength row
  component PctRow: Item {
    id: pr
    property string label: ""
    property int value: 0
    property int maxValue: 100
    property int defaultValue: 100
    property bool live: true
    property bool lit: false
    property bool dragging: false
    property int dragValue: 0
    readonly property int shown: (dragging || prHold.running) ? dragValue : value
    signal picked(int v)
    signal touched()
    opacity: live ? 1 : 0.4
    Timer { id: prHold; interval: 700 }
    Rectangle { anchors.fill: parent; radius: Style.space(6); color: root.fgA(pr.lit ? 0.1 : 0.05) }
    Text {
      id: prLabel
      anchors.left: parent.left
      anchors.leftMargin: Style.space(10)
      anchors.verticalCenter: parent.verticalCenter
      textFormat: Text.PlainText
      text: pr.label
      color: root.fg
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body
    }
    Text {
      id: prValue
      anchors.right: parent.right
      anchors.rightMargin: Style.space(10)
      anchors.verticalCenter: parent.verticalCenter
      width: Style.space(42)
      horizontalAlignment: Text.AlignRight
      textFormat: Text.PlainText
      text: pr.shown + "%"
      color: root.fg
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body
    }
    Item {
      id: prTrack
      anchors.left: prLabel.right
      anchors.leftMargin: Style.space(14)
      anchors.right: prValue.left
      anchors.rightMargin: Style.space(10)
      height: parent.height
      Rectangle {
        id: prRail
        width: parent.width
        height: Style.space(4)
        radius: height / 2
        anchors.verticalCenter: parent.verticalCenter
        color: root.fgA(0.2)
      }
      Rectangle {
        width: prRail.width * pr.shown / pr.maxValue
        height: prRail.height
        radius: prRail.radius
        anchors.verticalCenter: parent.verticalCenter
        color: root.fgA(0.85)
      }
      Rectangle {
        x: prRail.width * pr.defaultValue / pr.maxValue - width / 2
        width: Style.space(2)
        height: Style.space(12)
        anchors.verticalCenter: parent.verticalCenter
        color: root.fgA(0.55)
      }
      Rectangle {
        x: prRail.width * pr.shown / pr.maxValue - width / 2
        width: Style.space(12)
        height: width
        radius: width / 2
        anchors.verticalCenter: parent.verticalCenter
        color: root.fg
      }
    }
    MouseArea {
      anchors.fill: parent
      enabled: pr.live
      acceptedButtons: Qt.LeftButton | Qt.RightButton
      cursorShape: Qt.PointingHandCursor
      function valAt(mx) { return Math.round(root.clamp(mapToItem(prTrack, mx, 0).x / prTrack.width, 0, 1) * pr.maxValue) }
      function pick(v) { pr.dragValue = v; prHold.restart(); pr.picked(v) }
      onPressed: function(m) {
        pr.touched()
        if (m.button === Qt.RightButton) { pick(pr.defaultValue); return }
        pr.dragging = true
        pick(valAt(m.x))
      }
      onPositionChanged: function(m) {
        if (!pr.dragging) return
        var v = valAt(m.x)
        if (v !== pr.dragValue) pick(v)
      }
      onReleased: pr.dragging = false
      onCanceled: pr.dragging = false
      onWheel: function(w) { pick(root.clamp(pr.shown + (w.angleDelta.y > 0 ? 5 : -5), 0, pr.maxValue)) }
    }
  }

  component SectionMenu: Item {
    id: sec
    property string title: ""
    property string icon: ""
    property var rawCats: []
    readonly property bool filtering: root.query.trim() !== ""
    readonly property var cats: {
      if (!filtering) return rawCats
      var terms = root.query.trim().toLowerCase().split(/\s+/)
      var out = []
      rawCats.forEach(function(c) {
        if (c.action || c.id === "fav" || !c.items) return
        var catText = String(c.label).toLowerCase()
        var items = c.items.filter(function(it) {
          if (it.id.charAt(0) === "@") return false
          var hay = (it.label + " " + (it.desc || "") + " " + (it.hint || "") + " " + catText).toLowerCase()
          return terms.every(function(t) { return hay.indexOf(t) >= 0 })
        })
        if (items.length > 0) out.push({ id: c.id, label: c.label, items: items, note: "" })
      })
      return out
    }
    readonly property int matchCount: {
      var n = 0
      cats.forEach(function(c) { n += (c.items || []).length })
      return n
    }
    property string saved: ""
    property var favs: []
    property bool focused: false
    property int defaultCat: 0
    property bool hasStrength: false
    property bool strengthLive: false
    property int strength: 100
    property int strengthDefault: 100
    property string strengthLabel: "Strength"
    property var alsoSaved: []
    property bool hasMix: false
    property bool mixLive: false
    property string mixName: ""
    property string mixMode: "stack"
    property int mixValue: 100
    property int mixDefault: 100
    property string mixNoun: "effect"
    // optional combobox next to the title (the Windows column uses it to pick which app is edited)
    property bool hasPicker: false
    property string pickerText: ""
    property var pickerItems: []
    property string pickerCurrent: ""
    property bool pickerOpen: false
    property int pickerIdx: 0
    signal pickerToggled()
    signal pickerChosen(var item)
    signal strengthPicked(int value)
    signal mixPicked(int value)
    signal mixModeToggled()
    signal mixChosen(var item, bool keep)
    property bool hasCustom: false
    property string customHex: ""
    property real customH: 0
    property real customS: 1
    property real customV: 1
    property bool customFav: false
    property bool customActive: false
    signal customHsv(real h, real s, real v)
    signal customHexEntered(string text)
    signal customFavToggled()
    // wallpaper options under the strength row: mouse reaction, and the Colour reactor's range and target colour
    property bool hasWallOpts: false
    property int reactValue: 100
    property bool reactLive: false
    property int rangeValue: 50
    property string targetHex: "e8a33d"
    property bool targetLive: false
    signal reactPicked(int value)
    signal rangePicked(int value)
    signal targetHexEntered(string text)
    signal targetPickRequested()
    readonly property bool editing: hexField.activeFocus || targetField.activeFocus
    function focusHex() { hexField.forceActiveFocus(); hexField.selectAll() }
    function focusTarget() { targetField.forceActiveFocus(); targetField.selectAll() }
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

    implicitHeight: Style.space(24) + visibleRows * (rowH + rowGap) + (hasStrength ? rowH + Style.space(6) : 0) + (hasMix ? rowH + Style.space(4) : 0) + (hasCustom ? 2 * rowH + Style.space(8) : 0) + (hasWallOpts ? 3 * (rowH + Style.space(4)) : 0)

    function indexOfSaved(ci) {
      if (saved === "" || ci < 0 || ci >= cats.length) return -1
      var it = cats[ci].items || []
      for (var j = 0; j < it.length; j++) if (it[j].id === saved) return j
      return -1
    }
    function catHasMark(ci) {
      if (alsoSaved.length === 0 || ci < 0 || ci >= cats.length) return false
      var it = cats[ci].items || []
      for (var j = 0; j < it.length; j++) if (alsoSaved.indexOf(it[j].id) >= 0) return true
      return false
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
    function resetForQuery() {
      if (!filtering) { sync(); return }
      catIdx = 0
      itemIdx = 0
      col = cats.length > 0 ? 1 : 0
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
    function activate(keep, mix) {
      if (col === 0) {
        if (curCat && curCat.action) acted(curCat.id)
        else if (curItems.length > 0) { col = 1; itemIdx = root.clamp(itemIdx, 0, curItems.length - 1); pointed(selected) }
      } else if (selected) {
        if (mix && hasMix) mixChosen(selected, keep)
        else chosen(selected, keep)
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
    function showCat() {
      var y = catIdx * (rowH + rowGap)
      if (y < catFlick.contentY) catFlick.contentY = y
      else if (y + rowH > catFlick.contentY + catFlick.height) catFlick.contentY = y + rowH - catFlick.height
    }
    onCatIdxChanged: showCat()
    onItemIdxChanged: showSelected()
    onCurItemsChanged: Qt.callLater(showSelected)

    Text {
      id: titleText
      height: Style.space(24)
      verticalAlignment: Text.AlignVCenter
      leftPadding: Style.space(10)
      textFormat: Text.PlainText
      text: (sec.icon !== "" ? sec.icon + "  " : "") + sec.title.toUpperCase()
      opacity: sec.focused ? 0.95 : 0.45
      color: root.fg
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body * 0.8
      font.bold: true
      font.letterSpacing: 1
    }

    Rectangle {
      id: pickerBtn
      visible: sec.hasPicker
      x: titleText.implicitWidth + Style.space(6)
      y: Style.space(2)
      height: titleText.height - Style.space(4)
      width: Math.min(sec.width - x - Style.space(4), pickerLabel.implicitWidth + Style.space(20))
      radius: Style.space(5)
      color: root.fgA(sec.pickerOpen ? 0.2 : (pickerHover.containsMouse ? 0.16 : 0.08))
      border.width: 1
      border.color: root.fgA(sec.focused ? 0.35 : 0.2)
      Text {
        id: pickerLabel
        anchors.verticalCenter: parent.verticalCenter
        anchors.left: parent.left
        anchors.leftMargin: Style.space(8)
        anchors.right: parent.right
        anchors.rightMargin: Style.space(8)
        elide: Text.ElideRight
        textFormat: Text.PlainText
        text: sec.pickerText + "  " + (sec.pickerOpen ? "\u25B4" : "\u25BE")
        color: root.fg
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.body * 0.85
      }
      MouseArea {
        id: pickerHover
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: { sec.focusRequested(); sec.pickerToggled() }
      }
    }

    Rectangle {
      id: pickerList
      visible: sec.hasPicker && sec.pickerOpen
      z: 30
      x: pickerBtn.x
      y: pickerBtn.y + pickerBtn.height + Style.space(2)
      width: Math.min(sec.width - x, Math.round(sec.width * 0.8))
      height: Math.min(sec.pickerItems.length, 11) * (sec.rowH + sec.rowGap) + Style.space(8)
      radius: Style.space(8)
      color: Qt.rgba(1 - root.fg.r, 1 - root.fg.g, 1 - root.fg.b, 0.97)
      border.width: 1
      border.color: root.fgA(0.3)
      ListView {
        id: pickerView
        anchors.fill: parent
        anchors.margins: Style.space(4)
        spacing: sec.rowGap
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        model: sec.pickerItems
        currentIndex: sec.pickerIdx
        onCurrentIndexChanged: positionViewAtIndex(currentIndex, ListView.Contain)
        delegate: Rectangle {
          id: pickRow
          required property var modelData
          required property int index
          readonly property bool cur: modelData.id === sec.pickerCurrent
          width: pickerView.width
          height: sec.rowH
          radius: Style.space(6)
          color: index === sec.pickerIdx ? root.fgA(0.2) : (pickMouse.containsMouse ? root.fgA(0.12) : "transparent")
          Text {
            id: pickLabel
            anchors.left: parent.left
            anchors.leftMargin: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            width: Math.min(implicitWidth, parent.width - Style.space(60))
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: (pickRow.cur ? "● " : "") + pickRow.modelData.label
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
          }
          Text {
            anchors.left: pickLabel.right
            anchors.leftMargin: Style.space(8)
            anchors.right: parent.right
            anchors.rightMargin: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            horizontalAlignment: Text.AlignRight
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: pickRow.modelData.hint || ""
            opacity: 0.55
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body * 0.85
          }
          MouseArea {
            id: pickMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: sec.pickerChosen(pickRow.modelData)
          }
        }
      }
    }

    Row {
      id: panes
      anchors.top: titleText.bottom
      anchors.left: parent.left
      anchors.right: parent.right
      spacing: Style.space(8)

      Flickable {
        id: catFlick
        width: Math.round(sec.width * 0.34)
        height: sec.visibleRows * (sec.rowH + sec.rowGap)
        contentHeight: catCol.height
        clip: true
        interactive: contentHeight > height
        boundsBehavior: Flickable.StopAtBounds

      Column {
        id: catCol
        width: catFlick.width
        spacing: sec.rowGap

        Repeater {
          model: sec.cats

          Rectangle {
            id: catRow
            required property var modelData
            required property int index
            readonly property bool selected: index === sec.catIdx
            readonly property bool hasSaved: modelData.id !== "fav" && (sec.indexOfSaved(index) >= 0 || sec.catHasMark(index))
            width: catCol.width
            height: sec.rowH
            radius: Style.space(6)
            color: selected ? root.fgA(sec.col === 0 && sec.focused ? 0.2 : 0.09) : (catMouse.containsMouse ? root.fgA(0.04) : "transparent")

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
      }

      ListView {
        id: list
        width: panes.width - catFlick.width - panes.spacing
        height: sec.visibleRows * (sec.rowH + sec.rowGap)
        spacing: sec.rowGap
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        model: sec.curItems

        delegate: Rectangle {
          id: itemRow
          required property var modelData
          required property int index
          readonly property bool isSecond: sec.mixLive && modelData.id === sec.mixName
          readonly property bool isSaved: modelData.id === sec.saved || sec.alsoSaved.indexOf(modelData.id) >= 0 || isSecond
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
            width: Math.min(implicitWidth, parent.width - Style.space(60))
            elide: Text.ElideRight
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
            text: itemRow.isSecond ? "+ " + sec.mixMode : (itemRow.isSaved ? root.checkGlyph : (itemRow.modelData.hint || ""))
            opacity: itemRow.isSaved ? 1 : 0.5
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: (itemRow.isSaved && !itemRow.isSecond) ? Style.font.body : Style.font.body * 0.8
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
              root.menuShiftHeld = (m.modifiers & Qt.ShiftModifier) !== 0
              root.hoverPoint(sec, itemRow.modelData)
            }
            onExited: root.hoverLeave(itemRow.modelData)
            onClicked: function(m) {
              root.hoverPreviewing = false
              sec.focusRequested()
              sec.col = 1
              sec.itemIdx = itemRow.index
              if ((m.modifiers & Qt.ControlModifier) && sec.hasMix) sec.mixChosen(itemRow.modelData, true)
              else sec.chosen(itemRow.modelData, true)
            }
          }
        }
      }
    }

    // strength slider: drag, wheel, or [ ] (5) { } (1) d (default) while this menu has focus; right-click = default
    Item {
      id: strengthRow
      visible: sec.hasStrength
      y: titleText.height + sec.visibleRows * (sec.rowH + sec.rowGap) + Style.space(6)
      width: sec.width
      height: sec.rowH
      property bool dragging: false
      property int dragValue: 0
      readonly property int shown: (dragging || holdTimer.running) ? dragValue : sec.strength
      opacity: sec.strengthLive ? 1 : 0.4
      Timer { id: holdTimer; interval: 700 }

      Rectangle { anchors.fill: parent; radius: Style.space(6); color: root.fgA(sec.focused ? 0.1 : 0.05) }
      Text {
        id: strengthLabel
        anchors.left: parent.left
        anchors.leftMargin: Style.space(10)
        anchors.verticalCenter: parent.verticalCenter
        textFormat: Text.PlainText
        text: sec.strengthLabel
        color: root.fg
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.body
      }
      Text {
        id: strengthValue
        anchors.right: parent.right
        anchors.rightMargin: Style.space(10)
        anchors.verticalCenter: parent.verticalCenter
        width: Style.space(42)
        horizontalAlignment: Text.AlignRight
        textFormat: Text.PlainText
        text: sec.strengthLive ? strengthRow.shown + "%" : "–"
        color: root.fg
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.body
      }
      Item {
        id: track
        anchors.left: strengthLabel.right
        anchors.leftMargin: Style.space(14)
        anchors.right: strengthValue.left
        anchors.rightMargin: Style.space(10)
        height: parent.height

        Rectangle {
          id: rail
          width: parent.width
          height: Style.space(4)
          radius: height / 2
          anchors.verticalCenter: parent.verticalCenter
          color: root.fgA(0.2)
        }
        Rectangle {
          width: rail.width * strengthRow.shown / 100
          height: rail.height
          radius: rail.radius
          anchors.verticalCenter: parent.verticalCenter
          color: root.fgA(0.85)
        }
        Rectangle {
          x: rail.width * sec.strengthDefault / 100 - width / 2
          width: Style.space(2)
          height: Style.space(12)
          anchors.verticalCenter: parent.verticalCenter
          color: root.fgA(0.55)
          visible: sec.strengthLive
        }
        Rectangle {
          x: rail.width * strengthRow.shown / 100 - width / 2
          width: Style.space(12)
          height: width
          radius: width / 2
          anchors.verticalCenter: parent.verticalCenter
          color: root.fg
        }
      }
      MouseArea {
        anchors.fill: parent
        enabled: sec.strengthLive
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        cursorShape: Qt.PointingHandCursor
        function pctAt(mx) { return Math.round(root.clamp(mapToItem(track, mx, 0).x / track.width, 0, 1) * 100) }
        function pick(v) { strengthRow.dragValue = v; holdTimer.restart(); sec.strengthPicked(v) }
        onPressed: function(m) {
          sec.focusRequested()
          if (m.button === Qt.RightButton) { pick(sec.strengthDefault); return }
          strengthRow.dragging = true
          pick(pctAt(m.x))
        }
        onPositionChanged: function(m) {
          if (!strengthRow.dragging) return
          var v = pctAt(m.x)
          if (v !== strengthRow.dragValue) pick(v)
        }
        onReleased: strengthRow.dragging = false
        onCanceled: strengthRow.dragging = false
        onWheel: function(w) { pick(root.clamp(strengthRow.shown + (w.angleDelta.y > 0 ? 5 : -5), 0, 100)) }
      }
    }

    // mix row (Screen and Color): the second item picked with Ctrl+Enter / Ctrl+click; click the mode to flip stack / blend, t flips it from the keys, , . (< >) move the amount, D resets it, backspace removes the second
    Item {
      id: mixRow
      visible: sec.hasMix
      y: strengthRow.y + sec.rowH + Style.space(4)
      width: sec.width
      height: sec.rowH
      property bool dragging: false
      property int dragValue: 0
      readonly property int shown: (dragging || mixHold.running) ? dragValue : sec.mixValue
      opacity: sec.mixLive ? 1 : 0.4
      Timer { id: mixHold; interval: 700 }

      Rectangle { anchors.fill: parent; radius: Style.space(6); color: root.fgA(sec.focused ? 0.1 : 0.05) }
      Text {
        id: mixLabel
        anchors.left: parent.left
        anchors.leftMargin: Style.space(10)
        anchors.verticalCenter: parent.verticalCenter
        textFormat: Text.PlainText
        text: sec.mixLive ? (sec.mixMode === "blend" ? "Blend  ⇄" : "Stack  ⇄") : "Mix"
        color: root.fg
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.body
        MouseArea {
          anchors.fill: parent
          anchors.margins: -Style.space(4)
          enabled: sec.mixLive
          cursorShape: Qt.PointingHandCursor
          onClicked: { sec.focusRequested(); sec.mixModeToggled() }
        }
      }
      Text {
        id: mixValueText
        anchors.right: parent.right
        anchors.rightMargin: Style.space(10)
        anchors.verticalCenter: parent.verticalCenter
        width: Style.space(42)
        horizontalAlignment: Text.AlignRight
        textFormat: Text.PlainText
        text: sec.mixLive ? mixRow.shown + "%" : "–"
        color: root.fg
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.body
      }
      Text {
        id: mixHint
        visible: !sec.mixLive
        anchors.left: mixLabel.right
        anchors.leftMargin: Style.space(14)
        anchors.right: mixValueText.left
        anchors.verticalCenter: parent.verticalCenter
        elide: Text.ElideRight
        textFormat: Text.PlainText
        text: "Ctrl+⏎ or Ctrl+click adds a second " + sec.mixNoun
        color: root.fg
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.body * 0.85
      }
      Item {
        id: mixTrack
        visible: sec.mixLive
        anchors.left: mixLabel.right
        anchors.leftMargin: Style.space(14)
        anchors.right: mixValueText.left
        anchors.rightMargin: Style.space(10)
        height: parent.height

        Rectangle {
          id: mixRail
          width: parent.width
          height: Style.space(4)
          radius: height / 2
          anchors.verticalCenter: parent.verticalCenter
          color: root.fgA(0.2)
        }
        Rectangle {
          width: mixRail.width * mixRow.shown / 100
          height: mixRail.height
          radius: mixRail.radius
          anchors.verticalCenter: parent.verticalCenter
          color: root.fgA(0.85)
        }
        Rectangle {
          x: mixRail.width * sec.mixDefault / 100 - width / 2
          width: Style.space(2)
          height: Style.space(12)
          anchors.verticalCenter: parent.verticalCenter
          color: root.fgA(0.55)
        }
        Rectangle {
          x: mixRail.width * mixRow.shown / 100 - width / 2
          width: Style.space(12)
          height: width
          radius: width / 2
          anchors.verticalCenter: parent.verticalCenter
          color: root.fg
        }
      }
      MouseArea {
        anchors.left: mixTrack.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        enabled: sec.mixLive
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        cursorShape: Qt.PointingHandCursor
        function pctAt(mx) { return Math.round(root.clamp(mapToItem(mixTrack, mx, 0).x / mixTrack.width, 0, 1) * 100) }
        function pick(v) { mixRow.dragValue = v; mixHold.restart(); sec.mixPicked(v) }
        onPressed: function(m) {
          sec.focusRequested()
          if (m.button === Qt.RightButton) { pick(sec.mixDefault); return }
          mixRow.dragging = true
          pick(pctAt(m.x))
        }
        onPositionChanged: function(m) {
          if (!mixRow.dragging) return
          var v = pctAt(m.x)
          if (v !== mixRow.dragValue) pick(v)
        }
        onReleased: mixRow.dragging = false
        onCanceled: mixRow.dragging = false
        onWheel: function(w) { pick(root.clamp(mixRow.shown + (w.angleDelta.y > 0 ? 5 : -5), 0, 100)) }
      }
    }

    // wallpaper options: mouse reaction (0 = ignores the pointer, 100 = as designed, 200 = exaggerated), then the Colour reactor's range and target colour
    PctRow {
      id: reactRow
      visible: sec.hasWallOpts
      y: (sec.hasMix ? mixRow.y : strengthRow.y) + sec.rowH + Style.space(4)
      width: sec.width
      height: sec.rowH
      label: "Mouse reaction"
      value: sec.reactValue
      maxValue: 200
      defaultValue: 100
      live: sec.reactLive
      lit: sec.focused
      onPicked: function(v) { sec.reactPicked(v) }
      onTouched: sec.focusRequested()
    }
    PctRow {
      id: rangeRow
      visible: sec.hasWallOpts
      y: reactRow.y + sec.rowH + Style.space(4)
      width: sec.width
      height: sec.rowH
      label: "Colour range"
      value: sec.rangeValue
      maxValue: 100
      defaultValue: 50
      live: sec.targetLive
      lit: sec.focused
      onPicked: function(v) { sec.rangePicked(v) }
      onTouched: sec.focusRequested()
    }
    Item {
      id: targetRow
      visible: sec.hasWallOpts
      y: rangeRow.y + sec.rowH + Style.space(4)
      width: sec.width
      height: sec.rowH
      opacity: sec.targetLive ? 1 : 0.4
      Rectangle { anchors.fill: parent; radius: Style.space(6); color: root.fgA(sec.focused ? 0.1 : 0.05) }
      Rectangle {
        id: targetSwatch
        x: Style.space(10)
        anchors.verticalCenter: parent.verticalCenter
        width: Style.space(18)
        height: width
        radius: Style.space(4)
        color: "#" + sec.targetHex
        border.width: 1
        border.color: root.fgA(0.4)
      }
      Text {
        id: targetLabel
        anchors.left: targetSwatch.right
        anchors.leftMargin: Style.space(10)
        anchors.verticalCenter: parent.verticalCenter
        textFormat: Text.PlainText
        text: "Reacts to  #"
        color: root.fg
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.body
      }
      TextField {
        id: targetField
        anchors.left: targetLabel.right
        anchors.right: targetPick.left
        anchors.rightMargin: Style.space(8)
        anchors.verticalCenter: parent.verticalCenter
        height: sec.rowH - Style.space(4)
        verticalPadding: Style.space(2)
        maximumLength: 7
        placeholderText: "rrggbb"
        foreground: root.fg
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.body
        Binding on text { when: !targetField.activeFocus; value: sec.targetHex }
        Keys.onPressed: function(event) {
          if (event.key === Qt.Key_Escape) { text = sec.targetHex; sec.focusRequested(); root.leaveSearch(); event.accepted = true }
          else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { sec.targetHexEntered(text); root.leaveSearch(); event.accepted = true }
        }
      }
      Text {
        id: targetPick
        anchors.right: parent.right
        anchors.rightMargin: Style.space(10)
        anchors.verticalCenter: parent.verticalCenter
        textFormat: Text.PlainText
        text: "Pick from screen"
        color: root.fg
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.body * 0.9
        font.underline: true
        MouseArea {
          anchors.fill: parent
          anchors.margins: -Style.space(6)
          cursorShape: Qt.PointingHandCursor
          enabled: sec.targetLive
          onClicked: { sec.focusRequested(); sec.targetPickRequested() }
        }
      }
    }

    // custom colour: hex field, hue / saturation / brightness rails, star = favorite (u focuses the field, U toggles favorite)
    Item {
      id: customRow
      visible: sec.hasCustom
      y: (sec.hasMix ? mixRow.y : strengthRow.y) + sec.rowH + Style.space(4)
      width: sec.width
      height: 2 * sec.rowH + Style.space(4)

      Rectangle { anchors.fill: parent; radius: Style.space(6); color: root.fgA(sec.focused ? 0.1 : 0.05) }
      Item {
        id: hexRow
        width: parent.width
        height: sec.rowH
        Rectangle {
          id: swatch
          x: Style.space(10)
          anchors.verticalCenter: parent.verticalCenter
          width: Style.space(18)
          height: width
          radius: Style.space(4)
          color: "#" + sec.customHex
          border.width: sec.customActive ? 2 : 1
          border.color: root.fgA(sec.customActive ? 0.9 : 0.4)
        }
        Text {
          id: customLabel
          anchors.left: swatch.right
          anchors.leftMargin: Style.space(10)
          anchors.verticalCenter: parent.verticalCenter
          textFormat: Text.PlainText
          text: "Custom  #"
          color: root.fg
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.body
        }
        TextField {
          id: hexField
          anchors.left: customLabel.right
          anchors.right: starText.left
          anchors.rightMargin: Style.space(8)
          anchors.verticalCenter: parent.verticalCenter
          height: sec.rowH - Style.space(4)
          verticalPadding: Style.space(2)
          maximumLength: 7
          placeholderText: "rrggbb"
          foreground: root.fg
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.body
          Binding on text { when: !hexField.activeFocus; value: sec.customHex }
          Keys.onPressed: function(event) {
            if (event.key === Qt.Key_Escape) { text = sec.customHex; sec.focusRequested(); keysFocus(); event.accepted = true }
            else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { sec.customHexEntered(text); keysFocus(); event.accepted = true }
          }
          function keysFocus() { root.leaveSearch() }
        }
        Text {
          id: starText
          anchors.right: parent.right
          anchors.rightMargin: Style.space(10)
          anchors.verticalCenter: parent.verticalCenter
          textFormat: Text.PlainText
          text: sec.customFav ? "★" : "☆"
          color: root.fg
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.body * 1.2
          MouseArea {
            anchors.fill: parent
            anchors.margins: -Style.space(6)
            cursorShape: Qt.PointingHandCursor
            onClicked: { sec.focusRequested(); sec.customFavToggled() }
          }
        }
      }
      Row {
        y: sec.rowH
        width: parent.width
        height: sec.rowH
        leftPadding: Style.space(10)
        rightPadding: Style.space(10)
        spacing: Style.space(10)
        Rail {
          name: "H"
          fg: root.fg; fontFamily: root.bar.fontFamily; cellW: (customRow.width - 4 * Style.space(10)) / 3; cellH: sec.rowH
          value: sec.customH
          stops: ["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ff0000"]
          onMoved: function(v) { sec.focusRequested(); sec.customHsv(v, sec.customS, sec.customV) }
        }
        Rail {
          name: "S"
          fg: root.fg; fontFamily: root.bar.fontFamily; cellW: (customRow.width - 4 * Style.space(10)) / 3; cellH: sec.rowH
          value: sec.customS
          stops: ["#ffffff", Qt.hsva(sec.customH, 1, 1, 1)]
          onMoved: function(v) { sec.focusRequested(); sec.customHsv(sec.customH, v, sec.customV) }
        }
        Rail {
          name: "V"
          fg: root.fg; fontFamily: root.bar.fontFamily; cellW: (customRow.width - 4 * Style.space(10)) / 3; cellH: sec.rowH
          value: sec.customV
          stops: ["#000000", Qt.hsva(sec.customH, sec.customS, 1, 1)]
          onMoved: function(v) { sec.focusRequested(); sec.customHsv(sec.customH, sec.customS, v) }
        }
      }
    }

    Text {
      visible: sec.filtering && sec.cats.length === 0
      x: Style.space(10)
      y: titleText.height + Style.space(8)
      textFormat: Text.PlainText
      text: "No matches"
      opacity: 0.45
      color: root.fg
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body * 0.9
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
      blocked: searchField.activeFocus || colorSec.editing || wallSec.editing
      onTabRequested: function(dir) { root.cycleKind(dir) }
      onDeleteRequested: root.handleText("x")
      onReturnRequested: root.viaEnter = true
      onActivateRequested: {
        if (root.winPickOpen) root.pickWinApp(root.winAppItems[winSec.pickerIdx])
        else root.activeSec.activate(!root.viaEnter, root.ctrlDown)
        root.viaEnter = false
      }
      onCloseRequested: { if (root.winPickOpen) root.winPickOpen = false; else if (root.query !== "") root.clearSearch(); else root.close() }
      onTextKey: function(t) { root.handleText(t) }
      Keys.forwardTo: [shiftWatcher]
      Item {
        id: shiftWatcher
        Keys.onPressed: function(event) {
          root.ctrlDown = (event.modifiers & Qt.ControlModifier) !== 0
          if (event.key === Qt.Key_Shift) root.setMenuShift(true)
        }
        Keys.onReleased: function(event) {
          root.ctrlDown = (event.modifiers & Qt.ControlModifier) !== 0
          if (event.key === Qt.Key_Shift) root.setMenuShift(false)
        }
      }

      Column {
        id: body
        width: parent.width
        spacing: Style.space(4)

        Row {
          id: header
          width: body.width
          height: Style.space(28)
          spacing: Style.space(6)
          readonly property real cell: (width - spacing * 10 - 1) / 10

          MenuRow {
            width: header.cell
            toggle: true
            checked: !root.paused
            label: (root.paused ? root.boxOff : root.boxOn) + " 󰐥 Enabled (p)"
            onClicked: root.togglePause()
          }
          MenuRow {
            width: header.cell
            toggle: true
            checked: root.showScreen
            label: (root.showScreen ? root.boxOn : root.boxOff) + " " + root.kindIcon("screen") + " Screen (s)"
            onClicked: root.toggleSection("screen")
          }
          MenuRow {
            width: header.cell
            toggle: true
            checked: root.showColor
            label: (root.showColor ? root.boxOn : root.boxOff) + " " + root.kindIcon("color") + " Color (C)"
            onClicked: root.toggleSection("color")
          }
          MenuRow {
            width: header.cell
            toggle: true
            checked: root.showWall
            label: (root.showWall ? root.boxOn : root.boxOff) + " " + root.kindIcon("wall") + " Wallpaper (w)"
            onClicked: root.toggleSection("wall")
          }
          MenuRow {
            width: header.cell
            toggle: true
            checked: root.showMouse
            label: (root.showMouse ? root.boxOn : root.boxOff) + " " + root.kindIcon("mouse") + " Cursor (c)"
            onClicked: root.toggleSection("mouse")
          }
          MenuRow {
            width: header.cell
            toggle: true
            checked: root.showWin
            label: (root.showWin ? root.boxOn : root.boxOff) + " " + root.kindIcon("win") + " Windows (W)"
            onClicked: root.toggleSection("win")
          }
          MenuRow {
            width: header.cell
            toggle: true
            checked: root.showCombo
            label: (root.showCombo ? root.boxOn : root.boxOff) + " " + root.kindIcon("combo") + " Combos (m)"
            onClicked: root.toggleSection("combo")
          }
          MenuRow {
            width: header.cell
            toggle: true
            checked: root.includeAnimated
            dim: !root.showScreen
            label: (root.includeAnimated ? root.boxOn : root.boxOff) + " 󰙴 Animated (a)"
            onClicked: root.setAnimated()
          }
          Rectangle {
            width: 1
            height: header.height
            color: root.fgA(0.3)
          }
          MenuRow {
            width: header.cell
            label: (root.nEffectVis > 1 ? "Surprise all" : "Surprise me") + "  (R)"
            onClicked: root.randomAll()
          }
          MenuRow {
            width: header.cell
            label: (root.nEffectVis > 1 ? "Clear all" : "Clear") + "  (O)"
            onClicked: root.offAll()
          }
        }

        Row {
          id: searchRow
          width: body.width
          height: Style.space(28)
          spacing: Style.space(10)

          TextField {
            id: searchField
            width: searchRow.width - matchText.width - searchRow.spacing
            height: searchRow.height
            verticalPadding: Style.space(2)
            placeholderText: "/  filter every column"
            foreground: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
            onTextChanged: { root.query = text; root.applyQuery() }
            Keys.onPressed: function(event) {
              if (event.key === Qt.Key_Escape) { root.clearSearch(); event.accepted = true }
              else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { root.leaveSearch(); event.accepted = true }
              else if (event.key === Qt.Key_Down) { root.moveKeys(0, 1); event.accepted = true }
              else if (event.key === Qt.Key_Up) { root.moveKeys(0, -1); event.accepted = true }
              else if (event.key === Qt.Key_Tab) { root.cycleKind(1); event.accepted = true }
              else if (event.key === Qt.Key_Backtab) { root.cycleKind(-1); event.accepted = true }
            }
          }
          Text {
            id: matchText
            width: Style.space(90)
            height: searchRow.height
            verticalAlignment: Text.AlignVCenter
            horizontalAlignment: Text.AlignRight
            textFormat: Text.PlainText
            text: root.query.trim() === "" ? "" : root.matchTotal() + " found"
            opacity: 0.6
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body * 0.85
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
            icon: root.kindIcon("screen")
            rawCats: root.screenCats
            saved: root.current
            favs: root.screenFavs
            focused: root.focusKind === "screen"
            defaultCat: 1
            hasStrength: true
            strengthLive: root.shaderOn
            strength: root.fxStrength
            strengthDefault: root.defaultStrengthOf("screen", root.current)
            alsoSaved: root.screenMarks
            hasMix: true
            mixNoun: "effect"
            mixLive: root.mixSecondOf("screen") !== ""
            mixName: root.effect2
            mixMode: root.mixEffectMode
            mixValue: root.mixEffectAmt
            mixDefault: root.mixDefaultOf("screen")
            onMixPicked: function(v) { root.setMixAmount("screen", v) }
            onMixModeToggled: { root.activeKind = "screen"; root.toggleMixMode() }
            onMixChosen: function(item, keep) { root.pickSecond("screen", item, keep) }
            onStrengthPicked: function(v) { root.setStrength("effect", v) }
            onPointed: function(item) { root.previewScreen(item) }
            onChosen: function(item, keep) { root.chooseScreen(item, keep) }
            onActed: function(id) { root.runAction("screen", id) }
            onFocusRequested: root.activeKind = "screen"
          }

          Rectangle {
            visible: root.showScreen && (root.showColor || root.showWall || root.showMouse || root.showWin || root.showCombo)
            width: 1
            height: screenSec.implicitHeight
            color: root.fgA(0.2)
          }

          SectionMenu {
            id: colorSec
            visible: root.showColor
            width: Math.floor(secRow.secWidth * root.colorWeight)
            title: "Color"
            icon: root.kindIcon("color")
            rawCats: root.colorCats
            saved: root.colorCurrent
            favs: root.colorFavs
            focused: root.focusKind === "color"
            defaultCat: 1
            hasStrength: true
            strengthLive: root.colorOn
            strength: root.colStrength
            strengthDefault: root.defaultStrengthOf("color", root.colorCurrent)
            alsoSaved: root.colorMarks
            hasMix: true
            mixNoun: "colour grade"
            mixLive: root.mixSecondOf("color") !== ""
            mixName: root.color2
            mixMode: root.mixColorMode
            mixValue: root.mixColorAmt
            mixDefault: root.mixDefaultOf("color")
            onMixPicked: function(v) { root.setMixAmount("color", v) }
            onMixModeToggled: { root.activeKind = "color"; root.toggleMixMode() }
            onMixChosen: function(item, keep) { root.pickSecond("color", item, keep) }
            hasCustom: true
            customHex: root.customHex
            customH: root.customH
            customS: root.customS
            customV: root.customV
            customFav: root.customIsFav
            customActive: root.customActive
            onCustomHsv: function(h, sat, v) { root.setCustomHsv(h, sat, v) }
            onCustomHexEntered: function(t) { root.setCustomHex(t) }
            onCustomFavToggled: root.toggleCustomFav()
            onStrengthPicked: function(v) { root.setStrength("color", v) }
            onPointed: function(item) { root.previewColor(item) }
            onChosen: function(item, keep) { root.chooseColor(item, keep) }
            onActed: function(id) { root.runAction("color", id) }
            onFocusRequested: root.activeKind = "color"
          }

          Rectangle {
            visible: root.showColor && (root.showWall || root.showMouse || root.showWin || root.showCombo)
            width: 1
            height: screenSec.implicitHeight
            color: root.fgA(0.2)
          }

          SectionMenu {
            id: wallSec
            visible: root.showWall
            width: secRow.secWidth
            title: "Wallpaper"
            icon: root.kindIcon("wall")
            rawCats: root.wallCats
            saved: root.wallShown
            favs: root.wallFavs
            focused: root.focusKind === "wall"
            defaultCat: 2
            hasStrength: true
            strengthLive: root.wallOn
            strength: root.wallStrength
            strengthDefault: 100
            hasWallOpts: true
            reactValue: root.wallReact
            reactLive: root.wallOn
            rangeValue: root.wallRange
            targetHex: root.wallTarget
            targetLive: root.wallReactorOn
            onReactPicked: function(v) { root.setWallReact(v) }
            onRangePicked: function(v) { root.setWallRange(v) }
            onTargetHexEntered: function(t) { root.setWallTarget(t) }
            onTargetPickRequested: root.pickWallTarget()
            onStrengthPicked: function(v) { root.setStrength("wall", v) }
            hasMix: true
            mixNoun: "effect"
            mixLive: root.mixSecondOf("wall") !== ""
            mixName: root.mixSecondOf("wall")
            mixMode: root.wallMixMode
            mixValue: root.wallMixAmt
            mixDefault: root.mixDefaultOf("wall")
            alsoSaved: root.mixSecondOf("wall") !== "" ? [root.wall2] : []
            onMixPicked: function(v) { root.setMixAmount("wall", v) }
            onMixModeToggled: { root.activeKind = "wall"; root.toggleMixMode() }
            onMixChosen: function(item, keep) { root.pickSecond("wall", item, keep) }
            onPointed: function(item) { root.previewWall(item) }
            onChosen: function(item, keep) { root.chooseWall(item, keep) }
            onActed: function(id) { root.runAction("wall", id) }
            onFocusRequested: root.activeKind = "wall"
          }

          Rectangle {
            visible: root.showWall && (root.showMouse || root.showWin || root.showCombo)
            width: 1
            height: screenSec.implicitHeight
            color: root.fgA(0.2)
          }

          SectionMenu {
            id: mouseSec
            visible: root.showMouse
            width: secRow.secWidth
            title: "Cursor"
            icon: root.kindIcon("mouse")
            rawCats: root.mouseCats
            saved: root.mouseCurrent
            favs: root.mouseFavs
            focused: root.focusKind === "mouse"
            defaultCat: 1
            hasStrength: true
            strengthLive: root.mouseOn
            strength: root.mouseStrength
            strengthDefault: 100
            onStrengthPicked: function(v) { root.setStrength("mouse", v) }
            onPointed: function(item) { root.previewMouse(item) }
            onChosen: function(item, keep) { root.chooseMouse(item, keep) }
            onActed: function(id) { root.runAction("mouse", id) }
            onFocusRequested: root.activeKind = "mouse"
          }

          Rectangle {
            visible: root.showMouse && (root.showWin || root.showCombo)
            width: 1
            height: screenSec.implicitHeight
            color: root.fgA(0.2)
          }

          SectionMenu {
            id: winSec
            visible: root.showWin
            width: secRow.secWidth
            title: "Windows"
            icon: root.kindIcon("win")
            hasPicker: root.winPlugin !== "missing"
            pickerText: root.winScope === "*" ? "All windows" : root.winScopeLabel
            pickerItems: root.winAppItems
            pickerCurrent: "t:" + root.winScope
            pickerOpen: root.winPickOpen
            onPickerToggled: root.toggleWinPicker()
            onPickerChosen: function(item) { root.pickWinApp(item) }
            rawCats: root.winCats
            saved: root.savedOf("win")
            alsoSaved: root.winMarks
            favs: []
            focused: root.focusKind === "win"
            defaultCat: 0
            hasStrength: root.winPart !== "frame"
            strengthLabel: root.winPart === "color" ? "Color strength" : "Effect strength"
            strengthLive: root.winPart === "color" ? root.winColorOnS : root.winEffectOnS
            strength: root.winPart === "color" ? root.winColStrengthS : root.winFxStrengthS
            strengthDefault: root.winPart === "color" ? root.defaultStrengthOf("color", root.winColorS) : root.defaultStrengthOf("screen", root.winEffectS)
            onStrengthPicked: function(v) { root.setStrength(root.winPart === "color" ? "wincol" : "winfx", v) }
            hasMix: root.winPart !== "frame"
            mixNoun: root.winPart === "color" ? "color" : "effect"
            mixLive: root.mixSecondOf("win") !== ""
            mixName: root.mixSecondOf("win") === "" ? "" : (root.winPart === "color" ? "c:" : "e:") + root.mixSecondOf("win")
            mixMode: root.mixModeOf("win")
            mixValue: root.mixAmtOf("win")
            mixDefault: root.mixDefaultOf("win")
            onMixPicked: function(v) { root.setMixAmount("win", v) }
            onMixModeToggled: { root.activeKind = "win"; root.toggleMixMode() }
            onMixChosen: function(item, keep) { root.pickSecond("win", item, keep) }
            onPointed: function(item) { root.previewWin(item) }
            onChosen: function(item, keep) { root.chooseWin(item, keep) }
            onActed: function(id) { root.runAction("win", id) }
            onFocusRequested: root.activeKind = "win"
          }

          Rectangle {
            visible: root.showWin && root.showCombo
            width: 1
            height: screenSec.implicitHeight
            color: root.fgA(0.2)
          }

          SectionMenu {
            id: comboSec
            visible: root.showCombo
            width: Math.floor(secRow.secWidth * root.comboWeight)
            title: "Combos"
            icon: root.kindIcon("combo")
            rawCats: root.comboCats
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

        Row {
          id: activeRow
          width: body.width
          spacing: Style.space(6)

          Flow {
            id: activeFlow
            width: activeRow.width - reportBtn.width - activeRow.spacing
            spacing: Style.space(4)
            leftPadding: Style.space(10)

            Text {
              height: Style.space(24)
              verticalAlignment: Text.AlignVCenter
              textFormat: Text.PlainText
              visible: root.paused
              text: "PAUSED (p to resume) ·"
              color: root.fg
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body
            }
            Text {
              height: Style.space(24)
              verticalAlignment: Text.AlignVCenter
              text: root.activeNow.length > 0 ? "Active now (" + root.activeNow.length + "), click to remove:" : "Active now: nothing"
              color: root.fg
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body
            }
            Repeater {
              model: root.activeNow
              delegate: Rectangle {
                id: chip
                required property var modelData
                width: chipText.implicitWidth + Style.space(20)
                height: Style.space(24)
                radius: Style.space(12)
                color: chipMouse.containsMouse ? root.fgA(0.22) : root.fgA(0.09)
                Text {
                  id: chipText
                  anchors.centerIn: parent
                  textFormat: Text.PlainText
                  text: chip.modelData.text + "  ✕"
                  color: root.fg
                  font.family: root.bar.fontFamily
                  font.pixelSize: Style.font.body
                }
                MouseArea {
                  id: chipMouse
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.removeActive(chip.modelData.key)
                }
              }
            }
          }
          MenuRow {
            id: reportBtn
            width: header.cell * 1.6
            label: "Cost report  (P)"
            onClicked: root.costReport()
          }
        }

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
            return "Move to an item for details"
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
          text: "/ filter · hjkl move · ⏎ apply · space try · tab menu · [ ] strength ({ } fine, d default) · Ctrl+⏎ mix a second (t stack/blend, , . amount, ⌫ remove) · p pause · u custom colour (U to favorite it) · f fav · F save combo · r/R surprise · o/O off · P cost report · s C w c W m menus · A pick the app (Windows) · esc clears filter, then undoes"
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
