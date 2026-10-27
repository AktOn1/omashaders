import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Hyprland
import Quickshell.Wayland
import qs.Commons
import qs.Ui
import "palette.js" as Pal

// One bar icon, five effect menus (tick any of them at the top, ticked menus sit side by side):
//   Screen    full-screen GLSL effects applied by Hyprland (bin/omashaders)
//   Color     a colour grade on top of the screen effect (merged into one shader by bin/compose-shader)
//   Wallpaper animated GPU effects drawn over the wallpaper (WallpaperFx.qml) plus wallpaper picking
//   Cursor    small overlay effects drawn around the mouse pointer (MouseFx.qml), and Bend shaders that
//             distort the real screen around it (bin/cursor-bend + BendMarker.qml)
//   Windows   the Screen and Color lists drawn on chosen app windows only (needs the HyprWindowShade Hyprland plugin; bin/omashaders window)
// hjkl / arrows move, hovering highlights an effect and previews it only while Shift is held (releasing Shift or leaving the item restores the saved setting) (keys preview as you move), a mouse click, Space or Enter keeps it and stays open (Esc / q close),
// Esc undoes previews.
Item {
  id: root
  // loaded by BarWidget.qml (the host), which reloads this file when it changes; the host plays the role of the bar widget
  required property var host
  required property string ver
  anchors.fill: parent
  readonly property var bar: host.bar
  readonly property string moduleName: host.moduleName
  readonly property var settings: host.settings
  function setting(name, fallback) { return host.setting(name, fallback) }
  function sub(file) { return Qt.resolvedUrl(file) + "?v=" + ver }
  // sibling files are loaded by versioned url so a reload sees their new code (Qt caches types by url)
  component FxHost: Loader {
    property var props: ({})
    function apply() { if (item) for (var k in props) item[k] = props[k] }
    onPropsChanged: apply()
    onLoaded: apply()
  }

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
  readonly property string themeFile: stateDir + "/themes"
  readonly property string sectionsFile: stateDir + "/sections"
  readonly property string shiftOnlyFile: stateDir + "/shift-only"
  readonly property string keyHintsFile: stateDir + "/hotkey-hints"
  readonly property string keyPreviewFile: stateDir + "/key-preview"
  readonly property string resourcesFile: stateDir + "/resources"
  readonly property string lastViewFile: stateDir + "/last-view"
  readonly property string disabledFile: stateDir + "/disabled"
  readonly property string fsPauseFile: stateDir + "/pause-fullscreen"
  readonly property string mouseSizeFile: stateDir + "/mouse-size"
  readonly property string mouseSpeedFile: stateDir + "/mouse-speed"
  readonly property string audioScript: path("bin/audio-level")
  readonly property string fsWatchScript: path("bin/fullscreen-watch")
  readonly property string fxStrengthFile: stateDir + "/strength-effect"
  readonly property string colStrengthFile: stateDir + "/strength-color"
  readonly property string wallStrengthFile: stateDir + "/strength-wall"
  readonly property string mouseStrengthFile: stateDir + "/strength-mouse"
  readonly property string wallReactFile: stateDir + "/react-wall"
  readonly property string wallRangeFile: stateDir + "/wall-range"
  readonly property string wallSpeedFile: stateDir + "/wall-speed"
  readonly property string wallZoomFile: stateDir + "/wall-zoom"
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

  // popup text sits on Color.popups.background; bar.barForeground flips dark over a bright wallpaper (transparent bar) and made the menu unreadable
  readonly property color fg: Color.popups.text
  function fgA(a) { return Qt.rgba(fg.r, fg.g, fg.b, a) }
  function bgA(a) { var b = Color.popups.background; return Qt.rgba(b.r, b.g, b.b, a) }
  function accA(a) { return Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, a) }
  function kindHue(k) { return k === "screen" ? Qt.rgba(0.35, 0.60, 1.0, 1) : (k === "color" ? Qt.rgba(1.0, 0.55, 0.30, 1) : (k === "wall" ? Qt.rgba(0.35, 0.80, 0.55, 1) : (k === "mouse" ? Qt.rgba(0.75, 0.50, 1.0, 1) : Qt.rgba(0.95, 0.80, 0.30, 1)))) }
  function prettyId(id) { var t = String(id).replace(/[-_]+/g, " "); return t.charAt(0).toUpperCase() + t.slice(1) }
  readonly property string boxOn: "󰄲"
  readonly property string boxOff: "󰄱"
  readonly property string checkGlyph: "󰄬"
  readonly property string barGlyph: "󰍹"
  readonly property string favGlyph: "󰓎"
  // the left list of each menu (SectionMenu): commands pinned first, a filter shows its matches directly. Kept in this file on purpose: Qt caches the
  // folder listing, so a new .js file next to Core.qml cannot be loaded by a shell that was started before the update. bin/menulist_selftest.py tests this block.
  // menulist:begin
  readonly property string menuAllId: "@all"

  function menuIsCommand(c) { return !!c && c.action === true }

  function menuWords(query) {
    var q = String(query || "").trim().toLowerCase()
    return q === "" ? [] : q.split(/\s+/)
  }

  function menuItemMatches(it, catLabel, ts) {
    var hay = (it.label + " " + (it.desc || "") + " " + (it.hint || "") + " " + catLabel).toLowerCase()
    return ts.every(function(t) { return hay.indexOf(t) >= 0 })
  }

  // returns { cats, nCmd, total, allIdx, catOf }
  //   cats: commands, then (filtering) the "All matches" row and the matching categories, or (not filtering) the categories as declared
  //   nCmd: how many rows at the start of cats are commands
  //   total: how many different items match (0 when not filtering)
  //   allIdx: index of the "All matches" row in cats, -1 when there is none
  //   catOf: item id -> label of the first category it was found in (for the label shown on a flat result row)
  function menuBuild(rawCats, query) {
    var cmds = [], groups = []
    rawCats.forEach(function(c) { (menuIsCommand(c) ? cmds : groups).push(c) })
    var ts = menuWords(query)
    if (ts.length === 0) return { cats: cmds.concat(groups), nCmd: cmds.length, total: 0, allIdx: -1, catOf: {} }
    var perCat = [], flat = [], seen = {}, catOf = {}
    groups.forEach(function(c) {
      if (c.id === "fav" || !c.items) return
      var catText = String(c.label).toLowerCase()
      var items = c.items.filter(function(it) { return it.id.charAt(0) !== "@" && menuItemMatches(it, catText, ts) })
      if (items.length === 0) return
      perCat.push({ id: c.id, label: c.label, items: items, note: "", badge: String(items.length) })
      items.forEach(function(it) {
        if (seen[it.id]) return
        seen[it.id] = true
        catOf[it.id] = c.label
        flat.push(it)
      })
    })
    if (flat.length === 0) return { cats: cmds, nCmd: cmds.length, total: 0, allIdx: -1, catOf: {} }
    var all = { id: menuAllId, label: "All matches", items: flat, note: "", badge: String(flat.length) }
    return { cats: cmds.concat([all], perCat), nCmd: cmds.length, total: flat.length, allIdx: cmds.length, catOf: catOf }
  }
  // menulist:end
  function rowGlyph(id) {
    if (id === "fav") return favGlyph
    if (id === "@random" || id === "surprise" || String(id).indexOf("@rand:") === 0) return "󰒟"
    if (id === "@off" || String(id).indexOf("@clear:") === 0) return "󰐥"
    if (id === "themes") return "󰏘"
    if (id === "@share") return "󰒗"
    if (id === "@import") return "󰋺"
    if (id === "@ai") return "󰁨"
    if (id === "@edit") return "󰏫"
    if (id === "@dup") return "󰆏"
    if (id === "@newcat") return "󰉗"
    if (id === "@move") return "󰉒"
    if (String(id).indexOf("cat:") === 0) return "󰉋"
    if (id === "@saveas") return "󰆓"
    if (id === "@revert" || id === "@undo") return "󰕌"
    if (String(id).indexOf("@ai:") === 0) return "󰁨"
    return ""
  }

  // a row in the left list (next to Delete / Surprise me): starts the AI for just one new effect of that kind (slot as in `ai-theme --only`)
  function aiAction(slot) { return { id: "@ai:" + slot, label: "Create with AI", key: "T", action: true } }
  function writeFile(file, content) {
    Quickshell.execDetached(["bash", "-c", 'mkdir -p "$(dirname "$1")" && printf %s "$2" > "$1"', "bash", file, content])
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

  // ---------------------------------------------------------------- which menus are shown
  // Themes are always on the left; the other parts open to its right when the user picks them
  property bool showScreen: false
  property bool showColor: false
  property bool showWall: false
  property bool showMouse: false
  property bool showTheme: true
  property bool showWin: false
  property string activeKind: "theme"
  function isShown(k) { return k === "screen" ? showScreen : (k === "color" ? showColor : (k === "wall" ? showWall : (k === "mouse" ? showMouse : (k === "win" ? showWin : true)))) }
  function secOf(k) { return k === "screen" ? screenSec : (k === "color" ? colorSec : (k === "wall" ? wallSec : (k === "mouse" ? mouseSec : (k === "win" ? winSec : themeSec)))) }
  function kindIcon(k) { return k === "screen" ? "󰍹" : (k === "color" ? "󰏘" : (k === "wall" ? "󰋩" : (k === "mouse" ? "󰍽" : (k === "win" ? "󰖲" : "󰽗")))) }
  function kindTitle(k) { return k === "screen" ? "Screen" : (k === "color" ? "Color" : (k === "wall" ? "Wallpaper" : (k === "mouse" ? "Cursor" : (k === "win" ? "Windows" : "Themes")))) }
  function kindKey(k) { return k === "screen" ? "s" : (k === "color" ? "C" : (k === "wall" ? "w" : (k === "mouse" ? "c" : (k === "win" ? "W" : "")))) }
  function kindAbout(k) {
    return k === "screen" ? "The whole display gets an effect on top: old CRT look, glow, glitch, blur"
         : (k === "color" ? "Changes the colours of everything you see: warm, cold, black-and-white, neon"
         : (k === "wall" ? "The desktop background behind your windows, animated, can follow your mouse"
         : (k === "mouse" ? "The mouse pointer: it leaves a trail, sparks or a glow"
         : (k === "win" ? "Effects on single app windows (a terminal, a browser) instead of the whole screen" : "Complete looks"))))
  }
  readonly property var partKinds: ["screen", "color", "wall", "mouse", "win"]
  readonly property string partWord: "Effects"
  // Themes first, then the parts the user has opened
  readonly property var openParts: partKinds.filter(function(x) { return isShown(x) })
  readonly property var visibleKinds: ["theme"].concat(openParts)
  readonly property int nVis: visibleKinds.length
  readonly property int nOpen: openParts.length
  // the keys and the Surprise menu act on these four (Windows has its own per-app logic)
  readonly property var effectKinds: ["screen", "color", "wall", "mouse"]
  readonly property real themeWeight: 1.55
  // the parts pane has one fixed width; open parts stack inside it and scroll
  readonly property real partsUnits: 1.7
  readonly property real widthUnits: themeWeight + partsUnits
  readonly property string focusKind: visibleKinds.indexOf(activeKind) >= 0 ? activeKind : "theme"
  readonly property var activeSec: secOf(focusKind)

  // one part is open at a time; if several are asked for, the first in this order wins
  function setShown(s, w, m, persist, c, k, x) {
    if (k === undefined) k = showColor
    if (x === undefined) x = showWin
    var want = { screen: s, color: k, wall: w, mouse: m, win: x }
    var one = partKinds.filter(function(n) { return want[n] })[0] || ""
    showScreen = one === "screen"
    showColor = one === "color"
    showWall = one === "wall"
    showMouse = one === "mouse"
    showWin = one === "win"
    if (persist) writeFile(sectionsFile, [one, "theme"].filter(function(n) { return n !== "" }).join(" "))
  }
  function openOnly(kind, persist) {
    setShown(kind === "screen", kind === "wall", kind === "mouse", persist, true, kind === "color", kind === "win")
  }
  function toggleSection(kind) {
    if (kind === "theme") return
    var on = !isShown(kind)
    openOnly(on ? kind : "", true)
    activeKind = on ? kind : "theme"
  }
  function setSections(mode) {
    var w = String(mode).toLowerCase().split(/[\s,+]+/)
    var all = w.indexOf("all") >= 0
    var both = all || w.indexOf("both") >= 0
    setShown(both || w.indexOf("screen") >= 0, both || w.indexOf("wall") >= 0 || w.indexOf("wallpaper") >= 0,
             all || w.indexOf("mouse") >= 0 || w.indexOf("cursor") >= 0, true, true,
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
      root.setShown(t.indexOf("screen") >= 0, t.indexOf("wall") >= 0, t.indexOf("mouse") >= 0, false, true, t.indexOf("color") >= 0, t.indexOf("win") >= 0)
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
    if (section === "color" && Pal.isId(name)) return 100
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
    property var keys: []
    readonly property string capsShown: rlKeys.visible && rlKeys.width > 0 ? rl.keys.join("") : "-"
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
    KeyCaps {
      id: rlKeys
      anchors.left: rlName.right
      anchors.leftMargin: Style.space(5)
      anchors.verticalCenter: parent.verticalCenter
      small: true
      spacing: Style.space(3)
      groups: rl.keys.length > 0 ? [rl.keys] : []
    }
    Rectangle {
      id: rlBar
      anchors.left: rlKeys.visible ? rlKeys.right : rlName.right
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
  // Wallpaper effect speed (0-300 %, 100 = as designed) and zoom (25-300 %, 100 = as designed)
  property int wallSpeed: 100
  property int wallZoom: 100
  property int pendingWallSpeed: -1
  property int pendingWallZoom: -1
  Timer { id: wallSpeedTimer; interval: 80; onTriggered: { root.writeFile(root.wallSpeedFile, String(root.wallSpeed)); root.pendingWallSpeed = -1 } }
  Timer { id: wallZoomTimer; interval: 80; onTriggered: { root.writeFile(root.wallZoomFile, String(root.wallZoom)); root.pendingWallZoom = -1 } }
  function setWallSpeed(v) { v = clamp(Math.round(v), 0, 300); wallSpeed = v; pendingWallSpeed = v; wallSpeedTimer.restart() }
  function setWallZoom(v) { v = clamp(Math.round(v), 25, 300); wallZoom = v; pendingWallZoom = v; wallZoomTimer.restart() }
  // Cursor overlay size (25-300 %, 100 = as designed) and animation speed (0-300 %); bend effects ignore both
  property int mouseSize: 100
  property int mouseSpeed: 100
  property int pendingMouseSize: -1
  property int pendingMouseSpeed: -1
  Timer { id: mouseSizeTimer; interval: 80; onTriggered: { root.writeFile(root.mouseSizeFile, String(root.mouseSize)); root.pendingMouseSize = -1 } }
  Timer { id: mouseSpeedTimer; interval: 80; onTriggered: { root.writeFile(root.mouseSpeedFile, String(root.mouseSpeed)); root.pendingMouseSpeed = -1 } }
  function setMouseSize(v) { v = clamp(Math.round(v), 25, 300); mouseSize = v; pendingMouseSize = v; mouseSizeTimer.restart() }
  function setMouseSpeed(v) { v = clamp(Math.round(v), 0, 300); mouseSpeed = v; pendingMouseSpeed = v; mouseSpeedTimer.restart() }
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
    if (focusKind === "theme") return
    var kind = strengthKind(focusKind)
    if (!strengthLiveOf(kind)) return
    setStrength(kind, strengthOf(kind) + delta)
  }
  function resetStrength() {
    if (focusKind === "theme") return
    var kind = strengthKind(focusKind)
    if (!strengthLiveOf(kind)) return
    if (kind === "wall" || kind === "mouse") setStrength(kind, 100)
    else if (kind === "winfx" || kind === "wincol") winRunS(["strength", kind === "winfx" ? "effect" : "color", "reset"])
    else Quickshell.execDetached([root.script, "strength", kind, "reset"])
  }
  function setPower(mode) { Quickshell.execDetached([root.script, "power", mode]) }
  // F1 shows / hides every hotkey hint (slider caps and the strip under the menus); remembered in a state file, on until the user turns it off
  property string keyHintsFlag: ""
  readonly property bool keyHints: keyHintsFlag !== "off"
  function toggleKeyHints() {
    keyHintsFlag = keyHints ? "off" : "on"
    writeFile(keyHintsFile, keyHintsFlag)
  }
  FileView {
    path: root.keyHintsFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.keyHintsFlag = String(text() || "").trim()
    onLoadFailed: root.keyHintsFlag = ""
  }
  // F3 shows / hides the "What is using my GPU" block; remembered in a state file, shown until the user turns it off. Hidden, the lists get its room and the GPU poll stops.
  property string resFlag: ""
  readonly property bool resShown: resFlag !== "off"
  function toggleResources() {
    resFlag = resShown ? "off" : "on"
    writeFile(resourcesFile, resFlag)
  }
  FileView {
    path: root.resourcesFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.resFlag = String(text() || "").trim()
    onLoadFailed: root.resFlag = ""
  }
  // F2: live preview while moving with the keyboard. Off by default: the cursor only moves, Space / Enter apply. Shift+arrow previews one step either way.
  property string keyPreviewFlag: ""
  readonly property bool keyPreview: keyPreviewFlag === "on"
  function toggleKeyPreview() {
    keyPreviewFlag = keyPreview ? "off" : "on"
    writeFile(keyPreviewFile, keyPreviewFlag)
    if (!keyPreview) { hoverPreviewing = true; revertHoverPreview() }
  }
  FileView {
    path: root.keyPreviewFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.keyPreviewFlag = String(text() || "").trim()
    onLoadFailed: root.keyPreviewFlag = ""
  }
  // a keyboard move only moves the cursor; the item under it is previewed when F2 is on or Shift is held
  function keyPointed(sec) {
    if (keyPreview) { hoverPreviewing = false; sec.pointed(sec.selected) }
    else if (keyShift) { hoverPreviewing = true; sec.pointed(sec.selected) }
  }
  function togglePause() { setPower("toggle") }
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
    path: root.wallSpeedFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: { var v = parseInt(String(text() || "").trim()); if (root.pendingWallSpeed < 0) root.wallSpeed = isNaN(v) ? 100 : root.clamp(v, 0, 300) }
    onLoadFailed: root.wallSpeed = 100
  }
  FileView {
    path: root.wallZoomFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: { var v = parseInt(String(text() || "").trim()); if (root.pendingWallZoom < 0) root.wallZoom = isNaN(v) ? 100 : root.clamp(v, 25, 300) }
    onLoadFailed: root.wallZoom = 100
  }
  FileView {
    path: root.mouseSizeFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: { var v = parseInt(String(text() || "").trim()); if (root.pendingMouseSize < 0) root.mouseSize = isNaN(v) ? 100 : root.clamp(v, 25, 300) }
    onLoadFailed: root.mouseSize = 100
  }
  FileView {
    path: root.mouseSpeedFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: { var v = parseInt(String(text() || "").trim()); if (root.pendingMouseSpeed < 0) root.mouseSpeed = isNaN(v) ? 100 : root.clamp(v, 0, 300) }
    onLoadFailed: root.mouseSpeed = 100
  }
  FileView {
    path: root.fsPauseFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.fsPauseOn = String(text() || "").trim() !== ""
    onLoadFailed: root.fsPauseOn = false
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
  // ---------------------------------------------------------------- mixing two effects of the same menu (a / Ctrl+click)
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
  function mixSelected() {
    var s = activeSec
    if (!s.hasMix || s.col !== 1 || !s.selected) return
    s.mixChosen(s.selected, true)
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
  // animated screen effects are always listed; the GPU strip shows what they cost
  readonly property bool shaderOn: current !== ""
  property var screenFavs: []
  property string screenOrigin: ""
  property bool screenPreviewed: false
  property string screenPending: ""

  readonly property var screenEntries: allEntries.filter(function(e) { return e.section === "screen" })
  function screenItem(e) { return { id: e.name, label: e.name, desc: e.desc, hint: e.animated ? "heavy" : "" } }
  readonly property var screenItems: screenEntries.map(screenItem)
  readonly property var screenCats: {
    var out = [{ id: "fav", label: "Favorites", items: favList(screenItems, screenFavs), note: favNote }]
    catList(screenEntries, ["Lens", "Retro", "Devices", "Art", "Mood", "Ambient", "Motion"]).forEach(function(c) {
      out.push({ id: c, label: c,
                 items: screenEntries.filter(function(e) { return e.cat === c }).map(screenItem),
                 note: "" })
    })
    out.push(aiAction("screen"))
    out.push({ id: "@delete", label: "Delete selected  (Del)", key: "Del", action: true })
    out.push({ id: "@random", label: "Surprise me", key: "r", action: true })
    out.push({ id: "@off", label: "Off", key: "o", action: true })
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
  function screenStep(verb) {
    var cmd = [root.script, verb]
    if (verb === "next" || verb === "prev") cmd.push("-a")
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
          if (p[0]) out.push({ name: p[0], animated: p[1] === "animated", motion: p[1] === "motion", bend: p[5] === "bend", cat: p[2] || "Other", desc: p[3] || "", section: p[4] || "screen", dflt: (p[5] !== undefined && p[5] !== "" && !isNaN(Number(p[5]))) ? Number(p[5]) : 100, group: p[6] || "" })
        })
        var first = root.allEntries.length !== out.length
        root.allEntries = out
        if (first && root.popupOpen) { screenSec.sync(); colorSec.sync(); mouseSec.sync() }
        if (root.afterList) { var f = root.afterList; root.afterList = null; f() }
      }
    }
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
      if (event.name === "configreloaded") pauseBindTimer.restart()
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
  // a custom colour is the generated grade "custom-RRGGBB" (bin/compose-shader --custom), so it works with strength, favorites and themes like any other
  readonly property var customRe: /^custom-[0-9a-f]{6}$/
  function colorFavItems() {
    var out = []
    colorFavs.forEach(function(id) {
      if (customRe.test(id)) { out.push({ id: id, label: "Custom #" + id.slice(7), desc: "Your own colour", hint: "" }); return }
      if (Pal.isId(id)) { out.push({ id: id, label: Pal.label(id), desc: "Your own palette", hint: "" }); return }
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
  // keyboard nudge of the custom colour on the Color tab (no click needed; with the custom colour off, the first key starts it from the colour shown on the rails): which 0 = hue (wraps round), 1 = saturation, 2 = brightness; dir -1 / +1
  function nudgeCustom(which, dir) {
    if (focusKind !== "color") return
    var wasOff = !(customActive || customTimer.running)
    var h = customH, sat = customS, v = customV
    if (which === 0) h = (Math.round((h + dir * 0.025) * 1000) / 1000 + 1) % 1
    else if (which === 1) sat = Math.round((sat + dir * 0.05) * 1000) / 1000
    else v = Math.round((v + dir * 0.05) * 1000) / 1000
    setCustomHsv(h, sat, v)
    if (wasOff) { applyCustom(); flash("Custom colour on: #" + customHex) }
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
    out.push({ id: "@palette", label: "Palette…  (make your own)", action: true })
    out.push(aiAction("color"))
    out.push({ id: "@delete", label: "Delete selected  (Del)", key: "Del", action: true })
    out.push({ id: "@random", label: "Surprise me", key: "r", action: true })
    out.push({ id: "@off", label: "Off", key: "o", action: true })
    return out
  }

  // the Palette editor (PaletteDialog.qml) is loaded the first time it opens
  property bool palOpen: false
  property bool palLoaded: false
  function openPalette() {
    popupOpen = false
    closeWallhavenKeeping()
    rememberView("palette")
    palLoaded = true
    Qt.callLater(function() { root.palOpen = true })
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
  // which part of a window the open list edits; the flat "All matches" list mixes parts, so it follows the row (ids start e: / c: / f:)
  readonly property string winPart: {
    var c = winSec.curCat
    var id = c ? String(c.id) : ""
    if (id === root.menuAllId && winSec.selected) id = String(winSec.selected.id)
    return id.indexOf("f:") === 0 ? "frame" : (id.indexOf("c:") === 0 ? "color" : "effect")
  }
  readonly property string installCmd: "hyprpm update && hyprpm add https://github.com/ManofJELLO/HyprWindowShade && hyprpm enable HyprWindowShade"

  function winFxItem(e) { return { id: "e:" + e.name, label: e.name, desc: e.desc, hint: e.section === "winfx" ? "window" : (e.animated ? "heavy" : "") } }
  function winColItem(e) { return { id: "c:" + e.name, label: e.name, desc: e.desc, hint: "" } }
  readonly property var winfxEntries: allEntries.filter(function(e) { return e.section === "winfx" })
  readonly property var winEffectItems: winfxEntries.concat(screenEntries).map(winFxItem)
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
    ].concat(winFrameCats).concat([{ id: "@off", label: "Off", key: "o", action: true }])
    var out = []
    catList(winfxEntries, ["Glass", "Light", "Living"]).forEach(function(c) {
      var items = winfxEntries.filter(function(e) { return e.cat === c }).map(winFxItem)
      if (items.length > 0) out.push({ id: "e:" + c, label: c, items: items, note: "Made for windows: they react to focus, the pointer and each window's own size." })
    })
    catList(screenEntries, ["Lens", "Retro", "Devices", "Art", "Mood", "Ambient", "Motion"]).forEach(function(c) {
      var items = screenEntries.filter(function(e) { return e.cat === c }).map(winFxItem)
      if (items.length > 0) out.push({ id: "e:" + c, label: c, items: items, note: "" })
    })
    catList(colorEntries, ["Comfort", "Color", "Retro", "Devices"]).forEach(function(c) {
      out.push({ id: "c:" + c, label: "Color · " + c, items: colorEntries.filter(function(e) { return e.cat === c }).map(winColItem), note: "" })
    })
    if (winScope === "*") winFrameCats.forEach(function(c) { out.push(c) })
    else out.push({ id: "@inherit", label: "Follow All windows", action: true })
    out.push(aiAction("win"))
    out.push({ id: "@delete", label: "Delete selected  (Del)", key: "Del", action: true })
    out.push({ id: "@random", label: "Surprise me", key: "r", action: true })
    out.push({ id: "@off", label: "Off", key: "o", action: true })
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
    out.push(aiAction("cursor"))
    out.push({ id: "@delete", label: "Delete selected  (Del)", key: "Del", action: true })
    out.push({ id: "@random", label: "Surprise me", key: "r", action: true })
    out.push({ id: "@off", label: "Off", key: "o", action: true })
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
      { id: "@wallhaven", label: "Wallhaven…", hint: "search and download" },
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
      { id: "plankton", label: "Plankton",        hint: "glows near the mouse" },
      { id: "neonrain", label: "Neon rain",       hint: "night rain, pointer is an umbrella" },
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
      { id: "rainhd",    label: "Digital rain HD", hint: "sharp glyphs, mouse lights it" },
      { id: "rainwall",  label: "Digital rain, wallpaper colours", hint: "glyphs take the picture colours" },
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
  // wallpaper effect files the list above does not know (added later) show up without a shell restart:
  // a "// category: NAME" header puts the effect in the group of that name (an existing group above, or a new one), no header = "More"
  readonly property var wallAll: {
    var known = {}
    for (var i = 1; i < wallBase.length; i++) wallBase[i].items.forEach(function(it) { known[it.id] = true })
    var groups = [], byKey = {}
    function groupFor(label) {
      var key = label.toLowerCase()
      if (byKey[key] === undefined) { byKey[key] = groups.length; groups.push({ id: "wallcat:" + key, label: label, items: [] }) }
      return groups[byKey[key]]
    }
    var have = {}, loaded = allEntries.length > 0
    allEntries.forEach(function(e) { if (e.section === "wall") have[e.name] = true })
    // an effect the developer deleted (or a file that is missing) leaves the list; before the first listing everything shows
    var out = wallBase.map(function(g, gi) { return { id: g.id, label: g.label, items: g.items.filter(function(it) { return gi === 0 || !loaded || have[it.id] === true }) } })
    var extraByLabel = {}
    for (var j = 1; j < out.length; j++) { extraByLabel[out[j].label.toLowerCase()] = out[j]; extraByLabel[out[j].id.toLowerCase()] = out[j] }
    var more = []
    allEntries.forEach(function(e) {
      if (e.section !== "wall" || known[e.name]) return
      var it = { id: e.name, label: e.cat, hint: e.desc }
      if (e.group === "") more.push(it)
      else if (extraByLabel[e.group.toLowerCase()]) extraByLabel[e.group.toLowerCase()].items.push(it)
      else groupFor(e.group).items.push(it)
    })
    out[0] = wallBase[0]
    groups.forEach(function(g) { out.push(g) })
    if (more.length > 0) out.push({ id: "more", label: "More", items: more })
    return out
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
    out.push(aiAction("wallpaper"))
    out.push({ id: "@delete", label: "Delete selected  (Del)", key: "Del", action: true })
    out.push({ id: "@random", label: "Surprise me", key: "r", action: true })
    out.push({ id: "@off", label: "Off", key: "o", action: true })
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
    else if (it.id === "@wallhaven") openWallhaven()
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
  // Which picker (Create with AI, Wallhaven, Palette, share / import) was open when the menu was closed without leaving it: the next open goes back there.
  // The choice is kept in the state file `last-view`; leaving a picker the normal way (Esc, Back, Done, finishing) clears it, so the main menu is never out of reach.
  property string lastView: ""
  property bool keepView: false
  readonly property bool viewOpen: dlgOpen || whOpen || palOpen
  function rememberView(v) {
    if (v === lastView) return
    lastView = v
    writeFile(lastViewFile, v)
  }
  function forgetView() { rememberView("") }
  function closeWallhavenKeeping() {
    keepView = true
    whOpen = false
    keepView = false
  }
  // keep = the menu was dismissed (icon, click away, another popout): the picker stays remembered; otherwise the user left it
  function hideViews(keep) {
    keepView = keep
    dlgOpen = false
    whOpen = false
    palOpen = false
    keepView = false
  }
  function restoreView() {
    var p = lastView.split("|")
    if (p[0] === "wallhaven") openWallhaven()
    else if (p[0] === "palette") openPalette()
    else if (p[0] === "dialog" && ["ai", "share", "import"].indexOf(p[1]) >= 0) openDialog(p[1], "", Math.floor(Number(p[2])) || 0, p[3] || "", p[4] || "")
    else { forgetView(); return false }
    return true
  }
  onDlgOpenChanged: if (!dlgOpen && !keepView) forgetView()
  onWhOpenChanged: if (!whOpen && !keepView) forgetView()
  onPalOpenChanged: if (!palOpen && !keepView) forgetView()
  FileView {
    path: root.lastViewFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.lastView = String(text() || "").trim()
    onLoadFailed: root.lastView = ""
  }
  // the Wallhaven browser (Wallhaven.qml) is loaded the first time it opens
  property bool whOpen: false
  property bool whLoaded: false
  property bool aiAvailable: false
  function openWallhaven() {
    popupOpen = false
    rememberView("wallhaven")
    whLoaded = true
    Qt.callLater(function() { root.whOpen = true })
  }
  function wallhavenUsed(id) {
    wallStatus = "Wallhaven " + id
    resolver.running = true
  }
  function aiThemeFromWallhaven(id) { openDialog("ai", id, 0) }

  // the theme's own Wallhaven picture: the capsule above the Wallpaper tab. Nothing is downloaded until the button (or H) is pressed.
  readonly property string currentWhId: {
    var m = /\/wallhaven-([a-z0-9]{6})\.[A-Za-z]+$/.exec(wallpaperPath)
    return m ? m[1] : ""
  }
  // the theme under the cursor while the Themes list has the focus, else the theme the look came from
  readonly property string capLine: {
    var it = focusKind === "theme" && themeSec.selected && String(themeSec.selected.id).charAt(0) !== "@" ? themeSec.selected : null
    return it ? String(it.id) : originLine
  }
  readonly property string capWh: lineWh(capLine)
  property var capCached: ({})
  property string capErr: ""
  property string capErrId: ""
  readonly property var capState: wallCapState(capWh, capCached[capWh] === true, currentWhId, capUseProc.running && capUseProc.id === capWh, capErrId === capWh ? capErr : "", capLine !== "")
  readonly property string capHint: capState.kind === "set" ? "set theme wallpaper" : capState.kind === "error" ? "retry theme wallpaper" : capState.kind === "current" ? "theme wallpaper (set)"
                                    : capState.kind === "remember" ? "remember Wallhaven " + currentWhId : capState.kind === "unsaved" ? "save look keeps Wallhaven " + currentWhId : "download theme wallpaper"
  readonly property string autoHint: useThemeWallpaper ? "theme wallpapers: on" : "theme wallpapers: off"
  readonly property bool capHasKey: capState.kind !== "none" && capState.kind !== "unsaved"
  onCapWhChanged: capCheck()
  function capCheck() {
    if (capWh === "" || !popupOpen || capCached[capWh] === true) return
    if (capCheckProc.running) { capCheckProc.again = true; return }
    capCheckProc.id = capWh
    capCheckProc.command = ["python3", path("bin/wallhaven"), "cached", capWh]
    capCheckProc.running = true
  }
  function capMark(id, on) {
    var m = {}
    Object.keys(capCached).forEach(function(k) { m[k] = capCached[k] })
    m[id] = on
    capCached = m
  }
  Process {
    id: capCheckProc
    property string id: ""
    property bool again: false
    onExited: function(code) {
      root.capMark(id, code === 0)
      if (again) { again = false; root.capCheck() }
    }
  }
  Process {
    id: capUseProc
    property string id: ""
    stderr: StdioCollector { id: capUseErr; waitForEnd: true }
    onExited: function(code) {
      if (code === 0) {
        root.capErrId = ""
        root.capMark(id, true)
        root.wallhavenUsed(id)
        root.flash("Wallpaper set: Wallhaven " + id)
      } else {
        var e = String(capUseErr.text).trim().split("\n").pop().replace(/^wallhaven: /, "").replace(/ \(curl.*$/, "")
        root.capErr = e !== "" ? e : "no answer"
        root.capErrId = id
        root.flash("Wallpaper not set: " + root.capErr, 5000)
      }
      if (root.capNext !== "") { var n = root.capNext; root.capNext = ""; if (n !== id) root.capFetch(n) }
    }
  }
  function capAct() {
    if (capState.kind === "remember") { rememberWallhaven(); return }
    if (capState.kind === "unsaved") { flash("Press F to save the look as a theme: it keeps Wallhaven " + currentWhId); return }
    if (capWh === "") { flash("No Wallhaven picture saved for this theme"); return }
    if (capState.kind === "current") { flash("Wallpaper is already set: Wallhaven " + capWh); return }
    if (capUseProc.running) { flash("Still fetching Wallhaven " + capUseProc.id); return }
    capFetch(capWh)
  }
  function capFetch(id) {
    capErrId = ""
    capUseProc.id = id
    capUseProc.command = ["python3", path("bin/wallhaven"), "use", id]
    capUseProc.running = true
  }
  readonly property bool useThemeWallpaper: setting("useThemeWallpaper", false) === true
  property string capNext: ""
  // the checkbox in the capsule row (key L): writes the same plugin setting as the Omarchy settings screen, so both stay in step
  function setUseThemeWallpaper(on) {
    var entry = settingsEntry(moduleName, settings, "useThemeWallpaper", on === true)
    host.settings = entry
    if (bar && bar.shell && typeof bar.shell.updateEntryInline === "function") bar.shell.updateEntryInline(moduleName, entry)
    flash(on === true ? "Theme wallpapers on: applying a theme sets its Wallhaven picture" : "Theme wallpapers off: applying a theme leaves your wallpaper alone")
  }
  // applying a theme from the menu, a key or IPC: with the setting on, a theme that has a Wallhaven id brings its picture along (same code as the capsule button)
  function themeWallpaper(it) {
    var wh = it && it.opts && it.opts.wh ? it.opts.wh : ""
    var plan = themeWallPlan(useThemeWallpaper, wh, currentWhId, capUseProc.running ? capUseProc.id : "")
    if (plan === "fetch") capFetch(wh)
    else if (plan === "queue") capNext = wh
  }
  // H on a theme without a picture while Wallhaven is on screen: the theme keeps this id. Your own theme is changed in place;
  // a built-in one stays as it is and a copy is saved (the author's dev-export switch edits it in place, like F)
  function rememberWallhaven(target) {
    var id = currentWhId, line = target !== undefined ? target : capLine
    var i = themes.indexOf(line)
    if (id === "" || i < 0 || lineWh(line) !== "") return false
    var next = themes.slice()
    var wasOrigin = themeOrigin === line
    var fresh
    if (isLocked("theme", line) && !devSwitch) {
      var q = line.split("|")
      var base = (q[4] || themeItem(line).label).slice(0, 30), nm = base + " (mine)", n = 2
      while (themes.some(function(t) { return (t.split("|")[4] || "") === nm })) nm = base + " (mine " + n++ + ")"
      fresh = lineWithWh(themeRenamed(line, nm), id)
      if (themes.indexOf(fresh) >= 0) { flash("Already saved: " + nm); return false }
      next.splice(i + 1, 0, fresh)
      flash("Saved as \"" + nm + "\" with Wallhaven " + id + ": built-in themes stay as they are. Press n to rename")
    } else {
      fresh = lineWithWh(line, id)
      if (themes.indexOf(fresh) >= 0) { flash("That look is already another theme"); return false }
      next[i] = fresh
      flash("Theme keeps Wallhaven " + id)
    }
    themes = next
    writeThemes()
    if (wasOrigin) { themeOrigin = fresh; originWallPath = wallpaperPath }
    return true
  }
  // F or the save command on a look that is already a saved theme: when the only thing missing is the Wallhaven picture on screen, attach it instead of saying "Already saved"
  function alreadySaved(line) {
    if (themeSavedPlan(currentWhId, lineWh(line)) === "attach" && rememberWallhaven(line)) return true
    flash("Already saved: " + themeItem(line).label)
    return false
  }
  function capOpenPage() { if (capWh !== "") Quickshell.execDetached(["xdg-open", "https://wallhaven.cc/w/" + capWh]) }

  // the theme dialog (ThemeDialog.qml: AI theme, share code, import code) is loaded the first time it opens
  property bool dlgOpen: false
  property bool dlgLoaded: false
  property string dlgMode: "ai"
  property string dlgWh: ""
  property int dlgNum: 0
  property string dlgJob: ""
  property string dlgOnly: ""   // "": a whole theme; else the one kind of effect the AI makes (`ai-theme --only SLOT`)
  property string dlgEdit: ""   // "": a new theme; else a saved theme's number, or "current" (the look on now), opened for "Edit with AI"
  function openDialog(mode, whId, num, jobId, only, edit) {
    popupOpen = false
    closeWallhavenKeeping()
    rememberView(mode === "save" ? "" : "dialog|" + mode + "|" + (num || 0) + "|" + (jobId || "") + "|" + (only || ""))
    dlgMode = mode
    dlgWh = whId
    dlgNum = num
    dlgJob = jobId || ""
    dlgOnly = only || ""
    dlgEdit = edit || ""
    refreshJobs()
    dlgLoaded = true
    Qt.callLater(function() { root.dlgOpen = true })
  }
  // Share: the selected saved theme, else the look that is on now; the dialog lets you pick which parts go into the code
  function startShare() {
    var it = themeSec.selected
    var n = it && it.id.charAt(0) !== "@" ? themes.indexOf(it.id) + 1 : 0
    if (n < 1 && themeNow === "|||") { flash("Nothing to share: every effect is off. Pick a theme or switch something on first"); return }
    openDialog("share", "", n)
  }
  // Edit with AI (E): the highlighted saved theme, else the look on now, is opened in the dialog; the AI makes the parts you tick again, the rest stays
  function startEdit() {
    var it = themeSec.selected
    var n = it && it.id.charAt(0) !== "@" ? themes.indexOf(it.id) + 1 : 0
    if (n < 1 && themeNow === "|||") { flash("Nothing to edit: every effect is off. Pick a theme or switch something on first"); return }
    openDialog("ai", "", 0, "", "", n > 0 ? String(n) : "current")
  }
  // Save: a small window asks for the name (F)
  function startSave() {
    if (themeNow === "|||") { flash("Nothing to save: every effect is off"); return }
    var dup = themes.filter(themeSameNow)
    if (dup.length > 0) { alreadySaved(dup.indexOf(themeOrigin) >= 0 ? themeOrigin : dup[0]); return }
    openDialog("save", "", 0)
  }
  // Record GIF: bin/gif-capture clears the desktop, counts down (gifCount drives the number below), records and restores
  property int gifCount: 0
  property string gifMonitor: ""
  readonly property string gifScript: path("bin/gif-capture")
  function gifName() {
    for (var i = 0; i < themes.length; i++) {
      if (!themeMatchesNow(themes[i])) continue
      var nm = themes[i].split("|")[4]
      if (nm) return nm
    }
    return ""
  }
  function recordGif(seconds, out) {
    popupOpen = false
    whOpen = false
    var cmd = ["python3", gifScript, "--name", gifName()]
    if (seconds > 0) cmd = cmd.concat(["--seconds", String(seconds)])
    if (out !== "") cmd = cmd.concat(["--out", out])
    Quickshell.execDetached(cmd)
  }
  // Share GIF: put the shared look on, record it with the code in the borders (bin/gif-capture --share), then bring the old look back
  property string gifRestoreLine: ""
  function recordShareGif(line, payloadFile, name) {
    popupOpen = false
    whOpen = false
    dlgOpen = false
    gifRestoreLine = lookLine()
    if (line.replace(/\|/g, "") !== "" && !themeMatchesNow(line)) applyTheme(themeItem(line), true)
    Quickshell.execDetached(["python3", gifScript, "--share", payloadFile, "--name", name])
  }
  function gifFinished() {
    var l = gifRestoreLine
    gifRestoreLine = ""
    if (l !== "") restoreLook(l)
  }
  Variants {
    model: root.gifCount > 0 ? Quickshell.screens : []
    PanelWindow {
      id: gifWin
      required property var modelData
      screen: modelData
      visible: modelData.name === root.gifMonitor
      color: "transparent"
      exclusionMode: ExclusionMode.Ignore
      anchors { top: true; bottom: true; left: true; right: true }
      mask: Region {}
      WlrLayershell.layer: WlrLayer.Overlay
      WlrLayershell.namespace: "omashaders-gif-countdown"
      WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
      Item {
        anchors.fill: parent
        focus: true
        Keys.onPressed: function(event) {
          if (event.key === Qt.Key_Escape) { Quickshell.execDetached([root.gifScript, "cancel"]); event.accepted = true }
        }
        Rectangle {
          anchors.centerIn: parent
          width: Style.space(96)
          height: width
          radius: width / 2
          color: root.bgA(0.8)
          border.width: Style.space(2)
          border.color: root.fgA(0.5)
          Text {
            anchors.centerIn: parent
            text: String(root.gifCount)
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.space(56)
            font.bold: true
          }
        }
        Text {
          anchors.horizontalCenter: parent.horizontalCenter
          y: parent.height / 2 + Style.space(64)
          text: "Recording a GIF, Esc cancels"
          color: root.fg
          style: Text.Outline
          styleColor: root.bgA(0.9)
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.body
        }
      }
    }
  }
  FxHost {
    active: root.palLoaded
    source: root.sub("PaletteDialog.qml")
    props: ({ core: root, open: root.palOpen })
  }
  FxHost {
    active: root.dlgLoaded
    source: root.sub("ThemeDialog.qml")
    props: ({ core: root, open: root.dlgOpen, mode: root.dlgMode, whId: root.dlgWh, number: root.dlgNum })
  }
  // the AI provider: the theme dialog remembers the last pick (bin/ai-theme use); the plugin settings aiProvider / aiModel / aiCommand
  // seed it, and changing a setting updates the remembered pick. bin/ai-theme check says whether it can run
  readonly property string aiCommand: String(setting("aiCommand", "") || "")
  readonly property string aiProviderSetting: String(setting("aiProvider", "Remembered choice") || "")
  readonly property string aiModelSetting: String(setting("aiModel", "") || "")
  readonly property var aiProviderIds: ({ "Claude Code": "claude", "Codex": "codex", "Gemini CLI": "gemini", "OpenCode": "opencode", "Ollama (local)": "ollama", "OpenAI-compatible endpoint": "endpoint", "Custom command": "custom" })
  property string aiHint: ""
  property bool aiStrong: true
  property string aiProviderNow: "claude"
  property string aiModelNow: ""
  property var afterList: null
  function reloadList(fn) { if (fn) afterList = fn; lister.running = true }
  function lookLine() {
    var q = themeNow.split("|")
    return themeCompose(q[0] || "", q[1] || "", q[2] || "", q[3] || "", "", q[5] || "", q[6] || "", q[7] || "", currentOpts())
  }
  function restoreLook(line) {
    if (String(line).replace(/\|/g, "") === "") offAll()
    else applyTheme(themeItem(line), true)
  }
  function refreshAi() { if (!aiCheck.running) aiCheck.running = true }
  function aiEnv() { return ({ OMASHADERS_AI_CMD: root.aiCommand, OMASHADERS_AI_PROVIDER: root.aiProviderIds[root.aiProviderSetting] || "", OMASHADERS_AI_MODEL: root.aiModelSetting }) }
  function pushAiSetting() {
    var id = root.aiProviderIds[root.aiProviderSetting]
    var cmd = [root.python, root.path("bin/ai-theme"), "use"]
    if (id) { cmd.push(id); if (root.aiModelSetting !== "") { cmd.push("--model"); cmd.push(root.aiModelSetting) } }
    else if (root.aiModelSetting !== "") { cmd.push("--model"); cmd.push(root.aiModelSetting) }
    else if (root.aiCommand === "") return
    if (root.aiCommand !== "") { cmd.push("--custom"); cmd.push(root.aiCommand) }
    Quickshell.execDetached(cmd)
    aiRefreshTimer.restart()
  }
  readonly property string python: "python3"
  Timer { id: aiRefreshTimer; interval: 700; onTriggered: root.refreshAi() }
  onAiCommandChanged: if (root.ready) pushAiSetting(); else refreshAi()
  onAiProviderSettingChanged: if (root.ready) pushAiSetting()
  onAiModelSettingChanged: if (root.ready) pushAiSetting()
  Process {
    id: aiCheck
    command: ["python3", root.path("bin/ai-theme"), "check", "--json"]
    environment: root.aiEnv()
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        try {
          var d = JSON.parse(String(text).trim())
          root.aiAvailable = d.available === true; root.aiHint = String(d.hint || "")
          root.aiStrong = d.strong !== false; root.aiProviderNow = String(d.provider || "claude"); root.aiModelNow = String(d.model || "")
        }
        catch (e) { root.aiAvailable = false; root.aiHint = "Could not run bin/ai-theme." }
      }
    }
  }

  // ---- the AI theme creator as background jobs (bin/aijobs.py). The jobs run outside the shell and the dialog; Core only asks how they are doing.
  // A finished theme waits as a draft (Made by AI) until it is saved or discarded; ThemeDialog.qml attaches to a job by id.
  property var jobs: []
  property var jobRows: []          // [{ id, sig }]: changes only when a job appears, ends or changes state, so the Themes rows are not rebuilt on every poll
  property var jobsForm: ({})       // the prompt and settings the dialog restores
  property var jobLook: ({})        // job id -> { prev: the look before its draft was shown, applied: bool, key: which draft is on screen }
  property real jobClock: Date.now()
  readonly property int jobsRunning: { var n = 0; for (var i = 0; i < jobs.length; i++) if (jobs[i].alive) n++; return n }
  readonly property string jobsPath: path("bin/aijobs.py")
  function jobById(id) { for (var i = 0; i < jobs.length; i++) if (jobs[i].id === id) return jobs[i]; return null }
  function refreshJobs() { if (!jobsProc.running) jobsProc.running = true }
  function jobTitle(j) { return j.name !== "" ? j.name : (j.request !== "" ? j.request : "Surprise me") }
  function clockText(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ":" + (sec % 60 < 10 ? "0" : "") + (sec % 60) }
  function jobElapsed(j) { return j.alive ? Math.max(0, Math.floor(root.jobClock / 1000) - (j.run_started || j.started)) : j.elapsed }
  function jobRowText(j) {
    if (j.alive) return "Making: " + jobTitle(j) + "…  step " + j.step + "/" + j.steps_total + ", " + clockText(jobElapsed(j))
    if (j.has_result) return "Made by AI: " + jobTitle(j) + " (review)"
    return (j.state === "interrupted" ? "Interrupted: " : "Failed: ") + jobTitle(j) + " (retry)"
  }
  // what Themes shows: running, finished and stopped jobs (a cancelled one is gone from view)
  function jobCats() {
    var out = []
    for (var i = 0; i < jobRows.length; i++) out.push({ id: "@job:" + jobRows[i].id, label: "Made by AI", job: jobRows[i].id, action: true })
    return out
  }
  function jobTip(id) { var j = jobById(id); return j ? jobRowText(j) + (j.alive ? ". It keeps running if you close the menu. Enter opens it." : ". Enter opens it.") : "" }
  function notify(title, body) { Quickshell.execDetached(["notify-send", "-a", "OmaShaders", "-t", "5000", "-i", "applications-graphics", title, body]) }
  Process {
    id: jobsProc
    command: [root.python, root.jobsPath, "list", "--json"]
    environment: root.aiEnv()
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var d = null
        try { d = JSON.parse(String(text).trim()) } catch (e) { d = null }
        if (!d || !d.ok) return
        var l = d.jobs.filter(function(j) { return j.state !== "cancelled" })
        var sig = l.map(function(j) { return j.id + ":" + j.state + ":" + j.turn }).join(",")
        root.jobs = l
        root.jobsForm = d.form || ({})
        root.jobsMax = d.max || 2
        root.jobClock = Date.now()
        if (sig !== root.jobSig) { root.jobSig = sig; root.jobRows = l.map(function(j) { return { id: j.id } }) }
      }
    }
  }
  property string jobSig: ""
  property int jobsMax: 2
  Timer {
    interval: root.jobsRunning > 0 ? 2000 : 12000
    running: root.ready
    repeat: true
    triggeredOnStart: true
    onTriggered: root.refreshJobs()
  }
  Timer { interval: 1000; running: root.jobsRunning > 0; repeat: true; onTriggered: root.jobClock = Date.now() }
  FxHost {
    active: root.whLoaded
    source: root.sub("Wallhaven.qml")
    props: ({ core: root, open: root.whOpen })
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

  // ---------------------------------------------------------------- pause while fullscreen, and sound for audio-* effects
  // With "pause while fullscreen" on, the screen, wallpaper and cursor effects stop on each monitor that shows a fullscreen window;
  // the other monitors keep theirs. The shell side (wallpaper, cursor) leaves those monitors out (fsOffScreens); the Hyprland side
  // (screen shader, bend) skips them by monitor id with `omashaders fullscreen pause IDS` / `resume`, which keeps a manual pause
  // (the Enabled box) separate. Window shaders need no pause: HyprWindowShade already drops them on a fullscreen window.
  property bool fsPauseOn: false
  property var fsMonitors: [] // [{ id, name }] of the monitors that show a fullscreen window
  readonly property var fsOffScreens: fsPauseOn ? fsMonitors.map(function(m) { return m.name }) : []
  readonly property string fsIds: fsOffScreens.length > 0 ? fsMonitors.map(function(m) { return m.id }).join(",") : ""
  readonly property bool effectsOff: paused
  Process {
    running: root.fsPauseOn && root.fxHost
    command: [root.fsWatchScript]
    stdout: SplitParser {
      onRead: function(line) {
        var out = []
        line.trim().split(" ").forEach(function(t) {
          var i = t.indexOf(":")
          if (i > 0) out.push({ id: Number(t.slice(0, i)), name: t.slice(i + 1) })
        })
        root.fsMonitors = out
      }
    }
  }
  onFsIdsChanged: Quickshell.execDetached(fsIds === "" ? [root.script, "fullscreen", "resume"] : [root.script, "fullscreen", "pause", fsIds])
  onFsPauseOnChanged: if (!fsPauseOn) fsMonitors = []
  function setFsPause(v) { Quickshell.execDetached([root.script, "fullscreen", v ? "on" : "off"]) }

  // effects named audio-* react to what the speakers play: bin/audio-level prints "level bass mid treble" (0-1) and runs only while one is on
  readonly property bool audioNeeded: root.fxHost && !root.effectsOff && ((wallOn && wallShown.indexOf("audio-") === 0) || (wallOn && mixSecondOf("wall").indexOf("audio-") === 0) || (mouseOn && !mouseBend && cursorLive && mouseCurrent.indexOf("audio-") === 0))
  property real audioLevel: 0
  property real audioBass: 0
  property real audioMid: 0
  property real audioTreble: 0
  Process {
    id: audioProc
    running: root.audioNeeded
    command: [root.audioScript]
    stdout: SplitParser {
      onRead: function(line) {
        var p = line.split(" ")
        if (p.length !== 4) return
        root.audioLevel = Number(p[0]); root.audioBass = Number(p[1]); root.audioMid = Number(p[2]); root.audioTreble = Number(p[3])
      }
    }
    onRunningChanged: if (!running) { root.audioLevel = 0; root.audioBass = 0; root.audioMid = 0; root.audioTreble = 0 }
  }

  // ---------------------------------------------------------------- broken effects (FxSafety.qml, bin/fxcheck.py, bin/fx-guard)
  // An effect is handed to the renderer only after FxSafety checked its compiled shader; a broken one is switched off with one notice.
  readonly property string wantWall: root.fxHost && !root.effectsOff ? root.wallShown : ""
  readonly property string wantWall2: root.fxHost && !root.effectsOff && root.wallPreview === "" ? root.mixSecondOf("wall") : ""
  readonly property string wantMouse: root.fxHost && !root.effectsOff && root.mouseOn && !root.mouseBend && root.cursorLive ? root.mouseCurrent : ""
  readonly property var safe: safetyHost.item
  function fxSwitchOff(kind, name) {
    if (kind === "mouse") {
      if (mouseCurrent === name) applyMouse("")
    } else if (kind === "wall2") {
      if (wall2 === name) { wall2 = ""; writeFile(wall2File, "") }
    } else {
      if (wallPreview === name) { wallPreviewed = false; wallPreview = ""; writeFile(wallPreviewFile, "") }
      if (wallSaved === name) setWall("", true)
    }
  }
  function fxTripped(why) {
    var list = [["wall", wallPreview], ["wall", wallSaved], ["wall2", wall2], ["mouse", mouseBend ? "" : mouseCurrent]].filter(function(e) { return e[1] !== "" })
    list.forEach(function(e) { fxSwitchOff(e[0], e[1]) })
    return list.length > 0
  }
  function fxFailed(kind, name, why, driver) { Qt.callLater(function() { if (safe) safe.report(kind, name, why, driver) }) } // later: report() changes the settings the caller is being evaluated from
  FxHost {
    id: safetyHost
    source: root.sub("FxSafety.qml")
    props: ({
      pluginDir: root.script.replace(/bin\/omashaders$/, ""),
      stateDir: root.stateDir,
      host: root.fxHost,
      wall: root.wantWall,
      wall2: root.wantWall2,
      mouse: root.wantMouse,
      switchOff: root.fxSwitchOff,
      trip: root.fxTripped,
      notice: function(text) { Quickshell.execDetached(["notify-send", "-a", "OmaShaders", "-t", "8000", "-i", "dialog-warning", "Effect switched off", text]) }
    })
  }

  FxHost {
    source: root.sub("WallpaperFx.qml")
    props: ({
      genDir: "file://" + root.stateDir + "/generated",
      report: root.fxFailed,
      strength: root.wallStrength / 100,
      react: root.wallReact / 100,
      speed: root.wallSpeed / 100,
      zoom: root.wallZoom / 100,
      audio: root.audioLevel,
      bass: root.audioBass,
      mid: root.audioMid,
      treble: root.audioTreble,
      range: root.wallRange / 100,
      targetColor: "#" + root.wallTarget,
      offScreens: root.fsOffScreens,
      effect: root.safe && root.safe.wallOkName === root.wantWall ? root.wantWall : "",
      effect2: root.safe && root.safe.wall2OkName === root.wantWall2 ? root.wantWall2 : "",
      mixMode: root.wallMixMode,
      mixAmount: root.wallMixAmt / 100,
      wallpaper: root.wallpaperPath,
      mouse: root.cursor,
      fps: root.fps,
      cBg: root.pal("background", "#050318"),
      cBlue: root.pal("bright_blue", "#7a8cff"),
      cMagenta: root.pal("bright_magenta", "#da6fef"),
      cPink: root.pal("bright_yellow", "#f56c90"),
      cCream: root.pal("foreground", "#FAF0BF")
    })
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
  Loader {
    active: root.fxHost && root.shiftOnly
    sourceComponent: GlobalShortcut {
      appid: "omashaders"
      name: "shiftup"
      onPressed: root.shiftDown = false
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
    revertWinPreview()
    clearWallPreview()
  }
  Timer { id: hoverLeaveTimer; interval: 220; onTriggered: root.revertHoverPreview() }

  FxHost {
    source: root.sub("MouseFx.qml")
    props: ({
      genDir: "file://" + root.stateDir + "/generated",
      report: root.fxFailed,
      strength: root.mouseStrength / 100,
      offScreens: root.fsOffScreens,
      effect: root.safe && root.safe.mouseOkName === root.wantMouse ? root.wantMouse : "",
      motion: root.mouseMotion,
      size: root.mouseSize / 100,
      speed: root.mouseSpeed / 100,
      audio: root.audioLevel,
      bass: root.audioBass,
      mid: root.audioMid,
      treble: root.audioTreble,
      mouse: root.cursor,
      fps: root.fps
    })
  }

  // Bend effects: bin/cursor-bend feeds the pointer position into the Hyprland screen shader; with several
  // monitors the cursor's monitor is marked by a 3x2 pixel block in its corner (BendMarker) so only it is bent
  readonly property bool bendRunning: root.fxHost && !root.effectsOff && root.mouseOn && root.mouseBend && root.cursorLive
  Process {
    running: root.bendRunning
    command: [root.bendScript]
  }
  FxHost {
    source: root.sub("BendMarker.qml")
    props: ({
      active: root.bendRunning && Quickshell.screens.length > 1,
      mouse: root.cursor
    })
  }

  // cursor position, polled from Hyprland only while an effect that follows it is running
  property point cursor: Qt.point(-10000, -10000)
  Process {
    running: !root.effectsOff && (root.wallOn || (root.mouseOn && root.cursorLive)) && root.fxHost
    command: [root.cursorScript]
    stdout: SplitParser {
      onRead: function(line) {
        var p = line.split(",")
        if (p.length === 2) root.cursor = Qt.point(Number(p[0]), Number(p[1]))
      }
    }
  }

  // ---------------------------------------------------------------- combination favorites
  // A theme is the Screen effect, Wallpaper effect, Cursor effect and Color together, plus optionally the Windows effect, colour and frame; one line per theme
  // in the state file: "screen|wall|mouse|color", "...|name" or "...|name|winEffect|winColor|winFrame" (an empty part means off; older 3-part lines have no colour; the name is optional, set with n;
  // lines without the window fields turn the Windows effect, colour and frame off when applied: an empty part is always empty).
  // An optional 9th field holds numbers: "fx=60,col=70,wall=65,cur=70,wspeed=100,wzoom=100,wh=ID" (strengths, wallpaper speed and zoom, the
  // Wallhaven picture id); applying a theme sets the ones that are there. Lines without it leave the strengths alone.
  property var themes: []
  property string themeFlash: ""
  // wallcap:begin
  // (pure helpers; bin/wallcapsule_selftest.py runs everything up to wallcap:end under node)
  function themeCompose(s, w, m, c, name, wf, wc, wr, opts) {
    var win = (wf || wc || wr || opts) ? true : false
    var out = [s, w, m, c]
    if (name || win) out.push(name || "")
    if (win) out.push(wf || "", wc || "", wr || "")
    if (opts) out.push(opts)
    return out.join("|")
  }
  function themeKey(s, w, m, c, wf, wc, wr) { return themeCompose(s, w, m, c, "", wf, wc, wr) }
  function themeBase(line) {
    var p = line.split("|")
    return themeCompose(p[0] || "", p[1] || "", p[2] || "", p[3] || "", "", p[5] || "", p[6] || "", p[7] || "")
  }
  function themeHasWin(line) { var p = line.split("|"); return (p[5] || p[6] || p[7]) ? true : false }
  // the Wallhaven id kept in a theme line's 9th field ("" when there is none or it is not a well formed id)
  function lineWh(line) {
    var m = /(^|,)wh=([a-z0-9]{6})(,|$)/.exec(String(line || "").split("|")[8] || "")
    return m ? m[2] : ""
  }
  // the same theme under another name; every other field, the 9th (numbers and Wallhaven id) included, stays as it is
  function themeRenamed(line, name) {
    var q = String(line).split("|")
    return themeCompose(q[0] || "", q[1] || "", q[2] || "", q[3] || "", name, q[5] || "", q[6] || "", q[7] || "", q[8] || "")
  }
  // the 9th field to save: the numbers of the look on screen, plus the theme's own Wallhaven id when the screen shows no Wallhaven picture of its own
  function optsWithWh(opts, wh) {
    var o = String(opts || "")
    if (wh === "" || /(^|,)wh=/.test(o)) return o
    return o !== "" ? o + ",wh=" + wh : "wh=" + wh
  }
  // the capsule above the Wallpaper tab: what it says and whether pressing it does anything. Always shown; a theme without a Wallhaven id says so, or offers to remember the picture on screen
  // hasTheme false: the look on screen is not a saved theme, so there is nothing to remember a picture for yet
  function wallCapState(wh, cached, currentId, busy, error, hasTheme) {
    if (!wh) {
      if (currentId && hasTheme === false) return { kind: "unsaved", label: "Wallhaven " + currentId + " is on screen. Press F to save the look with it", enabled: false }
      if (currentId) return { kind: "remember", label: "Remember Wallhaven " + currentId + " for this theme", enabled: true }
      return { kind: "none", label: "No Wallhaven picture saved for this theme", enabled: false }
    }
    if (busy) return { kind: "busy", label: cached ? "Setting wallpaper\u2026" : "Downloading\u2026", enabled: false }
    if (currentId === wh) return { kind: "current", label: "Wallpaper set", enabled: false }
    if (error !== "") return { kind: "error", label: "Wallhaven did not answer. Retry", enabled: true }
    if (cached) return { kind: "set", label: "Set wallpaper", enabled: true }
    return { kind: "download", label: "Download and set", enabled: true }
  }
  // the same theme with the Wallhaven id added to its 9th field (kept when it has one already)
  function lineWithWh(line, wh) {
    var q = String(line).split("|")
    return themeCompose(q[0] || "", q[1] || "", q[2] || "", q[3] || "", q[4] || "", q[5] || "", q[6] || "", q[7] || "", optsWithWh(q[8] || "", wh))
  }
  // "Use theme wallpaper when available" (plugin setting, off by default): what applying a theme does about the picture.
  // none = leave the wallpaper alone (setting off, or the theme has no Wallhaven id); have = that picture is already on screen;
  // wait = it is being fetched right now; queue = another one is being fetched, take this one afterwards; fetch = start now
  function themeWallPlan(enabled, wh, currentId, busyId) {
    if (enabled !== true || !wh) return "none"
    if (currentId === wh) return "have"
    if (busyId === wh) return "wait"
    return busyId ? "queue" : "fetch"
  }
  // F on a look that already is a saved theme: attach the Wallhaven picture on screen when the theme has none, else it really is already saved
  function themeSavedPlan(currentId, themeWh) { return currentId && !themeWh ? "attach" : "already" }
  // the plugin's inline entry in shell.json with one setting changed: every other key of the entry stays
  function settingsEntry(id, settings, key, value) {
    var entry = { id: id }
    for (var k in settings) if (k !== "id") entry[k] = settings[k]
    entry[key] = value
    return entry
  }
  // wallcap:end
  function themeMatchesNow(line) {
    var p = line.split("|")
    var a = themeKey(p[0] || "", p[1] || "", p[2] || "", p[3] || "", "", "", "")
    var b = themeKey(current, wallShown, mouseCurrent, colorCurrent, "", "", "")
    if (a !== b) return false
    return !themeHasWin(line) || ((p[5] || "") === winEffect && (p[6] || "") === winColor && (p[7] || "") === winFrame)
  }
  readonly property var optRanges: ({ fx: [0, 100], col: [0, 100], wall: [0, 100], cur: [0, 100], wspeed: [0, 300], wzoom: [25, 300] })
  function parseOpts(str) {
    var o = {}
    String(str || "").split(",").forEach(function(part) {
      var kv = part.split("=")
      if (kv.length !== 2) return
      if (optRanges[kv[0]] !== undefined && /^[0-9]{1,3}$/.test(kv[1])) o[kv[0]] = clamp(parseInt(kv[1]), optRanges[kv[0]][0], optRanges[kv[0]][1])
      else if (kv[0] === "wh" && /^[a-z0-9]{6}$/.test(kv[1])) o.wh = kv[1]
    })
    return o
  }
  // the numbers of the current look, in the 9th theme field form; "wh" only when the wallpaper image came from Wallhaven
  function currentOpts() {
    var o = []
    if (shaderOn) o.push("fx=" + fxStrength)
    if (colorOn) o.push("col=" + colStrength)
    if (wallOn) {
      o.push("wall=" + wallStrength)
      if (wallSpeed !== 100) o.push("wspeed=" + wallSpeed)
      if (wallZoom !== 100) o.push("wzoom=" + wallZoom)
    }
    if (mouseOn) o.push("cur=" + mouseStrength)
    var m = /\/wallhaven-([a-z0-9]{6})\.[A-Za-z]+$/.exec(wallpaperPath)
    if (m) o.push("wh=" + m[1])
    return o.join(",")
  }
  // ids that exist now, by kind; a theme part whose effect was deleted counts as empty, so the theme still applies cleanly
  readonly property var haveIds: {
    var h = { shader: {}, color: {}, wall: {}, mouse: {}, frame: {}, loaded: allEntries.length > 0 }
    allEntries.forEach(function(e) {
      var k = (e.section === "screen" || e.section === "winfx") ? "shader" : e.section
      if (h[k]) h[k][e.name] = true
    })
    return h
  }
  function partOr(kind, id) {
    if (id === "" || !haveIds.loaded) return id
    if (kind === "color" && (/^custom-[0-9a-fA-F]{6}$/.test(id) || Pal.isId(id))) return id
    return haveIds[kind][id] === true ? id : ""
  }
  function themeItem(line) {
    var p = line.split("|")
    var s = partOr("shader", p[0] || ""), w = partOr("wall", p[1] || ""), m = partOr("mouse", p[2] || ""), c = partOr("color", p[3] || ""), name = p[4] || ""
    var wf = partOr("shader", p[5] || ""), wc = partOr("color", p[6] || ""), wr = partOr("frame", p[7] || ""), hasWin = (wf || wc || wr) ? true : false
    var opts = parseOpts(p[8] || "")
    var winNames = [wf, wc, wr].filter(function(x) { return x !== "" })
    var names = [s, c, w !== "" ? wallLabel(w) : "", m].concat(winNames).filter(function(x) { return x !== "" })
    var parts = "Screen " + (s || "off") + " · Color " + (c || "off") + " · Wallpaper " + (w !== "" ? wallLabel(w) : "off") + " · Cursor " + (m || "off")
                + (hasWin ? " · Windows " + winNames.join(" + ") : "")
    var pieces = []
    if (s !== "") pieces.push({ kind: "screen", text: prettyId(s) })
    if (w !== "") pieces.push({ kind: "wall", text: wallLabel(w) })
    if (c !== "") pieces.push({ kind: "color", text: prettyId(c) })
    if (m !== "") pieces.push({ kind: "mouse", text: prettyId(m) })
    if (hasWin) pieces.push({ kind: "win", text: winNames.map(prettyId).join(" + ") })
    return { id: line, screen: s, wall: w, mouse: m, color: c, name: name, hasWin: hasWin, winFx: wf, winCol: wc, winFrame: wr, opts: opts, pieces: pieces,
             label: name !== "" ? name : names.join(" + "), desc: parts }
  }
  // built-in marker: the lines and effect names shipped with the plugin (bin/oms-delete builtin); only the author (dev-export switch) changes those
  readonly property string builtinGlyph: "󰈻"
  property bool devSwitch: false
  property var builtinThemes: []
  property var builtinFx: ({ shader: [], color: [], wall: [], mouse: [], frame: [] })
  function isLocked(kind, id) {
    var i = String(id)
    if (kind === "theme") return builtinThemes.indexOf(i) >= 0
    if (kind === "win") {
      var pre = i.substring(0, 2), nm = i.substring(2)
      if (pre === "e:") return builtinFx.shader.indexOf(nm) >= 0
      if (pre === "c:") return builtinFx.color.indexOf(nm) >= 0
      if (pre === "f:") return builtinFx.frame.indexOf(nm) >= 0
      return false
    }
    var list = builtinFx[kind === "screen" ? "shader" : (kind === "color" ? "color" : (kind === "wall" ? "wall" : (kind === "mouse" ? "mouse" : "")))]
    return list !== undefined && list.indexOf(i) >= 0
  }
  Process {
    id: builtinProc
    command: ["python3", root.path("bin/oms-delete"), "builtin", "--json"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        try {
          var d = JSON.parse(String(text).trim())
          if (d.ok !== true) return
          root.devSwitch = d.dev === true
          root.builtinThemes = d.themes
          root.builtinFx = d.elements
        } catch (e) {}
      }
    }
  }
  Timer { id: builtinTimer; interval: 600; onTriggered: { root.adoptOrigin(); if (!builtinProc.running) builtinProc.running = true } }
  onThemesChanged: { builtinTimer.restart(); adoptOrigin() }
  onAllEntriesChanged: builtinTimer.restart()
  readonly property var themeItems: themes.map(function(l) {
    var it = themeItem(l)
    if (lookChanged && l === originLine) it.label = it.label + " (changed)"
    return it
  })
  readonly property string themeNow: themeKey(current, wallShown, mouseCurrent, colorCurrent, winEffect, winColor, winFrame)
  readonly property string themeNowId: {
    for (var i = 0; i < themes.length; i++) if (themeMatchesNow(themes[i])) return themes[i]
    return themeNow
  }
  property bool renaming: false
  onRenamingChanged: if (!renaming) catMode = ""
  property string renameId: ""
  // "Surprise me" lives here instead of in the header: pick what should be shuffled
  readonly property var surpriseItems: {
    var out = [
      { id: "@rand:theme", label: "A random complete theme", desc: "Applies one of the themes in the list" },
      { id: "@rand:all", label: "Surprise: everything", desc: "A new random Screen effect, Color grade, Wallpaper and Cursor" }
    ]
    effectKinds.forEach(function(k) { out.push({ id: "@rand:" + k, label: "Surprise: only " + kindTitle(k), desc: "Shuffles just the " + kindTitle(k) + " part and leaves the rest as it is" }) })
    if (winPlugin !== "missing") out.push({ id: "@rand:win", label: "Surprise: only Windows", desc: "Shuffles the effect on all windows" })
    out.push({ id: "@clear:all", label: "Clear everything", desc: "Switches Screen, Color, Wallpaper and Cursor off (a saved theme brings them back)" })
    return out
  }
  function runSurprise(id) {
    var w = id.split(":")[1]
    var isClear = id.indexOf("@clear:") === 0
    if (isClear) { offAll(); flash("Cleared: Screen, Color, Wallpaper, Cursor"); return }
    if (w === "theme") {
      var pool = themeItems.filter(function(t) { return !themeMatchesNow(t.id) })
      if (pool.length > 0) { var t = pool[Math.floor(Math.random() * pool.length)]; applyTheme(t, true); flash("Random theme: " + t.label) }
    } else if (w === "all") { randomAll(); flash("Surprise: everything shuffled") }
    else { randomIn(w); flash("Surprise: " + kindTitle(w) + " shuffled") }
  }
  // ---- theme categories: built-in ones come from starter-theme-categories (theme name -> category), your own live in the state file theme-categories
  // (lines "cat<TAB>Name" for a category you made, "set<TAB>Name<TAB>theme base" for a theme you moved; the base is the look, so a rename keeps the place)
  readonly property string themeCatFile: stateDir + "/theme-categories"
  readonly property string myThemesCat: "My themes"
  readonly property string moreCat: "More"
  property var userCats: []
  property var catOfBase: ({})
  property var starterCatOf: ({})
  property var starterCatOrder: []
  FileView {
    path: root.path("starter-theme-categories")
    printErrors: false
    onLoaded: {
      var of = {}, order = []
      String(text() || "").split("\n").forEach(function(l) {
        var i = l.indexOf("|")
        if (l.charAt(0) === "#" || i <= 0) return
        var c = l.substring(0, i), n = l.substring(i + 1)
        of[n] = c
        if (order.indexOf(c) < 0) order.push(c)
      })
      root.starterCatOf = of
      root.starterCatOrder = order
    }
  }
  FileView {
    path: root.themeCatFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      var cats = [], of = {}
      String(text() || "").split("\n").forEach(function(l) {
        var f = l.split("\t")
        if (f[0] === "cat" && f.length === 2 && f[1] !== "") cats.push(f[1])
        else if (f[0] === "set" && f.length === 3 && f[1] !== "" && f[2] !== "") of[f[2]] = f[1]
      })
      root.userCats = cats
      root.catOfBase = of
    }
  }
  function writeThemeCats() {
    var lines = userCats.map(function(n) { return "cat\t" + n })
    Object.keys(catOfBase).forEach(function(b) { lines.push("set\t" + catOfBase[b] + "\t" + b) })
    writeFile(themeCatFile, lines.join("\n"))
  }
  function cleanCatName(s) { return String(s || "").replace(/[|\t\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 30) }
  function defaultThemeCat(line) {
    var nm = line.split("|")[4] || ""
    if (nm !== "" && starterCatOf[nm] !== undefined) return starterCatOf[nm]
    return builtinThemes.indexOf(line) >= 0 ? moreCat : myThemesCat
  }
  function themeCategory(line) {
    var own = catOfBase[themeBase(line)]
    return own !== undefined ? own : defaultThemeCat(line)
  }
  readonly property var themeCatNames: {
    var seen = {}, out = []
    function add(n) { if (n !== "" && !seen[n]) { seen[n] = true; out.push(n) } }
    userCats.forEach(add)
    add(myThemesCat)
    starterCatOrder.forEach(add)
    add(moreCat)
    themes.forEach(function(l) { add(themeCategory(l)) })
    return out
  }
  readonly property var themeCatGroups: {
    var by = {}
    themeItems.forEach(function(it) { var c = themeCategory(it.id); (by[c] = by[c] || []).push(it) })
    var out = []
    themeCatNames.forEach(function(n) {
      var items = by[n] || [], mine = userCats.indexOf(n) >= 0
      if (items.length === 0 && !mine) return
      out.push({ id: "cat:" + n, label: n, items: items, badge: String(items.length), userCat: mine,
                 note: mine ? "Empty category. Pick a theme in All themes and press M to move it here. Delete removes this category." : "" })
    })
    return out
  }
  // names the Move prompt cycles through: every category that exists
  readonly property var catChoices: themeCatGroups.map(function(g) { return g.label })
  function catExists(name) {
    var n = name.toLowerCase()
    return catChoices.concat(starterCatOrder).some(function(c) { return c.toLowerCase() === n }) || userCats.some(function(c) { return c.toLowerCase() === n })
  }
  function canonCat(name) {
    var n = name.toLowerCase(), all = userCats.concat(catChoices).concat(starterCatOrder)
    for (var i = 0; i < all.length; i++) if (all[i].toLowerCase() === n) return all[i]
    return name
  }
  function createCategory(name) {
    var n = cleanCatName(name)
    if (n === "") { flash("Give the category a name"); return false }
    if (catExists(n)) { flash("There is already a category named " + canonCat(n)); return false }
    userCats = userCats.concat([n])
    writeThemeCats()
    flash("Created category: " + n + ". Pick a theme and press M to move it in.")
    Qt.callLater(function() { gotoThemeCat(n) })
    return true
  }
  function moveTheme(id, name) {
    var base = themeBase(id), label = themeItem(id).label
    var n = name.trim() === "" ? "" : canonCat(cleanCatName(name))
    var next = {}
    Object.keys(catOfBase).forEach(function(b) { next[b] = catOfBase[b] })
    if (n === "" || n === defaultThemeCat(id)) {
      delete next[base]
      n = defaultThemeCat(id)
    } else {
      next[base] = n
      if (!catExists(n)) userCats = userCats.concat([n])
    }
    catOfBase = next
    writeThemeCats()
    flash("Moved " + label + " to " + n)
    var ts = themeSec
    Qt.callLater(function() {
      if (ts.curItems.length === 0) ts.col = 0
      else ts.itemIdx = clamp(ts.itemIdx, 0, ts.curItems.length - 1)
    })
  }
  function deleteCategory(name) {
    if (userCats.indexOf(name) < 0) return
    userCats = userCats.filter(function(c) { return c !== name })
    var next = {}
    Object.keys(catOfBase).forEach(function(b) { if (catOfBase[b] !== name) next[b] = catOfBase[b] })
    catOfBase = next
    writeThemeCats()
    flash("Deleted category " + name + ". Its themes are back in their usual place.")
    Qt.callLater(function() { themeSec.catIdx = clamp(themeSec.catIdx, 0, themeSec.cats.length - 1) })
  }
  function gotoThemeCat(name) {
    var cs = themeSec.cats
    for (var i = 0; i < cs.length; i++) if (cs[i].id === "cat:" + name) { themeSec.col = 0; themeSec.catIdx = i; return }
  }
  property string catMode: ""   // "new" or "move" while the name field below asks for a category name
  function startNewCat() {
    if (focusKind !== "theme") activeKind = "theme"
    renameId = ""
    renameDup = false
    catMode = "new"
    renameField.text = ""
    renaming = true
    renameField.forceActiveFocus()
  }
  function startMove(fromMenu) {
    if (focusKind !== "theme") return
    var it = themeSec.selected || (fromMenu ? themeSec.lastItem : null)
    if (!it || it.id.charAt(0) === "@") { flash("Pick a theme first, then press M to move it to a category"); return }
    renameId = it.id
    renameDup = false
    catMode = "move"
    renameField.text = themeCategory(it.id)
    renaming = true
    renameField.forceActiveFocus()
    renameField.selectAll()
  }
  function cycleCatField(dir) {
    var names = catChoices
    if (names.length === 0) return
    var i = names.indexOf(renameField.text)
    var j = i < 0 ? (dir > 0 ? 0 : names.length - 1) : (i + dir + names.length) % names.length
    renameField.text = names[j]
    renameField.selectAll()
  }
  function finishCat(save) {
    var mode = catMode, id = renameId, name = renameField.text
    if (save && mode === "new" && !createCategory(name)) return
    renaming = false
    renameId = ""
    leaveSearch()
    if (save && mode === "move") moveTheme(id, name)
  }
  function deleteCategoryAsk(name) {
    var key = "cat:" + name
    if (delAsk === key) { delAsk = ""; deleteCategory(name); return }
    delAsk = key
    delAskTimer.restart()
    flash("Delete the category " + name + "? Its themes go back to their usual place. (Delete again = yes)", 7000)
  }
  readonly property var themeCats: [
    { id: "themes", label: "All themes", items: themeItems,
      note: "No themes yet. Set up Screen, Color, Wallpaper and Cursor the way you like, then press F." },
    { id: "surprise", label: "Surprise me", key: "R", items: surpriseItems, note: "" }
  ].concat(themeCatGroups).concat(jobCats()).concat(lookChanged ? [
    { id: "@saveas", label: "Save as new", key: "F", action: true },
    { id: "@revert", label: "Revert", key: "b", action: true }
  ] : []).concat(undoLine !== "" ? [
    { id: "@undo", label: "Undo", key: "y", action: true }
  ] : []).concat([
    { id: "@share", label: "Share", key: "S", action: true },
    { id: "@import", label: "Import theme", key: "i", action: true },
    { id: "@dup", label: "Duplicate", key: "N", action: true },
    { id: "@newcat", label: "New category", key: "K", action: true },
    { id: "@move", label: "Move to category", key: "M", action: true },
    { id: "@ai", label: "Create with AI", key: "T", action: true },
    { id: "@edit", label: "Edit with AI", key: "E", action: true }
  ])
  function flash(msg, ms) { themeFlash = msg; themeFlashTimer.interval = ms || 3000; themeFlashTimer.restart() }
  Timer { id: themeFlashTimer; interval: 3000; onTriggered: root.themeFlash = "" }

  // the developer's own copy ships what they save: with a "dev-export" file in the state folder, every save or remove also rewrites starter-themes
  function writeThemes() {
    Quickshell.execDetached(["bash", "-c", 'mkdir -p "$1" && printf %s "$2" > "$3" && [ -e "$1/dev-export" ] && printf %s "$2" > "$4"; true', "bash",
                             stateDir, themes.join("\n"), themeFile, path("starter-themes")])
  }
  // the theme the look on now came from: when it is a built-in one, only the author may save into it; everyone else saves under a new name
  property string themeOrigin: ""
  // the picture on screen when the look last came from a saved theme: while it is still that one, saving keeps the theme's own Wallhaven id
  property string originWallPath: ""
  function savedOpts() {
    return optsWithWh(currentOpts(), themeOrigin !== "" && wallpaperPath === originWallPath ? lineWh(themeOrigin) : "")
  }
  readonly property bool originLocked: themeOrigin !== "" && isLocked("theme", themeOrigin)
  readonly property string originName: themeOrigin !== "" ? themeItem(themeOrigin).label : ""
  // the saved theme the look came from, and whether the look on screen has drifted from it (a label only: nothing is copied until Save as)
  readonly property string originLine: themeOrigin !== "" && themes.indexOf(themeOrigin) >= 0 ? themeOrigin : ""
  function optsDiffer(line) {
    var o = parseOpts(String(line).split("|")[8] || "")
    delete o.wh
    if (Object.keys(o).length === 0) return false
    var n = parseOpts(currentOpts())
    var keys = ["fx", "col", "wall", "cur", "wspeed", "wzoom"]
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], dflt = (k === "wspeed" || k === "wzoom") ? 100 : undefined
      var a = o[k] !== undefined ? o[k] : dflt, b = n[k] !== undefined ? n[k] : dflt
      if (a !== undefined && b !== undefined && a !== b) return true
    }
    return false
  }
  function themeSameNow(line) { return themeMatchesNow(line) && !optsDiffer(line) }
  readonly property bool lookChanged: originLine !== "" && !optsTimer.running && !applyGuard.running && !themeSameNow(originLine) && !themes.some(themeSameNow)
  property string undoLine: ""
  property string undoOrigin: ""
  Timer { id: undoTimer; interval: 180000; onTriggered: root.undoLine = "" }
  function adoptOrigin() {
    if (themeOrigin !== "" || optsTimer.running) return
    for (var i = 0; i < themes.length; i++) if (themeSameNow(themes[i])) { themeOrigin = themes[i]; originWallPath = wallpaperPath; return }
  }
  // put the look back to the saved theme it came from; the edits stay available with Undo
  function revertLook() {
    if (!lookChanged) { flash("Nothing to revert: the look is as the theme"); return }
    applyTheme(themeItem(originLine), true)
  }
  function undoDrop() {
    if (undoLine === "") { flash("Nothing to undo"); return }
    var line = undoLine, org = undoOrigin
    applyTheme(themeItem(line), true)
    if (themes.indexOf(org) >= 0) themeOrigin = org
    undoLine = ""
    flash("Changes are back")
  }
  function saveProblem(name) {
    if (!originLocked || devSwitch) return ""
    var nm = String(name || "").replace(/[|\r\n]/g, " ").trim()
    if (nm === "") return "\"" + originName + "\" is built in and stays as it is. Type a new name for your own theme."
    if (nm === originName) return "That is the built-in name. Pick a different name for your own theme."
    return ""
  }
  function saveTheme(name) {
    var key = themeNow
    if (key === "|||") { flash("Nothing to save: every effect is off"); return false }
    var problem = saveProblem(name)
    if (problem !== "") { flash(problem); return false }
    var nm = String(name || "").replace(/[|\r\n]/g, " ").trim().slice(0, 40)
    var dup = themes.filter(themeSameNow)
    if (dup.length > 0) return alreadySaved(dup.indexOf(themeOrigin) >= 0 ? themeOrigin : dup[0])
    var opts = savedOpts()
    var q = key.split("|")
    if (opts !== "" || nm !== "") key = themeCompose(q[0] || "", q[1] || "", q[2] || "", q[3] || "", nm, q[5] || "", q[6] || "", q[7] || "", opts)
    themes = themes.concat([key])
    writeThemes()
    themeOrigin = key
    originWallPath = wallpaperPath
    flash("Saved theme: " + themeItem(key).label)
    return true
  }
  // save the look on now over the theme it came from, keeping its name and place in the list; a built-in theme only with the dev-export switch (the author)
  function replaceOrigin() {
    var i = themes.indexOf(themeOrigin)
    if (i < 0) { flash("This look did not come from a saved theme. Save it under a name instead."); return false }
    if (originLocked && !devSwitch) { flash("Built-in themes are changed by the author only. Save under a new name instead."); return false }
    if (themeNow === "|||") { flash("Nothing to save: every effect is off"); return false }
    var q = themeNow.split("|"), o = themeOrigin.split("|")
    var line = themeCompose(q[0] || "", q[1] || "", q[2] || "", q[3] || "", o[4] || "", q[5] || "", q[6] || "", q[7] || "", savedOpts())
    if (line === themeOrigin) { flash("Already saved: " + themeItem(line).label); return false }
    if (themes.indexOf(line) >= 0) { flash("That look is already another theme"); return false }
    var next = themes.slice()
    next[i] = line
    themes = next
    writeThemes()
    themeOrigin = line
    originWallPath = wallpaperPath
    flash((originLocked ? "Replaced built-in theme: " : "Updated theme: ") + themeItem(line).label)
    return true
  }
  // delete a theme: bin/oms-delete refuses the built-in ones ("Built-in theme, cannot be deleted") unless the developer switch is on
  function deleteTheme(id) {
    if (themes.indexOf(id) < 0) return
    delRun.start(["rm", "theme", "--line", id, "--yes"], "theme:" + id)
  }
  property bool renameDup: false
  function startRename(dup) {
    if (focusKind !== "theme") return
    var it = themeSec.selected
    if (!it || it.id.charAt(0) === "@") { if (dup) flash("Pick a theme first, then press N to duplicate it"); return }
    renameId = it.id
    catMode = ""
    renameDup = dup === true
    renameField.text = renameDup ? (it.name !== "" ? it.name : it.label.replace(/ \(changed\)$/, "")) + " copy" : it.name
    renaming = true
    renameField.forceActiveFocus()
    renameField.selectAll()
  }
  function finishRename(save) {
    if (catMode !== "") { finishCat(save); return }
    var id = renameId
    if (save && renameDup && !duplicateTheme(id, renameField.text)) return
    var dup = renameDup
    renaming = false
    renameDup = false
    renameId = ""
    leaveSearch()
    if (save && !dup) renameTheme(id, renameField.text)
  }
  // a copy of any theme under a new name (the original stays as it is, the copy is the user's own)
  function duplicateTheme(id, name) {
    var i = themes.indexOf(id)
    if (i < 0) return true
    var n = String(name).replace(/[|\r\n]/g, " ").trim().slice(0, 40)
    var q = id.split("|")
    if (n === "") { flash("Give the copy a name"); return false }
    if (n === (q[4] || "")) { flash("Pick a name different from the original"); return false }
    var line = themeRenamed(id, n)
    if (themes.indexOf(line) >= 0) { flash("There is already a theme named " + n); return false }
    var next = themes.slice()
    next.splice(i + 1, 0, line)
    themes = next
    writeThemes()
    flash("Duplicated as " + n + (isLocked("theme", id) && !devSwitch ? " (yours to change)" : ""))
    return true
  }
  function renameTheme(id, name) {
    if (themes.indexOf(id) < 0) return
    renameCheck.pendingId = id
    renameCheck.pendingName = String(name)
    renameCheck.command = ["python3", root.path("bin/oms-delete"), "check", "theme", "--line", id, "--json"]
    renameCheck.running = true
  }
  // a built-in theme is never changed: renaming it saves a copy under the new name (the developer switch renames it in place)
  Process {
    id: renameCheck
    property string pendingId: ""
    property string pendingName: ""
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var builtinCopy = false
        try { var d = JSON.parse(String(text).trim()); builtinCopy = d.builtin === true && d.dev !== true } catch (e) { builtinCopy = false }
        root.applyRename(renameCheck.pendingId, renameCheck.pendingName, builtinCopy)
      }
    }
  }
  function applyRename(id, name, asCopy) {
    var i = themes.indexOf(id)
    if (i < 0) return
    var n = String(name).replace(/[|\r\n]/g, " ").trim().slice(0, 40)
    var line = themeRenamed(id, n)
    if (asCopy) {
      if (line === id || themes.indexOf(line) >= 0) { flash("Built-in theme, kept as it is"); return }
      var withCopy = themes.slice()
      withCopy.splice(i + 1, 0, line)
      themes = withCopy
      writeThemes()
      flash("Built-in theme kept. Saved your own copy: " + themeItem(line).label)
      return
    }
    var next = themes.slice()
    next[i] = line
    themes = next
    writeThemes()
    flash(n !== "" ? "Renamed theme: " + n : "Name cleared: " + themeItem(line).label)
  }
  function previewTheme(it) {
    if (!it || it.id.charAt(0) === "@") return
    previewScreen({ id: it.screen })
    previewColor({ id: it.color })
    previewMouse({ id: it.mouse })
    if (it.wall !== "") previewWall({ id: it.wall })
  }
  // the parts of a theme land one after the other; until the last one is in, the look differs from the theme and must not show as "changed"
  Timer { id: applyGuard; interval: 2000 }
  function applyTheme(it, keep, withWallpaper) {
    if (!it || it.id.charAt(0) === "@") return
    if (lookChanged) {
      undoLine = themeCompose(current, wallShown, mouseCurrent, colorCurrent, "", winEffect, winColor, winFrame, savedOpts())
      undoOrigin = themeOrigin
      undoTimer.restart()
      flash("Changes to \"" + originName + "\" dropped. Press y to undo", 6000)
    }
    if (themes.indexOf(it.id) >= 0) { themeOrigin = it.id; originWallPath = wallpaperPath; applyGuard.restart() }
    chooseScreen({ id: it.screen }, true)
    chooseColor({ id: it.color }, true)
    chooseMouse({ id: it.mouse }, true)
    wallMixSet("")
    setWall(it.wall, true)
    if (it.hasWin || winEffect !== "" || winColor !== "" || winFrame !== "") {
      Quickshell.execDetached(["bash", "-c", 'w() { if [ -n "$3" ]; then "$1" window "$2" set "$3"; else "$1" window "$2" off; fi; }; w "$1" effect "$2" >/dev/null 2>&1; w "$1" color "$3" >/dev/null 2>&1; w "$1" frame "$4" >/dev/null 2>&1; true',
                               "bash", root.script, it.winFx, it.winCol, it.winFrame])
    }
    if (it.opts && Object.keys(it.opts).length > 0) { pendingOpts = it.opts; optsTimer.restart() }
    if (withWallpaper === true) themeWallpaper(it)
    if (!keep) popupOpen = false
  }
  // choosing an effect resets its strength to the start value a moment later, so the theme's numbers go on last
  property var pendingOpts: ({})
  Timer {
    id: optsTimer
    interval: 1200
    onTriggered: {
      var o = root.pendingOpts
      if (o.fx !== undefined && root.shaderOn) root.setStrength("effect", o.fx)
      if (o.col !== undefined && root.colorOn) root.setStrength("color", o.col)
      if (o.wall !== undefined && root.wallOn) root.setStrength("wall", o.wall)
      if (o.cur !== undefined && root.mouseOn) root.setStrength("mouse", o.cur)
      if (o.wspeed !== undefined && root.wallOn) root.setWallSpeed(o.wspeed)
      if (o.wzoom !== undefined && root.wallOn) root.setWallZoom(o.wzoom)
      root.pendingOpts = ({})
    }
  }
  function applyThemeLine(line) {
    var it = themeItem(line)
    applyTheme(it, true, true)
    flash("Applied: " + it.label)
  }
  function themeAt(n) {
    var i = Math.floor(Number(n)) - 1
    return i >= 0 && i < themes.length ? themeItem(themes[i]) : null
  }
  FileView {
    path: root.themeFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.themes = String(text() || "").split("\n").map(function(l) { return l.split("|").length === 3 ? l + "|" : l })
                                .filter(function(l) { var n = l.split("|").length; return (n === 4 || n === 5 || n === 8 || n === 9) && root.themeBase(l) !== "|||" })
                                .map(function(l) { return l.split("|").length === 5 && l.split("|")[4] === "" ? root.themeBase(l) : l })
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
  function colorName(n) { return Pal.isId(n) ? Pal.label(n) : n }
  function perfName(n) { return n.indexOf("custom-") === 0 || n.indexOf("pal-") === 0 ? "custom" : n }
  readonly property var activeNow: {
    var a = []
    function add(sec, key, text, kind, name, label) { a.push({ sec: sec, key: key, text: text, kind: kind || "", name: name || "", label: label || text }) }
    if (shaderOn) {
      add("screen", "screen", current + " " + fxStrength + "%" + costTag("screen", current), "screen", current, current + " " + fxStrength + "%")
      if (mixSecondOf("screen") !== "") add("screen", "screen2", (mixEffectMode === "blend" ? "~ " : "+ ") + effect2 + " " + mixEffectAmt + "%" + costTag("screen", effect2), "screen", effect2, (mixEffectMode === "blend" ? "~ " : "+ ") + effect2 + " " + mixEffectAmt + "%")
    }
    if (colorOn) {
      add("color", "color", colorName(colorCurrent) + " " + colStrength + "%" + costTag("color", perfName(colorCurrent)), "color", perfName(colorCurrent), colorName(colorCurrent) + " " + colStrength + "%")
      if (mixSecondOf("color") !== "") add("color", "color2", (mixColorMode === "blend" ? "~ " : "+ ") + color2 + " " + mixColorAmt + "%")
    }
    if (wallOn) {
      add("wall", "wall", wallLabel(wallShown) + costTag("wall", wallShown), "wall", wallShown, wallLabel(wallShown))
      if (mixSecondOf("wall") !== "") add("wall", "wall2", (wallMixMode === "blend" ? "~ " : "+ ") + wallLabel(wall2) + " " + wallMixAmt + "%" + costTag("wall", wall2), "wall", wall2, (wallMixMode === "blend" ? "~ " : "+ ") + wallLabel(wall2) + " " + wallMixAmt + "%")
    }
    if (mouseOn) add("mouse", "mouse", mouseCurrent + costTag("cursor", mouseCurrent), "cursor", mouseCurrent, mouseCurrent)
    var gm = winMix["*"] || { fx2: "", col2: "", fxMode: "stack", fxAmt: 100, colMode: "stack", colAmt: 100 }
    if (winEffectOn) add("win", "winfx", "effect " + winEffect + costTag("win", winEffect), "win", winEffect, "effect " + winEffect)
    if (winEffectOn && gm.fx2 !== "") add("win", "winfx2", (gm.fxMode === "blend" ? "~ " : "+ ") + gm.fx2 + " " + gm.fxAmt + "%")
    if (winColorOn) add("win", "wincol", "color " + winColor + costTag("wincolor", perfName(winColor)), "wincolor", perfName(winColor), "color " + winColor)
    if (winColorOn && gm.col2 !== "") add("win", "wincol2", (gm.colMode === "blend" ? "~ " : "+ ") + gm.col2 + " " + gm.colAmt + "%")
    if (winFrameOn) add("win", "winframe", "frame " + winFrame)
    Object.keys(winApps).forEach(function(c) { add("win", "app:" + c, (c.indexOf("layer:") === 0 ? c.slice(6) : c) + ": " + winAppSummary(c)) })
    return a
  }
  // ---------------------------------------------------------------- "what is using my GPU" and the hotkey sheet
  readonly property var loadItems: activeNow.filter(function(c) { return c.kind !== "" }).map(function(c) {
    var r = perfCost[c.kind + ":" + c.name]
    var anim = c.kind === "screen" && screenEntries.some(function(e) { return e.name === c.name && e.animated })
    return { key: c.key, label: c.label, rating: r ? r.rating : (anim ? "animated" : ""), cost: r ? Number(r.cost) : -1 }
  })
  function loadColor(rating, a) {
    return rating === "heavy" || rating === "rework" ? Qt.rgba(0.95, 0.3, 0.28, a)
         : (rating === "moderate" || rating === "animated" ? Qt.rgba(0.97, 0.75, 0.2, a)
         : (rating === "light" ? Qt.rgba(0.35, 0.8, 0.4, a) : fgA(a * 0.6)))
  }
  function loadWord(c) {
    if (c.rating === "") return "not measured yet"
    if (c.rating === "animated") return "animated"
    if (c.rating === "heavy" || c.rating === "rework") return "heavy"
    return c.rating === "moderate" ? "medium" : c.rating
  }
  readonly property string loadVerdict: {
    if (paused) return "Paused: nothing is drawn, so no GPU is used."
    if (loadItems.length === 0) return activeNow.length === 0 ? "No effect is on." : "Only window settings are on."
    var heavy = loadItems.filter(function(c) { return c.rating === "heavy" || c.rating === "rework" })
    var mid = loadItems.filter(function(c) { return c.rating === "moderate" || c.rating === "animated" })
    function names(l) { return l.map(function(c) { return c.label.replace(/\s+\d+%$/, "") }).join(", ") }
    if (heavy.length > 0) return "Heavy: " + names(heavy) + ". If your system lags, click it below to switch it off, or press p to pause everything."
    if (mid.length > 0) return "Medium load: " + names(mid) + ". Fine for most systems; switch it off if things stutter."
    return loadItems.some(function(c) { return c.rating === "" }) ? "Nothing heavy is on (some effects are not measured yet)." : "Light: everything that is on is cheap."
  }
  // the keys of a global pause bind, so a black screen can be undone without the menu (found by looking at Hyprland's bindings)
  property string panicKey: ""
  Process {
    id: panicProc
    command: ["python3", root.path("bin/pause-key")]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.panicKey = String(text).trim()
    }
  }
  // the default pause key: bin/pause-bind binds it in Hyprland at runtime (the setting "pauseKey", empty = none); a config reload forgets it, so it is bound again then
  readonly property string pauseKeySetting: String(setting("pauseKey", "CTRL + ALT + P"))
  Process {
    id: pauseBindProc
    command: ["python3", root.path("bin/pause-bind"), "apply", root.pauseKeySetting]
    onExited: panicProc.running = true
  }
  function applyPauseKey() { if (fxHost && !pauseBindProc.running) pauseBindProc.running = true }
  Timer { id: pauseBindTimer; interval: 2500; onTriggered: root.applyPauseKey() }
  onPauseKeySettingChanged: if (ready) pauseBindTimer.restart()
  // the hint strip under the menus: one row of keys that work everywhere, one row for the menu that has the cursor (it changes when the cursor moves to another menu); head = a caption without caps
  readonly property var everywhereHints: [
    { head: true, k: [], t: "Everywhere", strong: true },
    { k: ["↑↓←→", "hjkl"], t: "move" },
    { k: ["Space"], t: "apply" },
    { k: ["⏎"], t: "apply" },
    { k: ["Shift+↑↓"], t: "preview a step" },
    { k: ["Tab"], t: "next menu" },
    { k: ["Esc"], t: "close" },
    { k: ["p"], t: "pause" },
    { k: ["F3"], t: "resources" } ]
  // on a small screen the Everywhere row shrinks to one line
  readonly property var everywhereShort: [
    { head: true, k: [], t: "Everywhere", strong: true },
    { k: ["↑↓←→", "hjkl"], t: "move" },
    { k: ["Space"], t: "apply" },
    { k: ["⏎"], t: "apply" },
    { k: ["Tab"], t: "next menu" },
    { k: ["Esc"], t: "close" } ]
  // the legend for the flag that marks built-in rows (same wording as the status line under the lists); shown after the keys of every list that has such rows
  readonly property var flagLegend: ({ legend: true, k: [builtinGlyph], t: "built in (" + (devSwitch ? "edit and save yours with F" : "Duplicate to change") + ")" })
  readonly property var focusHints: {
    var k = focusKind
    if (k === "theme") {
      return [{ head: true, k: [], t: "Themes list", strong: true },
              { k: ["Del", "f"], t: "delete" },
              { k: ["n"], t: "rename" },
              { k: ["M"], t: "move to category" },
              { k: ["S"], t: "share" },
              { k: ["E"], t: "edit with AI" },
              { k: ["O"], t: "clear all" },
              { k: ["r"], t: "random theme" },
              { k: ["R"], t: "random everything" },
              { k: ["1-9"], t: "category" },
              { k: ["g", "G"], t: "first / last" } ].concat(lookChanged ? [] : [{ k: ["F"], t: "save as theme" }], capHasKey ? [{ k: ["H"], t: capHint }] : [], [{ k: ["L"], t: autoHint }], [flagLegend])
    }
    var out = [{ head: true, k: [], t: kindTitle(k), strong: true },
               { k: ["o"], t: "off" },
               { k: ["r"], t: "random" },
               { k: ["R"], t: "random everything" },
               { k: ["f"], t: "favorite" }]
    if (activeSec.hasMix) {
      out.push({ k: ["a"], t: "add a second effect" })
      if (mixSecondOf(k) !== "") out.push({ k: ["t"], t: "flip stack/blend" }, { k: ["⌫"], t: "remove mix" })
    }
    if (k === "win" && winPlugin !== "missing") out.push({ k: ["A"], t: "choose app" })
    if (k === "color") out.push({ k: ["u"], t: "type a colour" }, { k: ["B"], t: "star it" }, { k: ["z", "Z"], t: "hue" }, { k: ["v", "V"], t: "saturation" }, { k: ["m", "M"], t: "brightness" })
    if (k === "wall") out.push({ k: ["u"], t: "type a colour" })
    if (k === "mouse") out.push({ k: ["x"], t: "only with Shift" })
    out.push({ k: ["g", "G"], t: "first / last" })
    if (capHasKey) out.push({ k: ["H"], t: capHint })
    out.push({ k: ["L"], t: autoHint })
    if (activeSec.lockKind !== "") out.push(flagLegend)
    return out
  }
  // one tab of the right-hand pane: the open one is joined to the content below it, the others sit behind the line
  component PartTab: Item {
    id: pt
    required property string kind
    readonly property bool opened: root.isShown(kind)
    readonly property var chipList: root.chipsOf(kind)
    readonly property int found: root.secOf(kind).matchCount
    readonly property bool missing: kind === "win" && root.winPlugin === "missing"
    width: root.tabW
    height: root.tabH + 1
    clip: true
    opacity: missing ? 0.45 : (root.query.trim() !== "" && found === 0 && !opened ? 0.45 : 1)
    Rectangle {
      y: pt.opened ? 0 : Style.space(4)
      width: parent.width
      height: root.tabH + Style.space(12)
      radius: Style.space(7)
      color: pt.opened ? root.fgA(0.16) : root.fgA(tabMouse.containsMouse ? 0.12 : 0.05)
      border.width: 1
      border.color: root.fgA(pt.opened ? 0.45 : 0.18)
    }
    Text {
      id: tabTitle
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.leftMargin: Style.space(6)
      anchors.rightMargin: Style.space(6)
      y: Style.space(pt.opened ? 6 : 9)
      horizontalAlignment: Text.AlignHCenter
      elide: Text.ElideRight
      textFormat: Text.PlainText
      text: root.kindIcon(pt.kind) + " " + root.kindTitle(pt.kind)
      color: root.fg
      opacity: pt.opened ? 1 : 0.75
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body
      font.bold: pt.opened
    }
    Row {
      id: tabState
      anchors.horizontalCenter: parent.horizontalCenter
      y: tabTitle.y + Style.space(root.keyHints ? 17 : 19)
      spacing: Style.space(5)
      Text {
        id: tabStateText
        height: Style.space(16)
        width: Math.min(implicitWidth, pt.width - Style.space(12) - (tabKey.visible ? tabKey.width + tabState.spacing : 0))
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
        textFormat: Text.PlainText
        text: pt.missing ? "needs a plugin"
              : (root.query.trim() !== "" ? pt.found + " found"
                 : (pt.chipList.length > 0 ? "\u25CF on" : "\u25CB off"))
        color: root.fg
        opacity: pt.chipList.length > 0 ? 0.9 : 0.5
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.body * 0.75
      }
      HotKey { id: tabKey; visible: root.keyHints; small: true; keys: [root.kindKey(pt.kind)] }
    }
    MouseArea {
      id: tabMouse
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: root.toggleSection(pt.kind)
    }
  }

  component HotKey: Row {
    id: hk
    property var keys: []
    property string label: ""
    property bool strong: false
    property bool small: false
    property bool plain: false   // a legend mark, not a key: the glyph without the cap around it
    spacing: Style.space(4)
    height: Style.space(small ? 16 : 22)
    Repeater {
      model: hk.keys
      delegate: Rectangle {
        required property var modelData
        y: Style.space(1)
        height: hk.height - Style.space(2)
        width: Math.max(hk.height - Style.space(2), capText.implicitWidth + Style.space(hk.small ? 7 : 10))
        radius: Style.space(4)
        color: hk.plain ? "transparent" : root.fgA(hk.strong ? 0.28 : 0.13)
        border.width: hk.plain ? 0 : 1
        border.color: root.fgA(hk.strong ? 0.85 : 0.4)
        Text {
          id: capText
          anchors.centerIn: parent
          textFormat: Text.PlainText
          text: parent.modelData
          color: root.fg
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.body * (hk.small ? 0.75 : 0.9)
          font.bold: true
        }
      }
    }
    Text {
      visible: hk.label !== ""
      height: hk.height
      leftPadding: Style.space(2)
      verticalAlignment: Text.AlignVCenter
      textFormat: Text.PlainText
      text: hk.label
      color: root.fg
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body * 0.9
      font.bold: hk.strong
    }
  }

  // a key cap that stays in the menu header and can be clicked; dimmed while its setting is off
  component HeaderCap: Item {
    id: hc
    property string cap: ""
    property string label: ""
    property bool lit: true
    signal clicked()
    width: capRow.width
    height: Style.space(22)
    opacity: lit ? 1 : 0.5
    HotKey { id: capRow; keys: [hc.cap]; label: hc.label; strong: hc.lit }
    MouseArea {
      anchors.fill: parent
      cursorShape: Qt.PointingHandCursor
      onClicked: hc.clicked()
    }
  }

  component HintFlow: Flow {
    id: hf
    property var hints: []
    leftPadding: Style.space(10)
    topPadding: Style.space(2)
    bottomPadding: Style.space(2)
    Repeater {
      model: hf.hints
      delegate: Item {
        required property var modelData
        width: hint.width + Style.space(12)
        height: hint.height
        HotKey {
          id: hint
          keys: parent.modelData.k
          label: parent.modelData.t
          strong: parent.modelData.strong === true
          plain: parent.modelData.legend === true
        }
      }
    }
  }

  // key caps beside a slider's label: groups is a list of key lists, e.g. [["v", "V"]]
  component KeyCaps: Row {
    id: kc
    property var groups: []
    property bool small: false
    visible: root.keyHints && groups.length > 0
    spacing: Style.space(8)
    Repeater {
      model: kc.groups
      delegate: HotKey {
        required property var modelData
        small: kc.small
        keys: modelData
      }
    }
  }

  // list rows shrink on small screens so the whole menu, hotkeys included, stays on screen
  // "What is using my GPU" never gets shorter or taller than this while the menu is open (a theme brings more or fewer chips, a longer or shorter
  // verdict): the room for the list rows is taken from it, so the rows, and with them the scroll position, stay put when a theme is chosen.
  // It starts at two lines of verdict plus two lines of chips and only grows if a look needs more.
  property real loadHold: 0
  // on a screen under 700 px high the reserve would push the menu off the screen, so there it only holds what has been seen
  readonly property real loadFloor: !resShown ? 0 : popup.screenH > 0 && popup.screenH < Style.space(700) ? 0 : Style.space(26) + 2 * verdictMeasure.implicitHeight + 2 * Style.space(24) + Style.space(5) + Style.space(18) + 3 * Style.space(3)
  readonly property real loadH: !resShown ? 0 : Math.max(loadBox.implicitHeight, loadFloor, loadHold)
  onLoadHChanged: if (popupOpen && loadH > loadHold) Qt.callLater(function() { if (root.popupOpen && root.loadH > root.loadHold) root.loadHold = root.loadH })
  Text {
    id: verdictMeasure
    visible: false
    text: "x\nx"
    font.family: root.bar.fontFamily
    font.pixelSize: Style.font.body * 0.95
  }
  readonly property real chromeBase: header.height + searchRow.height + stepRow.height + loadH + detailText.height + (resShown ? 6 : 5) * 1 + (resShown ? 10 : 9) * Style.space(4) + Style.space(30)
  readonly property real rowStep: Style.space(28) + Style.space(2)
  readonly property real cardRoom: popup.availableCardHeight > 0 ? popup.availableCardHeight - popup.verticalContentInset : 100000
  // on a small screen the strip shrinks to the few keys you need first, so the lists keep their rows
  readonly property bool denseHints: chromeBase + Style.space(5) + hintMeasure.height + maxExtra + 7 * rowStep > cardRoom
  readonly property bool tinyScreen: keyHints && chromeBase - Style.space(30) + hintStrip.height + Style.space(5) + 5 * rowStep + maxExtra > cardRoom
  readonly property bool stripShown: keyHints && !tinyScreen
  readonly property real hintH: stripShown ? hintStrip.height + Style.space(5) : 0
  readonly property real chromeH: chromeBase + hintH
  readonly property real rowSpace: cardRoom - chromeH
  readonly property real maxExtra: themeSec.extraH + Style.space(34)
  // on a tall screen (1080 px and up) the lists take every row that fits: no 40-row ceiling, and the Themes column counts its own taller rows against the room instead of rounding twice
  readonly property bool tallScreen: !tinyScreen && popup.screenH >= Style.space(1000)
  readonly property int rowsFit: Math.max(3, Math.min(tallScreen ? 200 : 40, Math.floor((rowSpace - maxExtra) / rowStep)))
  // on a screen that is only just tall enough, the one-line Everywhere strip takes a little of the lists' minimum height
  readonly property int secH: Math.max(themeSec.implicitHeight, Style.space(stripShown && cardRoom < Style.space(560) ? 280 : 300))
  // the right-hand pane: a fixed row of tabs, one line saying what the open tab changes, then its list
  readonly property real tabH: Style.space(42)
  readonly property real aboutH: Style.space(24)
  readonly property real tabW: Math.floor((partsHead.width - 4 * Style.space(3)) / 5)
  readonly property real paneGap: Style.space(4)
  readonly property real paneRoom: secH - tabH - aboutH - 4 * paneGap
  function chipsOf(k) { return activeNow.filter(function(c) { return c.sec === k }) }
  function removeActive(key) {
    if (key === "screen") offIn("screen")
    else if (key === "screen2") Quickshell.execDetached([script, "mix", "effect", "off"])
    else if (key === "color") offIn("color")
    else if (key === "color2") Quickshell.execDetached([script, "mix", "color", "off"])
    else if (key === "wall") setWall("", true)
    else if (key === "wall2") wallMixSet("")
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

  // ---------------------------------------------------------------- GPU use (only while the menu is open)
  property string gpuText: ""
  Process {
    id: gpuProc
    command: [root.gpuScript]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var p = String(text).trim().split(/\s+/)
        if (p.length !== 5) { root.gpuText = ""; return }
        root.gpuText = p[0] === "na" ? "" : "Your graphics card is " + p[0] + "% busy right now (all programs together)."
      }
    }
  }
  Timer {
    id: gpuTimer
    interval: 2500
    repeat: true
    running: root.popupOpen && root.resShown
    triggeredOnStart: true
    onTriggered: if (!gpuProc.running) gpuProc.running = true
  }

  // ---------------------------------------------------------------- menu actions
  property bool popupOpen: false
  property bool keyShift: false
  // "/" filter: one query narrows every column at once (label, description, hint and category name; all words must match)
  property string query: ""
  function focusSearch() { searchField.forceActiveFocus(); searchField.selectAll() }
  function leaveSearch() { keys.forceActiveFocus() }
  function clearSearch() { searchField.text = ""; leaveSearch() }
  function applyQuery() {
    Qt.callLater(function() {
      ["screen", "color", "wall", "mouse", "win", "theme"].forEach(function(k) { secOf(k).resetForQuery() })
      if (query.trim() !== "" && !secOf(focusKind).hasMatches) {
        var order = ["theme"].concat(partKinds)
        for (var i = 0; i < order.length; i++) {
          if (!secOf(order[i]).hasMatches || (order[i] === "win" && winPlugin === "missing")) continue
          if (order[i] !== "theme" && !isShown(order[i])) openOnly(order[i], false)
          activeKind = order[i]
          break
        }
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
  function open() {
    if (viewOpen) return
    if (lastView !== "" && restoreView()) return
    popupOpen = true
  }
  function close() {
    if (viewOpen) hideViews(true)
    popupOpen = false
  }
  function toggle() {
    if (viewOpen || popupOpen) close()
    else open()
  }
  function closeForPopoutSwitch() {
    popoutSwitchClosing = true
    popupOpen = false
    Qt.callLater(function() { popoutSwitchClosing = false })
  }
  onPopupOpenChanged: {
    if (!popupOpen) renaming = false
    if (popupOpen) { capCached = ({}); capCheck() }
    loadHold = 0
    if (popupOpen) loadHold = loadH
    if (!popupOpen) wn.close()
    if (popupOpen) {
      wn.refresh()
      mergeStarterThemes()
      lister.running = true
      panicProc.running = true
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
      themeSec.sync()
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
    if (k === "theme") offAll()
    else if (k === "wall") setWall("", true)
    else if (k === "win") { if (winScope === "*") winRun(["off"]); else winRunS(["off"]) }
    else chooseIn(k, { id: "" }, true)
  }
  function randomIn(k) {
    if (k === "theme") { randomTheme(); return }
    var cur = k === "wall" ? wallShown : savedOf(k)
    var pool = itemsOf(k).filter(function(e) { return e.id !== cur })
    if (pool.length > 0) chooseIn(k, pool[Math.floor(Math.random() * pool.length)], true)
  }
  function randomAll() { effectKinds.forEach(randomIn) }
  // a random complete theme from the open category (or the filter result), never the one that is on now
  function randomTheme() {
    var c = themeSec.curCat, items = null
    if (c && c.items && !c.action && c.id !== "surprise") items = c.items
    else for (var i = 0; i < themeSec.cats.length; i++) if (themeSec.cats[i].id === "themes") items = themeSec.cats[i].items
    var pool = (items || []).filter(function(t) { return t.id.charAt(0) !== "@" && !themeMatchesNow(t.id) })
    if (pool.length === 0) { flash("No other theme to pick here"); return }
    var t = pool[Math.floor(Math.random() * pool.length)]
    applyTheme(t, true, true)
    flash("Random theme: " + t.label)
  }
  function offAll() { effectKinds.forEach(offIn) }
  function runAction(k, id) {
    if (k === "theme") {
      if (id === "@share") startShare()
      else if (id === "@import") openDialog("import", "", 0)
      else if (id === "@dup") startRename(true)
      else if (id === "@newcat") startNewCat()
      else if (id === "@move") startMove(true)
      else if (id === "@saveas") startSave()
      else if (id === "@revert") revertLook()
      else if (id === "@undo") undoDrop()
      else if (id === "@ai") openDialog("ai", "", 0)
      else if (id === "@edit") startEdit()
      else if (id.indexOf("@job:") === 0) openDialog("ai", "", 0, id.substring(5))
      return
    }
    if (id.indexOf("@ai:") === 0) {
      var slot = id.substring(4)
      if (slot === "win") slot = winPart === "frame" ? "frame" : (winPart === "color" ? "window_color" : "window")
      openDialog("ai", "", 0, "", slot)
      return
    }
    if (k === "win" && id === "@copy") { Quickshell.execDetached(["wl-copy", installCmd]); flash("Copied: " + installCmd); return }
    if (k === "win" && id === "@inherit") { winRunS(["inherit"]); return }
    if (k === "win" && id === "@off" && winScope !== "*") { winRunS(["off"]); return }
    if (k === "color" && id === "@palette") { openPalette(); return }
    if (id === "@delete") deleteSelected(true)
    else if (id === "@off") offIn(k)
    else if (id === "@random") randomIn(k)
  }
  // Delete the selected element (a shader) or theme. bin/oms-delete decides: built-in ones are refused (a note), the others ask first
  // ("Used by theme: Abyss, Moon Lake. Delete anyway?") and Delete again confirms. A theme that loses an element just has that part empty.
  property string delAsk: ""
  function deleteTarget(k, it) {
    if (k === "theme") return ["theme", "--line", it.id]
    var id = String(it.id), pre = id.substring(0, 2)
    if (k === "win") {
      if (pre === "c:") return ["element", "color", id.substring(2)]
      if (pre === "f:") return ["element", "frame", id.substring(2)]
      return ["element", "window", id.substring(2)]
    }
    return ["element", k === "screen" ? "screen" : (k === "color" ? "color" : (k === "wall" ? "wallpaper" : "cursor")), id]
  }
  function deleteSelected(fromMenu) {
    var k = focusKind, s = secOf(k)
    if (k === "theme" && s.col === 0 && s.curCat && s.curCat.userCat) { deleteCategoryAsk(s.curCat.label); return }
    var it = s ? (s.selected ? s.selected : (fromMenu ? s.lastItem : null)) : null
    if (!it || it.id.charAt(0) === "@") { flash("Pick one first, then press Delete to delete it"); return }
    var key = k + ":" + it.id
    if (delAsk === key) { delAsk = ""; delRun.start(["rm"].concat(deleteTarget(k, it)).concat(["--yes"]), key); return }
    delAsk = ""
    delCheck.start(["check"].concat(deleteTarget(k, it)), key)
  }
  Timer { id: delAskTimer; interval: 7000; onTriggered: root.delAsk = "" }
  Process {
    id: delCheck
    property string key: ""
    function start(args, key) { delCheck.key = key; delCheck.command = ["python3", root.path("bin/oms-delete")].concat(args).concat(["--json"]); delCheck.running = true }
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        try {
          var d = JSON.parse(String(text).trim())
          if (d.ok === false && d.error) { root.flash(d.error); return }
          if (!d.can_delete) { root.flash(d.message); return }
          root.delAsk = delCheck.key
          delAskTimer.restart()
          root.flash(d.prompt + "  (Delete again = yes)", 7000)
        } catch (e) { root.flash("Could not check it") }
      }
    }
  }
  Process {
    id: delRun
    property string key: ""
    function start(args, key) { delRun.key = key; delRun.command = ["python3", root.path("bin/oms-delete")].concat(args).concat(["--json"]); delRun.running = true }
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        try {
          var d = JSON.parse(String(text).trim())
          if (d.ok !== true) { root.flash(d.error || "Could not delete it"); return }
          if (d.type === "theme") {
            root.themes = root.themes.filter(function(c) { return c !== d.line })
            var ts = root.themeSec
            if (ts.curItems.length === 0) ts.col = 0
            else ts.itemIdx = root.clamp(ts.itemIdx, 0, ts.curItems.length - 1)
            root.flash("Removed theme: " + d.name)
          } else {
            root.flash("Deleted " + d.name + (d.used_by.length > 0 ? " (" + d.used_by.length + " theme" + (d.used_by.length > 1 ? "s" : "") + " keep the rest and skip this part)" : ""))
          }
        } catch (e) { root.flash("Could not delete it") }
        lister.running = true
      }
    }
  }
  function toggleFav(k) {
    var s = secOf(k), it = s.selected
    if (!it || it.id.charAt(0) === "@" || k === "win") return
    if (k === "theme") { deleteTheme(it.id); return }
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
    if (!keyPreview && !keyShift) revertHoverPreview()
    if (wn.open) { if (dy !== 0) wn.scrollBy(dy * Style.space(60)); return }
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
    } else if (r === -1) {
      if (shiftFocus(-1)) { var p = secOf(focusKind); if (p.curItems.length > 0) p.col = 1 }
    }
  }
  function handleText(t) {
    var k = focusKind, s = secOf(k)
    if (t === "A") { if (winPlugin !== "missing") { activeKind = "win"; toggleWinPicker() } }
    else if (winPickOpen) { if (t === "q") close(); else if (t === "g") winSec.pickerIdx = 0; else if (t === "G") winSec.pickerIdx = winAppItems.length - 1 }
    else if (t === "/") focusSearch()
    else if (t === "q") close()
    else if (t === "U") wn.toggle()
    else if (t === "o" || t === "0") offIn(k)
    else if (t === "O") offAll()
    else if (t === "r") randomIn(k)
    else if (t === "R") randomAll()
    else if (t === "g") s.jump(false)
    else if (t === "G") s.jump(true)
    else if (t === "f") toggleFav(k)
    else if (t === "F") startSave()
    else if (t === "H") capAct()
    else if (t === "L") setUseThemeWallpaper(!useThemeWallpaper)
    else if (t === "b") revertLook()
    else if (t === "y") undoDrop()
    else if (t === "n") startRename(false)
    else if (t === "N") startRename(true)
    else if (t === "K") startNewCat()
    else if (t === "M") { if (k === "color") nudgeCustom(2, 1); else startMove(false) }
    else if (t === "m") nudgeCustom(2, -1)
    else if (t === "s") toggleSection("screen")
    else if (t === "S") startShare()
    else if (t === "i") openDialog("import", "", 0)
    else if (t === "T") openDialog("ai", "", 0)
    else if (t === "E") startEdit()
    else if (t === "\x7f") deleteSelected(false)
    else if (t === "C") toggleSection("color")
    else if (t === "w") toggleSection("wall")
    else if (t === "W") toggleSection("win")
    else if (t === "c") toggleSection("mouse")
    else if (t === "x") setShiftOnly(!shiftOnly)
    else if (t === "p") togglePause()
    else if (t === "]" || t === "=" || t === "+") nudgeStrength(keyShift ? 1 : 5)
    else if (t === "[" || t === "-") nudgeStrength(keyShift ? -1 : -5)
    else if (t === "}") nudgeStrength(1)
    else if (t === "{") nudgeStrength(-1)
    else if (t === "d") resetStrength()
    else if (t === ")") { if (focusKind === "wall" && wallOn) setWallReact(wallReact + 10) }
    else if (t === "(") { if (focusKind === "wall" && wallOn) setWallReact(wallReact - 10) }
    else if (t === "v") { if (focusKind === "wall" && wallOn) setWallSpeed(wallSpeed - 10); else if (focusKind === "mouse" && mouseOn) setMouseSpeed(mouseSpeed - 10); else nudgeCustom(1, -1) }
    else if (t === "V") { if (focusKind === "wall" && wallOn) setWallSpeed(wallSpeed + 10); else if (focusKind === "mouse" && mouseOn) setMouseSpeed(mouseSpeed + 10); else nudgeCustom(1, 1) }
    else if (t === "z") { if (focusKind === "wall" && wallOn) setWallZoom(wallZoom - 10); else if (focusKind === "mouse" && mouseOn) setMouseSize(mouseSize - 10); else nudgeCustom(0, -1) }
    else if (t === "Z") { if (focusKind === "wall" && wallOn) setWallZoom(wallZoom + 10); else if (focusKind === "mouse" && mouseOn) setMouseSize(mouseSize + 10); else nudgeCustom(0, 1) }
    else if (t === "e") setFsPause(!fsPauseOn)
    else if (t === ".") nudgeMix(keyShift ? 1 : 5)
    else if (t === ",") nudgeMix(keyShift ? -1 : -5)
    else if (t === ">") nudgeMix(1)
    else if (t === "<") nudgeMix(-1)
    else if (t === "a") mixSelected()
    else if (t === "t") toggleMixMode()
    else if (t === "D") resetMix()
    else if (t === "\b") clearMix()
    else if (t === "u") {
      if (focusKind === "wall" && wallReactorOn) wallSec.focusTarget()
      else { activeKind = "color"; colorSec.focusHex() }
    }
    else if (t === "B") { if (k === "color") toggleCustomFav() }
    else if (t >= "1" && t <= "9") s.gotoCat(parseInt(t) - 1)
  }

  IpcHandler {
    target: "io.github.akton1.omashaders"
    function toggle(): void { root.toggle() }
    function wallhaven(): void { root.openWallhaven() }
    function aiTheme(): void { root.openDialog("ai", "", 0) }
    function editTheme(which: string): void { root.openDialog("ai", "", 0, "", "", which === "" || which === "current" ? "current" : String(Math.floor(Number(which)) || 1)) }
    function importTheme(): void { root.openDialog("import", "", 0) }
    function palette(): void { root.openPalette() }
    function shareTheme(which: string): void { root.openDialog("share", "", Math.floor(Number(which)) || 1) }
    function gif(seconds: string, out: string): void { root.recordGif(Number(seconds) || 0, out) }
    function gifFinished(): void { root.gifFinished() }
    function gifCount(n: string, monitor: string): void { root.gifMonitor = monitor; root.gifCount = Math.max(0, Math.floor(Number(n)) || 0) }
    function open(): void { root.open() }
    function close(): void { root.close() }
    function mainMenu(): void { root.hideViews(false); root.forgetView(); root.popupOpen = true }
    function view(): string { return "last=" + (root.lastView === "" ? "none" : root.lastView.replace(/\|/g, ":")) + " menu=" + root.popupOpen + " dlg=" + root.dlgOpen + " mode=" + root.dlgMode + " wh=" + root.whOpen + " pal=" + root.palOpen }
    function resources(): string { return "shown=" + root.resShown + " cap=" + (f3Cap.visible && f3Cap.width > 0) + " poll=" + gpuTimer.running + " height=" + Math.round(loadBox.visible ? loadBox.height : 0) + " flag=" + root.resFlag }
    function set(name: string): void { root.applyScreen(name === "off" ? "" : name) }
    function setColor(name: string): void { root.applyColor(name === "off" ? "" : name) }
    function setMouse(name: string): void { root.applyMouse(name === "off" ? "" : name) }
    function wallpaper(name: string): void { root.setWall(name === "off" ? "" : name, true) }
    function sections(mode: string): void { root.setSections(mode) }
    function windows(args: string): void { root.winRun(args.split(" ").filter(function(a) { return a !== "" })) }
    function themeMenu(): string { var s = themeSec; return "open=" + root.popupOpen + " cat=" + (s.curCat ? s.curCat.id : "") + " catIdx=" + s.catIdx + " nCmd=" + s.nCmd + " item=" + s.itemIdx + " items=" + s.curItems.length + " col=" + s.col + " scroll=" + Math.round(s.listY) + " catscroll=" + Math.round(s.catY) + " jumps=" + s.topJumps + " rows=" + s.visibleRows + " chrome=" + Math.round(root.chromeH) + " load=" + Math.round(loadBox.implicitHeight) + " loadH=" + Math.round(root.loadH) + " sel=" + (s.selected ? s.selected.label : "") }
    function hints(): string { return (root.keyHints ? "on" : "off") + " strip=" + Math.round(root.stripShown ? hintStrip.height : 0) + " tiny=" + root.tinyScreen + " rows=" + root.rowsFit + " dense=" + root.denseHints + " need=" + Math.round(body.implicitHeight) + " room=" + Math.round(root.cardRoom) + " preview=" + (root.keyPreview ? "on" : "off") + " slashcap=" + (slashCap.visible && slashCap.width > 0) + " f1cap=" + (f1Cap.visible && f1Cap.width > 0) + " f1dim=" + (f1Cap.opacity < 1) + " focus=" + root.focusKind + " row2=" + (root.stripShown && focusFlow.visible) + " chrome=" + Math.round(root.chromeBase) + " extra=" + Math.round(root.maxExtra) + " measure=" + Math.round(hintMeasure.height) + " open=" + root.popupOpen + " legend=" + (root.stripShown && focusFlow.visible && root.focusHints.some(function(h) { return h.legend === true })) + " legendtext=" + root.flagLegend.t.replace(/ /g, "_") + " fkeys=" + root.focusHints.filter(function(h) { return h.legend !== true }).map(function(h) { return h.k.join("+") }).join(",") + " ekeys=" + root.everywhereHints.map(function(h) { return h.k.join("+") }).join(",") }
    function custom(): string { return "hex=" + root.customHex + " h=" + root.customH.toFixed(3) + " s=" + root.customS.toFixed(3) + " v=" + root.customV.toFixed(3) + " on=" + root.customActive + " railcaps=" + colorSec.railCaps }
    function wallCap(): string { return "visible=" + (wallCap.visible && wallCap.width > 0) + " wh=" + root.capWh + " kind=" + root.capState.kind + " label=" + root.capState.label.replace(/ /g, "_") + " enabled=" + root.capState.enabled + " err=" + root.capErr.replace(/ /g, "_") + " running=" + capUseProc.running + " auto=" + root.useThemeWallpaper + " cached=" + (root.capCached[root.capWh] === true) + " current=" + root.currentWhId + " box=" + (autoBox.visible && autoBox.width > 0) + " boxx=" + Math.round(autoBox.mapToItem(null, 0, 0).x) + " boxw=" + Math.round(autoBox.width) + " x=" + Math.round(wallCap.mapToItem(null, 0, 0).x) + " y=" + Math.round(wallCap.mapToItem(null, 0, 0).y) + " w=" + Math.round(wallCap.width) + " h=" + Math.round(wallCap.height) }
    function wallCapPress(): void { root.capAct() }
    function autoWallpaper(mode: string): void { root.setUseThemeWallpaper(mode === "toggle" ? !root.useThemeWallpaper : (mode === "on" || mode === "1")) }
    function look(): string { return root.originLine === "" ? "none" : (root.lookChanged ? "changed|" : "same|") + root.originName }
    function theme(which: string): void { if (which === "save") root.saveTheme(); else root.applyTheme(root.themeAt(which), true, true) }
    function themeRename(which: string, name: string): void { var it = root.themeAt(which); if (it) root.renameTheme(it.id, name) }
    // old names, kept so existing key bindings keep working
    function combo(which: string): void { theme(which) }
    function comboRename(which: string, name: string): void { themeRename(which, name) }
    function importCombo(): void { importTheme() }
    function shareCombo(which: string): void { shareTheme(which) }
    function power(mode: string): void { root.setPower(mode === "" ? "toggle" : mode) }
    function strength(kind: string, value: string): void { Quickshell.execDetached([root.script, "strength", kind, value]) }
    function shiftOnly(mode: string): void { root.setShiftOnly(mode === "toggle" ? !root.shiftOnly : (mode === "on" || mode === "1")) }
  }

  // new starter themes appear without a shell restart: the same merge runs each time the menu opens (the themes file is watched and reloads)
  function mergeStarterThemes() {
    Quickshell.execDetached(["bash", "-c", 'seen="$1/starter-seen"; touch "$seen" "$2"; while IFS= read -r l || [ -n "$l" ]; do [ -n "$l" ] || continue; grep -qxF -- "$l" "$seen" && continue; grep -qxF -- "$l" "$2" || { [ -s "$2" ] && [ -n "$(tail -c1 "$2")" ] && echo >> "$2"; printf "%s\\n" "$l" >> "$2"; }; printf "%s\\n" "$l" >> "$seen"; done < "$3" 2>/dev/null', "bash", root.stateDir, root.themeFile, root.path("starter-themes")])
  }

  property bool ready: false
  Timer { interval: 4000; running: true; onTriggered: root.ready = true }

  Component.onCompleted: {
    refreshAi()
    builtinTimer.restart()
    Quickshell.execDetached(["python3", root.path("bin/perf-log"), "run"])
    lister.running = true
    resolver.running = true
    pauseBindTimer.restart()
    wallStep("status")
    winRun(["apply"])
    winRun(["frame", "sync"])
    Quickshell.execDetached([root.script, "fullscreen", "resume"])
    Quickshell.execDetached([root.script, "gif", "restore"])
    Quickshell.execDetached([root.script, "animated", "on"])
    // a watch on a missing file never fires, so the state files must exist; the preview file starts empty
    // the saved looks were called combos before 1.31: the user's file is moved to themes once (a copy stays as combos.pre-themes)
    // starter themes: each shipped line is added to the user's list once (tracked in starter-seen), so new releases deliver new themes
    // and a theme the user removed does not come back
    Quickshell.execDetached(["bash", "-c", 'mkdir -p "$1"; if [ -s "$1/combos" ] && [ ! -s "$3" ]; then cp -p "$1/combos" "$1/.themes.$$" && mv -f "$1/.themes.$$" "$3" && mv -f "$1/combos" "$1/combos.pre-themes"; fi; : > "$2"; seen="$1/starter-seen"; touch "$seen" "$3"; while IFS= read -r l || [ -n "$l" ]; do [ -n "$l" ] || continue; grep -qxF -- "$l" "$seen" && continue; grep -qxF -- "$l" "$3" || { [ -s "$3" ] && [ -n "$(tail -c1 "$3")" ] && echo >> "$3"; printf "%s\\n" "$l" >> "$3"; }; printf "%s\\n" "$l" >> "$seen"; done < "$4" 2>/dev/null; shift 4; for f in "$@"; do [ -e "$f" ] || : > "$f"; done', "bash",
                             root.stateDir, root.wallPreviewFile, root.themeFile, root.path("starter-themes"), root.stateFile, root.colorFile, root.colorFavFile, root.animatedFile, root.mouseFile, root.sectionsFile, root.shiftOnlyFile, root.disabledFile, root.fxStrengthFile, root.colStrengthFile, root.wallStrengthFile, root.mouseStrengthFile, root.wallReactFile, root.wallRangeFile, root.wallSpeedFile, root.wallZoomFile, root.wallTargetFile, root.winEffectFile, root.winColorFile, root.winFrameFile, root.winTargetFile, root.winAppsFile, root.winFxStrengthFile, root.winColStrengthFile,
                             root.screenFavFile, root.wallEffectFile, root.wallFavFile, root.mouseFavFile, root.themeFile, root.fsPauseFile, root.mouseSizeFile, root.mouseSpeedFile])
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
                 + (root.originLine !== "" ? "\nTheme: " + root.originName + (root.lookChanged ? " (changed)" : "") : "")
                 + "\nColor: " + (root.colorOn ? root.colorName(root.colorCurrent) + " " + root.colStrength + "%" : "off")
                 + "\nWallpaper effect: " + (root.wallOn ? root.wallLabel(root.wallShown) : "off")
                 + "\nWindows: " + (root.winAnyOn ? root.winOwnText() + [root.winEffect, root.winColor, root.winFrame].filter(function(x) { return x !== "" }).join(" + ") : "off")
                 + "\nCursor: " + (root.mouseOn ? root.mouseCurrent : "off") + (root.shiftOnly ? " (only while Shift is held)" : "")
                 + (root.wallStatus !== "" ? "\nWallpaper image: " + root.wallStatus.replace(/[<>&]/g, "?") : "")
                 + (root.jobsRunning > 0 ? "\nAI theme: " + root.jobsRunning + " being made in the background" : "")
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

  // busy dot on the bar icon while the AI theme creator works in the background
  Rectangle {
    visible: root.jobsRunning > 0
    width: Style.space(7)
    height: width
    radius: width / 2
    anchors.top: parent.top
    anchors.right: parent.right
    anchors.topMargin: Style.space(2)
    anchors.rightMargin: Style.space(2)
    color: root.bar.barForeground  // bar-icon
    SequentialAnimation on opacity {
      running: root.jobsRunning > 0
      loops: Animation.Infinite
      NumberAnimation { to: 0.25; duration: 700 }
      NumberAnimation { to: 1; duration: 700 }
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
    property var keys: []
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
      anchors.right: rowKeys.visible ? rowKeys.left : parent.right
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
    HotKey {
      id: rowKeys
      visible: root.keyHints && row.keys.length > 0
      keys: row.keys
      anchors.right: parent.right
      anchors.rightMargin: Style.space(6)
      anchors.verticalCenter: parent.verticalCenter
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
    property int minValue: 0
    property int defaultValue: 100
    property bool live: true
    property bool lit: false
    property var keyGroups: []
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
    KeyCaps {
      id: prKeys
      anchors.left: prLabel.right
      anchors.leftMargin: Style.space(10)
      anchors.verticalCenter: parent.verticalCenter
      groups: pr.keyGroups
    }
    Item {
      id: prTrack
      anchors.left: prKeys.visible ? prKeys.right : prLabel.right
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
        width: prRail.width * (pr.shown - pr.minValue) / (pr.maxValue - pr.minValue)
        height: prRail.height
        radius: prRail.radius
        anchors.verticalCenter: parent.verticalCenter
        color: root.fgA(0.85)
      }
      Rectangle {
        x: prRail.width * (pr.defaultValue - pr.minValue) / (pr.maxValue - pr.minValue) - width / 2
        width: Style.space(2)
        height: Style.space(12)
        anchors.verticalCenter: parent.verticalCenter
        color: root.fgA(0.55)
      }
      Rectangle {
        x: prRail.width * (pr.shown - pr.minValue) / (pr.maxValue - pr.minValue) - width / 2
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
      function valAt(mx) { return Math.round(pr.minValue + root.clamp(mapToItem(prTrack, mx, 0).x / prTrack.width, 0, 1) * (pr.maxValue - pr.minValue)) }
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
      onWheel: function(w) { pick(root.clamp(pr.shown + (w.angleDelta.y > 0 ? 5 : -5), pr.minValue, pr.maxValue)) }
    }
  }

  component SectionMenu: Item {
    id: sec
    property string title: ""
    property string icon: ""
    property bool special: false     // the Themes column: accent panel, bigger rows, parts as chips
    property bool inPane: false      // inside the right-hand pane: the open tab above is the title, rows fill the room left
    property string subtitle: ""
    property string lockKind: ""   // which kind of built-in this column lists (see isLocked): its built-in rows get a lock
    function lockMark(id) { return lockKind !== "" && root.isLocked(lockKind, id) ? root.builtinGlyph + " " : "" }
    property var rawCats: []
    readonly property bool filtering: root.query.trim() !== ""
    // commands (Off, Create with AI, ...) first as one fixed block, then the categories; with a filter: "All matches" (flat) and the categories that match
    readonly property var view: root.menuBuild(rawCats, root.query)
    readonly property var cats: view.cats
    readonly property int nCmd: view.nCmd
    readonly property int matchCount: view.total
    readonly property bool hasMatches: !filtering || view.total > 0
    // both slices come from the one `view` object: taken from `cats` and `nCmd` separately, one of them is briefly the old value, the list of categories
    // shrinks for a moment and the scroll position is lost
    readonly property var cmdCats: view.cats.slice(0, view.nCmd)
    readonly property var groupCats: view.cats.slice(view.nCmd)
    // Themes: Save as new / Revert / Undo come and go with the look; they keep three fixed slots so nothing below them ever moves
    readonly property var stateCmdIds: ["@saveas", "@revert", "@undo"]
    readonly property var restCmds: special ? cmdCats.filter(function(c) { return stateCmdIds.indexOf(c.id) < 0 }) : cmdCats
    readonly property var emptyRow: ({ id: "", label: "" })
    function catPos(id) { for (var i = 0; i < cats.length; i++) if (cats[i].id === id) return i; return -1 }
    // the right-hand list and the category rows are built once and only refilled: a new array of rows (the look changed, a command came or went)
    // must not rebuild them, or the list jumps back to its top while the choice is made
    property var shownItems: []
    property string shownCatId: ""
    function settleList() {
      var id = curCat ? String(curCat.id) : ""
      var fresh = id !== shownCatId
      shownCatId = id
      shownItems = curItems
      if (fresh) list.positionViewAtBeginning()
      showSelected()
    }
    readonly property bool flatList: curCat !== null && curCat.id === root.menuAllId && !special
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
    property var chips: []
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
    readonly property string railCaps: hasCustom ? [railH, railS, railV].map(function(r) { return r.capsShown }).join(",") : ""
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
    property bool hasMouseOpts: false // cursor options: Size and Speed rows only
    property int reactValue: 100
    property bool reactLive: false
    property int speedValue: 100
    property int zoomValue: 100
    signal speedPicked(int value)
    signal zoomPicked(int value)
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
    readonly property bool hasCatIcons: { for (var i = 0; i < groupCats.length; i++) if (root.rowGlyph(groupCats[i].id) !== "") return true; return false }
    property int itemIdx: 0
    readonly property real listY: list.contentY
    readonly property real catY: catFlick.contentY
    // test readout: how often a list was thrown back to its top while it was scrolled down (the menu must never do that by itself)
    property int topJumps: 0
    property real lastListY: 0
    property real lastCatY: 0
    Connections {
      target: list
      function onContentYChanged() { if (list.contentY < 1 && sec.lastListY > 60) sec.topJumps++; sec.lastListY = list.contentY }
    }
    Connections {
      target: catFlick
      function onContentYChanged() { if (catFlick.contentY < 1 && sec.lastCatY > 30) sec.topJumps++; sec.lastCatY = catFlick.contentY }
    }
    property point lastPt: Qt.point(-100, -100)
    readonly property int rowH: Style.space(special ? 38 : 28)
    readonly property int rowGap: Style.space(special ? 3 : 2)
    readonly property int visibleRows: special ? Math.max(4, root.tallScreen ? Math.floor((root.rowSpace - root.maxExtra) / (rowH + rowGap)) : Math.floor(root.rowsFit * (Style.space(28) + Style.space(2)) / (rowH + rowGap)))
                                                : (inPane ? Math.max(3, Math.floor((root.paneRoom - extraH - Style.space(40)) / (rowH + rowGap))) : root.rowsFit)
    readonly property int titleH: inPane ? (hasPicker ? Style.space(28) : 0) : Style.space(special ? 32 : 24)
    readonly property var curCat: cats.length > 0 ? cats[root.clamp(catIdx, 0, cats.length - 1)] : null
    readonly property var curItems: (curCat && curCat.items) ? curCat.items : []
    readonly property var selected: (col === 1 && itemIdx >= 0 && itemIdx < curItems.length) ? curItems[itemIdx] : null
    property var lastItem: null   // the item last pointed at; the "Delete selected" row acts on it
    onSelectedChanged: if (selected) lastItem = selected
    signal pointed(var item)
    signal chosen(var item, bool keep)
    signal acted(string id)
    signal focusRequested()

    readonly property int extraH: titleH + (hasStrength ? rowH + Style.space(6) : 0) + (hasMix ? rowH + Style.space(4) : 0) + (hasCustom ? 2 * rowH + Style.space(8) : 0) + (hasWallOpts ? 5 * (rowH + Style.space(4)) : 0) + (hasMouseOpts ? 2 * (rowH + Style.space(4)) : 0)
    readonly property int baseH: extraH + visibleRows * (rowH + rowGap)
    implicitHeight: baseH + Style.space(8) + chipFlow.implicitHeight

    // the Themes column is a panel of its own: accent border and glow, a soft accent wash
    Rectangle {
      visible: sec.special
      x: -Style.space(5); y: -Style.space(3)
      width: sec.width + Style.space(10); height: root.secH + Style.space(6)
      radius: Style.space(12)
      color: "transparent"
      border.width: 1
      border.color: root.accA(sec.focused ? 0.28 : 0.14)
    }
    Rectangle {
      visible: sec.special
      x: -Style.space(3); y: -Style.space(1)
      width: sec.width + Style.space(6); height: root.secH + Style.space(2)
      radius: Style.space(10)
      border.width: 1
      border.color: root.accA(sec.focused ? 0.85 : 0.5)
      gradient: Gradient {
        GradientStop { position: 0.0; color: root.accA(sec.focused ? 0.20 : 0.13) }
        GradientStop { position: 0.35; color: root.accA(0.06) }
        GradientStop { position: 1.0; color: root.accA(0.03) }
      }
    }

    Flow {
      id: chipFlow
      visible: sec.visible
      y: sec.baseH + Style.space(8)
      width: sec.width
      spacing: Style.space(4)
      leftPadding: Style.space(10)
      rightPadding: Style.space(4)
      Text {
        height: Style.space(24)
        verticalAlignment: Text.AlignVCenter
        textFormat: Text.PlainText
        text: sec.chips.length > 0 ? "ON:" : "ON: nothing"
        opacity: 0.55
        color: root.fg
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.body * 0.85
        font.bold: true
      }
      Repeater {
        model: sec.chips
        delegate: Rectangle {
          id: chip
          required property var modelData
          width: Math.min(chipText.implicitWidth + Style.space(20), sec.width - Style.space(18))
          height: Style.space(24)
          radius: Style.space(12)
          color: chipMouse.containsMouse ? root.fgA(0.22) : root.fgA(0.09)
          Text {
            id: chipText
            anchors.verticalCenter: parent.verticalCenter
            anchors.left: parent.left
            anchors.leftMargin: Style.space(10)
            anchors.right: parent.right
            anchors.rightMargin: Style.space(10)
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: chip.modelData.text + "  \u2715"
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body * 0.9
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
      else { catIdx = Math.min(nCmd + defaultCat, Math.max(0, cats.length - 1)); itemIdx = 0; col = 0 }
    }
    function resetForQuery() {
      if (!filtering) { sync(); return }
      catIdx = view.allIdx >= 0 ? view.allIdx : 0
      itemIdx = 0
      col = view.total > 0 ? 1 : 0
    }
    // n counts the categories only (key 1 = the first category below the commands)
    function gotoCat(n) {
      n += nCmd
      if (n < nCmd || n >= cats.length) return
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
          root.keyPointed(sec)
        }
      } else if (dx > 0) {
        if (col === 0) {
          if (!(curCat && curCat.action) && curItems.length > 0) { col = 1; itemIdx = root.clamp(itemIdx, 0, curItems.length - 1); root.keyPointed(sec) }
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
      else if (curItems.length > 0) { itemIdx = last ? curItems.length - 1 : 0; root.keyPointed(sec) }
    }
    function activate() {
      if (col === 0) {
        if (curCat && curCat.action) acted(curCat.id)
        else if (curItems.length > 0) { col = 1; itemIdx = root.clamp(itemIdx, 0, curItems.length - 1); root.keyPointed(sec) }
      } else if (selected) chosen(selected, true)
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
    // set while the selection follows its category to a new index: the categories themselves did not move, so the left scroll must not either
    property bool followingCat: false
    function showCat() {
      if (followingCat || catIdx < nCmd) return
      var y = (catIdx - nCmd) * (rowH + rowGap)
      if (y < catFlick.contentY) catFlick.contentY = y
      else if (y + rowH > catFlick.contentY + catFlick.height) catFlick.contentY = y + rowH - catFlick.height
    }
    onCatIdxChanged: { showCat(); var c = cats.length > 0 ? cats[root.clamp(catIdx, 0, cats.length - 1)] : null; if (c && c.id !== undefined) followCat = String(c.id) }
    onItemIdxChanged: showSelected()
    // commands (Undo, Save as new, Revert, Made by AI) come and go while a theme is previewed or chosen; they sit before the categories, so every index
    // shifts. Follow the category by its id, or the selection lands on another category and the list under it changes.
    property string followCat: ""
    onCatsChanged: {
      if (followCat === "") return
      for (var i = 0; i < cats.length; i++) {
        if (cats[i].id !== followCat) continue
        if (i !== catIdx) { followingCat = true; catIdx = i; followingCat = false }
        return
      }
    }
    onCurItemsChanged: Qt.callLater(settleList)
    onCurCatChanged: Qt.callLater(settleList)
    Component.onCompleted: settleList()

    Text {
      id: titleText
      visible: !sec.inPane
      height: sec.titleH
      verticalAlignment: Text.AlignVCenter
      leftPadding: Style.space(10)
      textFormat: Text.PlainText
      text: (sec.icon !== "" ? sec.icon + "  " : "") + sec.title.toUpperCase()
      opacity: sec.special ? 1 : (sec.focused ? 0.95 : 0.45)
      color: sec.special ? Color.accent : root.fg
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body * (sec.special ? 1.05 : 0.8)
      font.bold: true
      font.letterSpacing: sec.special ? 2 : 1
    }
    Text {
      visible: sec.special && sec.subtitle !== ""
      anchors.right: parent.right
      anchors.rightMargin: Style.space(12)
      anchors.verticalCenter: titleText.verticalCenter
      textFormat: Text.PlainText
      text: sec.subtitle
      opacity: 0.6
      color: root.fg
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body * 0.75
    }

    Rectangle {
      id: pickerBtn
      visible: sec.hasPicker
      x: sec.inPane ? Style.space(4) : titleText.implicitWidth + Style.space(6)
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
        // Qt's own wheel step is tiny (~70 px a notch): move ~150 px a notch like a browser.
        WheelHandler {
          acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
          onWheel: function(event) {
            var d = event.pixelDelta.y !== 0 ? event.pixelDelta.y : event.angleDelta.y * 1.25
            pickerView.cancelFlick()
            pickerView.contentY = Math.max(pickerView.originY, Math.min(Math.max(pickerView.originY, pickerView.originY + pickerView.contentHeight - pickerView.height), pickerView.contentY - d))
          }
        }
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

      Item {
        id: leftPane
        width: Math.round(sec.width * (sec.special ? 0.30 : 0.34))
        height: sec.visibleRows * (sec.rowH + sec.rowGap)

      // commands (Off, Create with AI, Surprise me, ...): one fixed block above the categories
      Row {
        id: stateRow
        visible: sec.special
        width: leftPane.width
        height: visible ? Math.round(sec.rowH * 0.86) : 0
        spacing: Style.space(3)
        Repeater {
          model: sec.stateCmdIds

          Rectangle {
            id: stBtn
            required property string modelData
            readonly property int gi: sec.catPos(modelData)
            readonly property bool present: gi >= 0
            readonly property bool selected: present && gi === sec.catIdx && sec.col === 0 && sec.focused
            width: Math.floor((leftPane.width - 2 * stateRow.spacing) / 3)
            height: stateRow.height
            radius: Style.space(6)
            opacity: present ? 1 : 0
            color: root.fgA(stMouse.containsMouse ? 0.32 : 0.2)
            border.width: selected ? 2 : 0
            border.color: root.fgA(0.85)
            readonly property string stLabel: modelData === "@saveas" ? "Save" : (modelData === "@revert" ? "Revert" : "Undo")
            // next to a key cap the word no longer fits this narrow slot: the icon and the cap say it
            readonly property bool stLabelFits: !stKey.visible || stFit.implicitWidth + stKey.width + Style.space(4) <= width - Style.space(8)
            Text { id: stFit; visible: false; font.family: root.bar.fontFamily; font.pixelSize: Style.font.body * 0.9; text: root.rowGlyph(stBtn.modelData) + " " + stBtn.stLabel }
            Row {
              anchors.centerIn: parent
              spacing: Style.space(4)
              Text {
                height: Style.space(16)
                width: Math.min(implicitWidth, stBtn.width - Style.space(8) - (stKey.visible ? stKey.width + parent.spacing : 0))
                verticalAlignment: Text.AlignVCenter
                elide: Text.ElideRight
                textFormat: Text.PlainText
                text: root.rowGlyph(stBtn.modelData) + (stLabelFits ? " " + stLabel : "")
                color: root.fg
                font.family: root.bar.fontFamily
                font.pixelSize: Style.font.body * 0.9
              }
              HotKey { id: stKey; visible: root.keyHints && stBtn.present; small: true; keys: [stBtn.modelData === "@saveas" ? "F" : (stBtn.modelData === "@revert" ? "b" : "y")] }
            }
            MouseArea {
              id: stMouse
              anchors.fill: parent
              enabled: stBtn.present
              hoverEnabled: true
              cursorShape: Qt.PointingHandCursor
              onClicked: {
                sec.focusRequested()
                sec.catIdx = stBtn.gi
                sec.acted(stBtn.modelData)
              }
            }
          }
        }
      }

      Flow {
        id: cmdFlow
        y: stateRow.visible ? stateRow.height + Style.space(3) : 0
        width: leftPane.width
        spacing: Style.space(3)
        Repeater {
          model: sec.restCmds.length

          Rectangle {
            id: cmdBtn
            required property int index
            readonly property var modelData: sec.restCmds[index] !== undefined ? sec.restCmds[index] : sec.emptyRow
            readonly property int gi: sec.catPos(modelData.id)
            readonly property bool selected: gi >= 0 && gi === sec.catIdx && sec.col === 0 && sec.focused
            readonly property string glyph: root.rowGlyph(modelData.id)
            width: Math.min(leftPane.width, cmdRow.implicitWidth + Style.space(20))
            height: Math.round(sec.rowH * 0.86)
            radius: Style.space(6)
            color: root.fgA(cmdMouse.containsMouse ? 0.32 : 0.2)
            border.width: selected ? 2 : 0
            border.color: root.fgA(0.85)
            Row {
              id: cmdRow
              anchors.centerIn: parent
              spacing: Style.space(5)
              Text {
                id: cmdText
                height: Style.space(16)
                width: Math.min(implicitWidth, leftPane.width - Style.space(20) - (cmdKey.visible ? cmdKey.width + parent.spacing : 0))
                verticalAlignment: Text.AlignVCenter
                elide: Text.ElideRight
                textFormat: Text.PlainText
                text: (cmdBtn.glyph !== "" ? cmdBtn.glyph + " " : "") + String(cmdBtn.modelData.label).replace(/\s+\([^)]*\)$/, "")
                color: root.fg
                font.family: root.bar.fontFamily
                font.pixelSize: Style.font.body * 0.9
              }
              HotKey { id: cmdKey; visible: root.keyHints && cmdBtn.modelData.key !== undefined; small: true; keys: cmdBtn.modelData.key !== undefined ? [cmdBtn.modelData.key] : [] }
            }
            MouseArea {
              id: cmdMouse
              anchors.fill: parent
              hoverEnabled: true
              cursorShape: Qt.PointingHandCursor
              onClicked: {
                sec.focusRequested()
                sec.catIdx = cmdBtn.gi
                sec.acted(cmdBtn.modelData.id)
              }
            }
          }
        }
      }

      Flickable {
        id: catFlick
        // Qt's own wheel step is tiny (~70 px a notch): move ~150 px a notch like a browser.
        WheelHandler {
          acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
          onWheel: function(event) {
            var d = event.pixelDelta.y !== 0 ? event.pixelDelta.y : event.angleDelta.y * 1.25
            catFlick.cancelFlick()
            catFlick.contentY = Math.max(catFlick.originY, Math.min(Math.max(catFlick.originY, catFlick.originY + catFlick.contentHeight - catFlick.height), catFlick.contentY - d))
          }
        }
        y: sec.nCmd > 0 ? cmdFlow.y + cmdFlow.height + Style.space(6) : 0
        width: leftPane.width
        height: leftPane.height - y
        contentHeight: catCol.height
        clip: true
        interactive: contentHeight > height
        boundsBehavior: Flickable.StopAtBounds

      Column {
        id: catCol
        width: catFlick.width
        spacing: sec.rowGap

        Repeater {
          model: sec.groupCats.length

          Rectangle {
            id: catRow
            required property int index
            readonly property var modelData: sec.groupCats[index] !== undefined ? sec.groupCats[index] : sec.emptyRow
            readonly property int ci: index + sec.nCmd
            readonly property bool selected: ci === sec.catIdx
            readonly property bool hasSaved: modelData.id !== "fav" && (sec.indexOfSaved(ci) >= 0 || sec.catHasMark(ci))
            width: catCol.width
            height: sec.rowH
            radius: Style.space(6)
            color: selected ? (sec.special ? root.accA(sec.col === 0 && sec.focused ? 0.34 : 0.16) : root.fgA(sec.col === 0 && sec.focused ? 0.2 : 0.09)) : (catMouse.containsMouse ? root.fgA(0.04) : "transparent")

            Text {
              id: catIcon
              visible: sec.hasCatIcons
              anchors.left: parent.left
              anchors.leftMargin: Style.space(10)
              width: Style.space(15)
              anchors.verticalCenter: parent.verticalCenter
              horizontalAlignment: Text.AlignHCenter
              textFormat: Text.PlainText
              text: root.rowGlyph(catRow.modelData.id)
              opacity: 0.8
              color: root.fg
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body
            }
            Text {
              anchors.left: sec.hasCatIcons ? catIcon.right : parent.left
              anchors.leftMargin: sec.hasCatIcons ? Style.space(5) : Style.space(10)
              anchors.right: catKey.visible ? catKey.left : marker.left
              anchors.rightMargin: catKey.visible ? Style.space(6) : 0
              anchors.verticalCenter: parent.verticalCenter
              elide: Text.ElideRight
              textFormat: Text.PlainText
              text: catRow.modelData.job !== undefined ? root.jobRowText(root.jobById(catRow.modelData.job) || { name: "", request: "", alive: false, has_result: false, state: "failed" }) : catRow.modelData.label
              color: root.fg
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body
            }
            HotKey {
              id: catKey
              visible: root.keyHints && catRow.modelData.key !== undefined
              small: true
              keys: catRow.modelData.key !== undefined ? [catRow.modelData.key] : []
              anchors.right: marker.left
              anchors.rightMargin: Style.space(6)
              anchors.verticalCenter: parent.verticalCenter
            }
            Text {
              id: marker
              anchors.right: parent.right
              anchors.rightMargin: Style.space(10)
              anchors.verticalCenter: parent.verticalCenter
              textFormat: Text.PlainText
              text: (catRow.hasSaved ? "● " : "") + (catRow.modelData.badge !== undefined ? catRow.modelData.badge : (catRow.hasSaved ? "" : "›"))
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
                sec.catIdx = catRow.ci
                sec.itemIdx = Math.max(0, sec.indexOfSaved(catRow.ci))
                sec.col = 1
              }
            }
          }
        }
      }
      }
      }

      ListView {
        id: list
        // Qt's own wheel step is tiny (~70 px a notch): move ~150 px a notch like a browser.
        WheelHandler {
          acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
          onWheel: function(event) {
            var d = event.pixelDelta.y !== 0 ? event.pixelDelta.y : event.angleDelta.y * 1.25
            list.cancelFlick()
            var lo = list.originY, hi = Math.max(list.originY, list.originY + list.contentHeight - list.height)
            var atEdge = d > 0 ? list.contentY <= lo : list.contentY >= hi
            if (atEdge && !sec.special) partsFlick.wheelBy(d)
            else list.contentY = Math.max(lo, Math.min(hi, list.contentY - d))
          }
        }
        width: panes.width - catFlick.width - panes.spacing
        height: sec.visibleRows * (sec.rowH + sec.rowGap)
        spacing: sec.rowGap
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        model: sec.shownItems.length

        delegate: Rectangle {
          id: itemRow
          required property int index
          readonly property var modelData: sec.shownItems[index] !== undefined ? sec.shownItems[index] : sec.emptyRow
          readonly property bool isSecond: sec.mixLive && modelData.id === sec.mixName
          readonly property bool isSaved: modelData.id === sec.saved || sec.alsoSaved.indexOf(modelData.id) >= 0 || isSecond
          readonly property bool selected: index === sec.itemIdx
          width: list.width
          height: sec.rowH
          radius: Style.space(6)
          color: selected ? (sec.special ? root.accA(sec.col === 1 && sec.focused ? 0.34 : 0.14) : root.fgA(sec.col === 1 && sec.focused ? 0.2 : 0.07)) : (sec.special ? root.fgA(itemMouse.containsMouse ? 0.09 : 0.04) : "transparent")

          // Themes: the name on top, the parts it is made of as small coloured chips below
          Item {
            visible: sec.special
            anchors.fill: parent
            Rectangle {
              visible: itemRow.isSaved || itemRow.selected
              width: Style.space(3); radius: width / 2
              anchors.left: parent.left; anchors.leftMargin: Style.space(3)
              anchors.top: parent.top; anchors.topMargin: Style.space(6)
              anchors.bottom: parent.bottom; anchors.bottomMargin: Style.space(6)
              color: Color.accent
              opacity: itemRow.isSaved ? 1 : 0.5
            }
            Text {
              id: themeName
              anchors.left: parent.left
              anchors.leftMargin: Style.space(12)
              anchors.right: themeMark.left
              anchors.rightMargin: Style.space(6)
              y: Style.space(4)
              height: Style.space(18)
              verticalAlignment: Text.AlignVCenter
              elide: Text.ElideRight
              textFormat: Text.PlainText
              text: sec.lockMark(itemRow.modelData.id) + (sec.favs.indexOf(itemRow.modelData.id) >= 0 ? root.favGlyph + " " : (root.rowGlyph(itemRow.modelData.id) !== "" ? root.rowGlyph(itemRow.modelData.id) + " " : "")) + itemRow.modelData.label
              color: root.fg
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body * 1.05
              font.bold: true
            }
            Text {
              id: themeMark
              anchors.right: parent.right
              anchors.rightMargin: Style.space(10)
              anchors.verticalCenter: themeName.verticalCenter
              textFormat: Text.PlainText
              text: itemRow.isSecond ? "+ " + sec.mixMode : (itemRow.isSaved ? root.checkGlyph : "")
              color: Color.accent
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body
            }
            Text {
              visible: itemRow.modelData.pieces === undefined
              anchors.left: parent.left
              anchors.leftMargin: Style.space(12)
              anchors.right: parent.right
              anchors.rightMargin: Style.space(6)
              y: Style.space(22)
              height: Style.space(14)
              verticalAlignment: Text.AlignVCenter
              elide: Text.ElideRight
              textFormat: Text.PlainText
              text: itemRow.modelData.desc || ""
              color: root.fg
              opacity: 0.7
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body * 0.8
            }
            Row {
              anchors.left: parent.left
              anchors.leftMargin: Style.space(12)
              anchors.right: parent.right
              anchors.rightMargin: Style.space(6)
              y: Style.space(23)
              height: Style.space(13)
              spacing: Style.space(3)
              clip: true
              Repeater {
                model: itemRow.modelData.pieces || []
                delegate: Rectangle {
                  required property var modelData
                  height: Style.space(13)
                  width: Math.min(pieceText.implicitWidth + Style.space(10), Style.space(70))
                  radius: height / 2
                  color: Qt.rgba(root.kindHue(modelData.kind).r, root.kindHue(modelData.kind).g, root.kindHue(modelData.kind).b, 0.30)
                  Text {
                    id: pieceText
                    anchors.fill: parent
                    anchors.leftMargin: Style.space(5)
                    anchors.rightMargin: Style.space(5)
                    verticalAlignment: Text.AlignVCenter
                    elide: Text.ElideRight
                    textFormat: Text.PlainText
                    text: modelData.text
                    color: root.fg
                    opacity: 0.9
                    font.family: root.bar.fontFamily
                    font.pixelSize: Style.font.body * 0.7
                  }
                }
              }
            }
          }

          Text {
            id: itemLabel
            visible: !sec.special
            anchors.left: parent.left
            anchors.leftMargin: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            width: Math.min(implicitWidth, parent.width - Style.space(60))
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: sec.lockMark(itemRow.modelData.id) + (sec.favs.indexOf(itemRow.modelData.id) >= 0 ? root.favGlyph + " " : (root.rowGlyph(itemRow.modelData.id) !== "" ? root.rowGlyph(itemRow.modelData.id) + " " : "")) + itemRow.modelData.label
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
          }
          Text {
            visible: !sec.special
            anchors.left: itemLabel.right
            anchors.leftMargin: Style.space(8)
            anchors.right: parent.right
            anchors.rightMargin: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            horizontalAlignment: Text.AlignRight
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: {
              if (itemRow.isSecond) return "+ " + sec.mixMode
              var where = sec.flatList ? (sec.view.catOf[itemRow.modelData.id] || "") : ""
              if (where === "") return itemRow.isSaved ? root.checkGlyph : (itemRow.modelData.hint || "")
              return (itemRow.isSaved ? root.checkGlyph + "  " : "") + where + (itemRow.modelData.hint ? "  ·  " + itemRow.modelData.hint : "")
            }
            opacity: itemRow.isSaved ? 1 : 0.5
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: (itemRow.isSaved && !itemRow.isSecond && !sec.flatList) ? Style.font.body : Style.font.body * 0.8
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

    // strength slider: drag, wheel, or [ ] (5, with Shift 1) d (default) while this menu has focus; right-click = default
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
      KeyCaps {
        id: strengthKeys
        anchors.left: strengthLabel.right
        anchors.leftMargin: Style.space(10)
        anchors.verticalCenter: parent.verticalCenter
        groups: [["[", "]"], ["d"]]
      }
      Item {
        id: track
        anchors.left: strengthKeys.visible ? strengthKeys.right : strengthLabel.right
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

    // mix row (Screen and Color): the second item picked with a / Ctrl+click; click the mode to flip stack / blend, t flips it from the keys, , . (< >) move the amount, D resets it, backspace removes the second
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
        text: "a or Ctrl+click adds a second " + sec.mixNoun
        color: root.fg
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.body * 0.85
      }
      KeyCaps {
        id: mixKeys
        anchors.left: mixLabel.right
        anchors.leftMargin: Style.space(10)
        anchors.verticalCenter: parent.verticalCenter
        groups: sec.mixLive ? [[",", "."]] : []
      }
      Item {
        id: mixTrack
        visible: sec.mixLive
        anchors.left: mixKeys.visible ? mixKeys.right : mixLabel.right
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
      id: speedRow
      visible: sec.hasWallOpts || sec.hasMouseOpts
      y: (sec.hasMix ? mixRow.y : strengthRow.y) + sec.rowH + Style.space(4)
      width: sec.width
      height: sec.rowH
      label: "Speed"
      keyGroups: [["v", "V"]]
      value: sec.speedValue
      maxValue: 300
      defaultValue: 100
      live: sec.reactLive
      lit: sec.focused
      onPicked: function(v) { sec.speedPicked(v) }
      onTouched: sec.focusRequested()
    }
    PctRow {
      id: zoomRow
      visible: sec.hasWallOpts || sec.hasMouseOpts
      y: speedRow.y + sec.rowH + Style.space(4)
      width: sec.width
      height: sec.rowH
      label: sec.hasMouseOpts ? "Size" : "Zoom"
      keyGroups: [["z", "Z"]]
      value: sec.zoomValue
      minValue: 25
      maxValue: 300
      defaultValue: 100
      live: sec.reactLive
      lit: sec.focused
      onPicked: function(v) { sec.zoomPicked(v) }
      onTouched: sec.focusRequested()
    }
    PctRow {
      id: reactRow
      visible: sec.hasWallOpts
      y: zoomRow.y + sec.rowH + Style.space(4)
      width: sec.width
      height: sec.rowH
      label: "Mouse reaction"
      keyGroups: [["(", ")"]]
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
      PlainField {
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
        PlainField {
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
          id: railH
          name: "H"
          keys: ["z", "Z"]
          fg: root.fg; fontFamily: root.bar.fontFamily; cellW: (customRow.width - 4 * Style.space(10)) / 3; cellH: sec.rowH
          value: sec.customH
          stops: ["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ff0000"]
          onMoved: function(v) { sec.focusRequested(); sec.customHsv(v, sec.customS, sec.customV) }
        }
        Rail {
          id: railS
          name: "S"
          keys: ["v", "V"]
          fg: root.fg; fontFamily: root.bar.fontFamily; cellW: (customRow.width - 4 * Style.space(10)) / 3; cellH: sec.rowH
          value: sec.customS
          stops: ["#ffffff", Qt.hsva(sec.customH, 1, 1, 1)]
          onMoved: function(v) { sec.focusRequested(); sec.customHsv(sec.customH, v, sec.customV) }
        }
        Rail {
          id: railV
          name: "V"
          keys: ["m", "M"]
          fg: root.fg; fontFamily: root.bar.fontFamily; cellW: (customRow.width - 4 * Style.space(10)) / 3; cellH: sec.rowH
          value: sec.customV
          stops: ["#000000", Qt.hsva(sec.customH, sec.customS, 1, 1)]
          onMoved: function(v) { sec.focusRequested(); sec.customHsv(sec.customH, sec.customS, v) }
        }
      }
    }

    Text {
      visible: sec.filtering && sec.matchCount === 0
      x: catCol.width + panes.spacing + Style.space(10)
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
    contentWidth: popup.fittedContentWidth(Style.space(Math.round(540 * root.widthUnits + 17)))
    contentHeight: popup.fittedContentHeight(body.implicitHeight)

    PanelKeyCatcher {
      id: keys
      anchors.fill: parent
      onMoveRequested: function(dx, dy) { root.moveKeys(dx, dy) }
      blocked: searchField.activeFocus || colorSec.editing || wallSec.editing
      onTabRequested: function(dir) { root.cycleKind(dir) }
      onDeleteRequested: root.handleText("x")
      onActivateRequested: {
        if (root.winPickOpen) root.pickWinApp(root.winAppItems[winSec.pickerIdx])
        else root.activeSec.activate()
      }
      onCloseRequested: { if (wn.open) wn.close(); else if (root.winPickOpen) root.winPickOpen = false; else if (root.query !== "") root.clearSearch(); else root.close() }
      onTextKey: function(t) { root.handleText(t) }
      Keys.forwardTo: [shiftWatcher]
      Item {
        id: shiftWatcher
        Keys.onPressed: function(event) {
          root.keyShift = (event.modifiers & Qt.ShiftModifier) !== 0
          if (event.key === Qt.Key_F1) { root.toggleKeyHints(); event.accepted = true }
          else if (event.key === Qt.Key_F2) { root.toggleKeyPreview(); event.accepted = true }
          else if (event.key === Qt.Key_F3) { root.toggleResources(); event.accepted = true }
          else if (event.key === Qt.Key_Shift) root.setMenuShift(true)
        }
        Keys.onReleased: function(event) {
          root.keyShift = (event.modifiers & Qt.ShiftModifier) !== 0
          if (event.key === Qt.Key_Shift) root.setMenuShift(false)
        }
      }

      Column {
        id: body
        width: parent.width
        spacing: Style.space(4)

        readonly property real gap: Style.space(8)
        readonly property real sepSpan: 2 * gap + 1
        // one width unit: the Themes pane is 1.55 units, the open parts 1 each (Color 0.85)
        readonly property real unitW: Math.floor((width - sepSpan) / root.widthUnits)
        readonly property real themeW: Math.floor(unitW * root.themeWeight)
        readonly property real rightW: width - themeW - sepSpan

        Item {
          id: header
          width: body.width
          height: Style.space(32)

          Text {
            id: pauseHint
            anchors.left: parent.left
            anchors.leftMargin: Style.space(4)
            anchors.verticalCenter: parent.verticalCenter
            visible: width > Style.space(60)
            width: Math.max(0, Math.min(implicitWidth, header.width - pauseBtn.width - fsBtn.width - wn.width - (wnKey.visible ? wnKey.width + Style.space(8) : 0) - capRow.width - Style.space(14) - 4 * Style.space(8)))
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: root.paused ? "Effects are off. Press p" + (root.panicKey !== "" ? " or " + root.panicKey : "") + " to bring them back."
                              : "Screen black or laggy? Press p" + (root.panicKey !== "" ? " or " + root.panicKey + " anywhere." : ".")
            opacity: root.paused ? 1 : 0.75
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body * 0.9
          }
          Rectangle {
            id: pauseBtn
            anchors.left: pauseHint.right
            anchors.leftMargin: Style.space(10)
            width: pauseRow.implicitWidth + Style.space(32)
            height: header.height
            radius: Style.space(6)
            color: root.fgA(root.paused ? (pauseMouse.containsMouse ? 0.4 : 0.32) : (pauseMouse.containsMouse ? 0.3 : 0.2))
            border.width: 1
            border.color: root.fgA(root.paused ? 0.9 : 0.45)
            Row {
              id: pauseRow
              anchors.centerIn: parent
              spacing: Style.space(8)
              Text {
                id: pauseLabel
                height: Style.space(22)
                verticalAlignment: Text.AlignVCenter
                textFormat: Text.PlainText
                text: root.paused ? "󰐊  PAUSED  ·  resume" : "󰏤  Pause all effects"
                color: root.fg
                font.family: root.bar.fontFamily
                font.pixelSize: Style.font.body
                font.bold: true
              }
              HotKey { visible: root.keyHints; keys: ["p"]; strong: true }
            }
            MouseArea {
              id: pauseMouse
              anchors.fill: parent
              hoverEnabled: true
              cursorShape: Qt.PointingHandCursor
              onClicked: root.togglePause()
            }
          }
          MenuRow {
            id: fsBtn
            anchors.left: pauseBtn.right
            anchors.leftMargin: Style.space(8)
            width: Math.max(Style.space(150), Math.min(Style.space(250), capRow.x - pauseBtn.width - Style.space(32)))
            height: header.height
            toggle: true
            checked: root.fsPauseOn
            label: (root.fsPauseOn ? root.boxOn : root.boxOff) + " 󰊓 Pause in fullscreen"
            keys: ["e"]
            onClicked: root.setFsPause(!root.fsPauseOn)
          }
          Row {
            id: capRow
            anchors.right: wnKey.visible ? wnKey.left : wn.left
            anchors.rightMargin: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(10)
            HeaderCap { id: f1Cap; cap: "F1"; label: "hotkeys"; lit: root.keyHints; onClicked: root.toggleKeyHints() }
            HeaderCap { id: f2Cap; cap: "F2"; label: "live preview"; lit: root.keyPreview; onClicked: root.toggleKeyPreview() }
            HeaderCap { id: f3Cap; cap: "F3"; label: "resources"; lit: root.resShown; onClicked: root.toggleResources() }
          }
          HotKey {
            id: wnKey
            visible: root.keyHints
            keys: ["Shift+U"]
            anchors.right: wn.left
            anchors.rightMargin: Style.space(6)
            anchors.verticalCenter: parent.verticalCenter
          }
          WhatsNewButton {
            id: wn
            pluginId: "io.github.akton1.omashaders"
            keyHint: "Shift+U"
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            flyoutParent: keys
            fg: root.fg
            fontFamily: root.bar.fontFamily
          }
        }

        Row {
          id: searchRow
          width: body.width
          height: Style.space(28)
          spacing: Style.space(10)

          PlainField {
            id: renameField
            visible: root.renaming
            width: searchRow.width - matchText.width - searchRow.spacing
            height: searchRow.height
            verticalPadding: Style.space(2)
            placeholderText: root.catMode === "new" ? "name the new category, ⏎ creates it, esc cancels"
                           : (root.catMode === "move" ? "category for this theme: type a name, Tab or ↑ ↓ picks one, ⏎ moves it, empty = usual place, esc cancels"
                           : (root.renameDup ? "name for the copy, ⏎ makes it, esc cancels" : "name this theme, ⏎ keeps it, empty = automatic name, esc cancels"))
            foreground: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
            maximumLength: 40
            Keys.onPressed: function(event) {
              if (event.key === Qt.Key_Escape) { root.finishRename(false); event.accepted = true }
              else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { root.finishRename(true); event.accepted = true }
              else if (root.catMode === "move" && (event.key === Qt.Key_Tab || event.key === Qt.Key_Down)) { root.cycleCatField(1); event.accepted = true }
              else if (root.catMode === "move" && (event.key === Qt.Key_Backtab || event.key === Qt.Key_Up)) { root.cycleCatField(-1); event.accepted = true }
            }
          }
          Item {
            id: slashCap
            visible: !root.renaming && root.keyHints
            width: slashKey.width
            height: searchRow.height
            HotKey { id: slashKey; keys: ["/"]; anchors.verticalCenter: parent.verticalCenter }
          }
          PlainField {
            id: searchField
            visible: !root.renaming
            width: Math.min(Style.space(300), searchRow.width - clearBtn.width - matchText.width - (slashCap.visible ? slashCap.width + searchRow.spacing : 0) - 2 * searchRow.spacing)
            height: searchRow.height
            verticalPadding: Style.space(2)
            placeholderText: root.keyHints ? "filter themes and effects" : "/  filter themes and effects"
            foreground: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
            onTextChanged: { root.query = text; root.applyQuery() }
            Keys.onPressed: function(event) {
              if (event.key === Qt.Key_Escape) { root.clearSearch(); event.accepted = true }
              else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { root.leaveSearch(); event.accepted = true }
              else if (event.key === Qt.Key_Down) { root.moveKeys(0, 1); event.accepted = true }
              else if (event.key === Qt.Key_Up) { root.moveKeys(0, -1); event.accepted = true }
              else if (event.key === Qt.Key_Tab || event.key === Qt.Key_Backtab) { root.leaveSearch(); event.accepted = true }
            }
          }
          Rectangle {
            id: clearBtn
            visible: !root.renaming
            width: Style.space(76)
            height: searchRow.height
            radius: Style.space(6)
            color: root.fgA(clearMouse.containsMouse && root.query !== "" ? 0.32 : 0.2)
            opacity: root.query !== "" ? 1 : 0.4
            Text {
              anchors.centerIn: parent
              textFormat: Text.PlainText
              text: "✕  Clear"
              color: root.fg
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body * 0.9
            }
            MouseArea {
              id: clearMouse
              anchors.fill: parent
              hoverEnabled: true
              cursorShape: root.query !== "" ? Qt.PointingHandCursor : Qt.ArrowCursor
              onClicked: if (root.query !== "") root.clearSearch()
            }
          }
          Text {
            id: matchText
            width: Style.space(90)
            height: searchRow.height
            verticalAlignment: Text.AlignVCenter
            horizontalAlignment: Text.AlignLeft
            textFormat: Text.PlainText
            text: root.query.trim() === "" ? "" : root.matchTotal() + " found"
            opacity: 0.6
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body * 0.85
          }
        }

        Rectangle { width: body.width; height: 1; color: root.fgA(0.2) }

        // left: complete themes, right: the parts to fine-tune
        Row {
          id: stepRow
          width: body.width
          height: Style.space(30)
          spacing: body.sepSpan

          Text {
            width: body.themeW
            height: stepRow.height
            verticalAlignment: Text.AlignVCenter
            leftPadding: Style.space(10)
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: "Themes  (a combination of " + root.partWord.toLowerCase() + ")"
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body * 1.05
            font.bold: true
          }
          Item {
            width: body.rightW
            height: stepRow.height
            Text {
              width: parent.width - (wallCap.visible ? wallCap.width + Style.space(10) : 0) - autoBox.width - Style.space(10)
              height: stepRow.height
              verticalAlignment: Text.AlignVCenter
              leftPadding: Style.space(10)
              elide: Text.ElideRight
              textFormat: Text.PlainText
              text: root.partWord + "  (pick a tab to fine-tune it)"
              color: root.fg
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body * 1.05
              font.bold: true
            }
            // the theme's own Wallhaven picture, right above the tab row: the link opens its page, the button fetches and sets it (key H)
            // the plugin setting "Use theme wallpaper when available" (off by default), same value as in the Omarchy plugin settings; key L
            Rectangle {
              id: autoBox
              visible: true
              anchors.right: parent.right
              anchors.rightMargin: Style.space(10)
              anchors.verticalCenter: parent.verticalCenter
              height: stepRow.height - Style.space(4)
              width: autoText.implicitWidth + Style.space(20)
              radius: height / 2
              color: root.fgA(autoMouse.containsMouse ? 0.22 : (root.useThemeWallpaper ? 0.16 : 0.08))
              border.width: 1
              border.color: root.fgA(root.useThemeWallpaper ? 0.5 : 0.3)
              Text {
                id: autoText
                anchors.centerIn: parent
                textFormat: Text.PlainText
                text: (root.useThemeWallpaper ? "\uF046 " : "\uF096 ") + "Use theme wallpapers"
                color: root.fg
                font.family: root.bar.fontFamily
                font.pixelSize: Style.font.body * 0.9
              }
              MouseArea {
                id: autoMouse
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: root.setUseThemeWallpaper(!root.useThemeWallpaper)
              }
            }
            Rectangle {
              id: wallCap
              visible: true
              anchors.right: autoBox.left
              anchors.rightMargin: Style.space(8)
              anchors.verticalCenter: parent.verticalCenter
              height: stepRow.height - Style.space(4)
              width: Math.min(parent.width - Style.space(30) - autoBox.width, (root.capWh !== "" ? capLink.implicitWidth : 0) + (capBtn.visible ? capBtn.width : 0) + (capNote.visible ? capNote.implicitWidth : 0) + Style.space(22))
              radius: height / 2
              color: root.fgA(0.1)
              border.width: 1
              border.color: root.fgA(0.35)
              Text {
                id: capNote
                visible: !capBtn.visible
                x: Style.space(10)
                width: parent.width - Style.space(20)
                height: parent.height
                verticalAlignment: Text.AlignVCenter
                elide: Text.ElideRight
                textFormat: Text.PlainText
                text: root.capState.label
                color: root.fgA(0.6)
                font.family: root.bar.fontFamily
                font.pixelSize: Style.font.body * 0.9
              }
              Text {
                id: capLink
                visible: root.capWh !== ""
                x: Style.space(10)
                height: parent.height
                verticalAlignment: Text.AlignVCenter
                textFormat: Text.PlainText
                text: "Wallhaven " + root.capWh
                color: root.fg
                font.family: root.bar.fontFamily
                font.pixelSize: Style.font.body * 0.9
                font.underline: capLinkMouse.containsMouse
                MouseArea {
                  id: capLinkMouse
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.capOpenPage()
                }
              }
              Rectangle {
                id: capBtn
                visible: root.capState.kind !== "none" && root.capState.kind !== "unsaved"
                anchors.right: parent.right
                anchors.rightMargin: Style.space(2)
                anchors.verticalCenter: parent.verticalCenter
                height: parent.height - Style.space(4)
                width: capBtnText.implicitWidth + Style.space(18)
                radius: height / 2
                color: root.fgA(!root.capState.enabled ? 0.06 : (capBtnMouse.containsMouse ? 0.34 : 0.2))
                opacity: root.capState.enabled || root.capState.kind === "busy" ? 1 : 0.7
                Text {
                  id: capBtnText
                  anchors.centerIn: parent
                  textFormat: Text.PlainText
                  text: root.capState.kind === "current" ? "\uDB80\uDD2C " + root.capState.label
                        : root.capState.kind === "remember" ? "\uDB80\uDD93 " + root.capState.label
                        : (root.capState.kind === "busy" ? "" : "\uDB80\uDDDA ") + root.capState.label
                  color: root.fg
                  font.family: root.bar.fontFamily
                  font.pixelSize: Style.font.body * 0.9
                }
                MouseArea {
                  id: capBtnMouse
                  anchors.fill: parent
                  hoverEnabled: true
                  enabled: root.capState.enabled
                  cursorShape: root.capState.enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
                  onClicked: root.capAct()
                }
              }
            }
          }
        }

        Row {
          id: secRow
          width: body.width
          spacing: body.gap

          SectionMenu {
            id: themeSec
            lockKind: "theme"
            width: body.themeW
            title: "Themes"
            icon: root.kindIcon("theme")
            special: true
            subtitle: root.lookChanged ? root.originName + " (changed)" : root.themeItems.length + " looks"
            rawCats: root.themeCats
            saved: (root.lookChanged || applyGuard.running) ? root.originLine : root.themeNowId
            favs: []
            focused: root.focusKind === "theme"
            defaultCat: 0
            onPointed: function(item) { root.previewTheme(item) }
            onChosen: function(item, keep) {
              if (item.id.indexOf("@rand:") === 0 || item.id.indexOf("@clear:") === 0) { root.runSurprise(item.id); if (!keep) root.popupOpen = false }
              else root.applyTheme(item, keep, true)
            }
            onActed: function(id) { root.runAction("theme", id) }
            onFocusRequested: root.activeKind = "theme"
          }

          Rectangle {
            width: 1
            height: root.secH
            color: root.fgA(0.2)
          }

          Item {
            id: rightArea
            width: body.rightW
            height: root.secH

            Column {
              id: partsHead
              width: rightArea.width - Style.space(10)
              spacing: root.paneGap
              Item {
                width: partsHead.width
                height: root.tabH + 1
                Rectangle { y: root.tabH; width: parent.width; height: 1; color: root.fgA(0.3) }
                Row {
                  spacing: Style.space(3)
                  PartTab { kind: "screen" }
                  PartTab { kind: "color" }
                  PartTab { kind: "wall" }
                  PartTab { kind: "mouse" }
                  PartTab { kind: "win" }
                }
              }
              Text {
                visible: root.nOpen > 0
                width: partsHead.width
                height: root.aboutH
                leftPadding: Style.space(10)
                rightPadding: Style.space(10)
                verticalAlignment: Text.AlignVCenter
                elide: Text.ElideRight
                textFormat: Text.PlainText
                text: root.nOpen > 0 ? root.kindAbout(root.openParts[0]) : ""
                opacity: 0.65
                color: root.fg
                font.family: root.bar.fontFamily
                font.pixelSize: Style.font.body * 0.85
              }
            }

            Flickable {
              id: partsFlick
              anchors.fill: parent
              anchors.topMargin: partsHead.height + root.paneGap
              clip: true
              contentWidth: width
              contentHeight: partsCol.height
              boundsBehavior: Flickable.StopAtBounds
              function wheelBy(d) {
                cancelFlick()
                contentY = Math.max(0, Math.min(Math.max(0, contentHeight - height), contentY - d))
              }
              function reveal(s) {
                if (!s || !s.visible) return
                if (s.y < contentY || s.height >= height) contentY = Math.max(0, Math.min(s.y, contentHeight - height))
                else if (s.y + s.height > contentY + height) contentY = Math.min(s.y + s.height - height, contentHeight - height)
              }
              WheelHandler {
                acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                onWheel: function(event) { partsFlick.wheelBy(event.pixelDelta.y !== 0 ? event.pixelDelta.y : event.angleDelta.y * 1.25) }
              }
              Connections {
                target: root
                function onFocusKindChanged() { Qt.callLater(function() { partsFlick.reveal(root.secOf(root.focusKind)) }) }
              }
              Rectangle {
                visible: partsFlick.contentHeight > partsFlick.height
                x: partsFlick.width - width
                y: partsFlick.contentY + partsFlick.contentY / Math.max(1, partsFlick.contentHeight - partsFlick.height) * (partsFlick.height - height)
                width: Style.space(4)
                height: Math.max(Style.space(30), partsFlick.height * partsFlick.height / partsFlick.contentHeight)
                radius: width / 2
                color: root.fgA(0.4)
                z: 5
              }

              Column {
                id: partsCol
                width: partsFlick.width - Style.space(10)
                spacing: root.paneGap
              SectionMenu {
                id: screenSec
                lockKind: "screen"
                inPane: true
                visible: root.showScreen
                chips: root.chipsOf("screen")
                width: partsCol.width
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

              SectionMenu {
                id: colorSec
                lockKind: "color"
                inPane: true
                visible: root.showColor
                chips: root.chipsOf("color")
                width: partsCol.width
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

              SectionMenu {
                id: wallSec
                lockKind: "wall"
                inPane: true
                visible: root.showWall
                chips: root.chipsOf("wall")
                width: partsCol.width
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
                speedValue: root.wallSpeed
                zoomValue: root.wallZoom
                onSpeedPicked: function(v) { root.setWallSpeed(v) }
                onZoomPicked: function(v) { root.setWallZoom(v) }
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

              SectionMenu {
                id: mouseSec
                lockKind: "mouse"
                inPane: true
                visible: root.showMouse
                chips: root.chipsOf("mouse")
                width: partsCol.width
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
                hasMouseOpts: true
                reactLive: root.mouseOn && !root.mouseBend
                speedValue: root.mouseSpeed
                zoomValue: root.mouseSize
                onSpeedPicked: function(v) { root.setMouseSpeed(v) }
                onZoomPicked: function(v) { root.setMouseSize(v) }
                onPointed: function(item) { root.previewMouse(item) }
                onChosen: function(item, keep) { root.chooseMouse(item, keep) }
                onActed: function(id) { root.runAction("mouse", id) }
                onFocusRequested: root.activeKind = "mouse"
              }

              SectionMenu {
                id: winSec
                lockKind: "win"
                inPane: true
                visible: root.showWin
                chips: root.chipsOf("win")
                width: partsCol.width
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

              Text {
                visible: root.nOpen === 0
                width: partsCol.width
                topPadding: Style.space(8)
                leftPadding: Style.space(10)
                rightPadding: Style.space(10)
                wrapMode: Text.WordWrap
                textFormat: Text.PlainText
                lineHeight: 1.3
                text: "A theme mixes all of these. Pick a tab to change just that one: pick an effect, set its strength, mix two.\n\n" + root.partKinds.map(function(k) { return root.kindTitle(k) + ": " + root.kindAbout(k) }).join("\n")
                opacity: 0.6
                color: root.fg
                font.family: root.bar.fontFamily
                font.pixelSize: Style.font.body * 0.9
              }
              }
            }
          }
        }

        Rectangle { visible: root.stripShown; width: body.width; height: 1; color: root.fgA(0.2) }

        // hotkey hints (F1 hides them): keys are drawn as caps so they stand out from their descriptions
        Column {
          id: hintStrip
          visible: root.stripShown
          width: body.width
          HintFlow { id: everywhereFlow; width: body.width; hints: root.denseHints ? root.everywhereShort : root.everywhereHints }
          HintFlow { id: focusFlow; width: body.width; visible: !root.denseHints; hints: root.focusHints }
        }
        // never shown: measures the full strip so a small screen can drop the second row
        Column {
          id: hintMeasure
          visible: false
          width: body.width
          HintFlow { width: body.width; hints: root.everywhereHints }
          HintFlow { width: body.width; hints: root.focusHints }
        }

        Rectangle { width: body.width; height: 1; color: root.fgA(0.2) }

        // what is on and what it costs: the answer to "why is my system slow?" (F3 hides it)
        Column {
          id: loadBox
          visible: root.resShown
          width: body.width
          height: root.loadH
          spacing: Style.space(3)

          Row {
            id: loadHead
            width: loadBox.width
            height: Style.space(26)
            spacing: Style.space(8)
            Text {
              id: loadTitle
              height: loadHead.height
              verticalAlignment: Text.AlignVCenter
              leftPadding: Style.space(10)
              textFormat: Text.PlainText
              text: "󰓅 What is using my GPU"
              color: root.fg
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body
              font.bold: true
            }
          }
          Text {
            width: loadBox.width
            leftPadding: Style.space(10)
            rightPadding: Style.space(10)
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: root.loadVerdict
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body * 0.95
          }
          Flow {
            width: loadBox.width
            spacing: Style.space(5)
            leftPadding: Style.space(10)
            visible: root.loadItems.length > 0 && !root.paused
            Repeater {
              model: root.loadItems
              delegate: Rectangle {
                id: loadChip
                required property var modelData
                width: loadChipRow.implicitWidth + Style.space(20)
                height: Style.space(24)
                radius: Style.space(12)
                color: loadMouse.containsMouse ? root.fgA(0.24) : root.fgA(0.1)
                border.width: 1
                border.color: root.loadColor(loadChip.modelData.rating, 0.7)
                Row {
                  id: loadChipRow
                  anchors.centerIn: parent
                  spacing: Style.space(6)
                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    textFormat: Text.PlainText
                    text: "●"
                    color: root.loadColor(loadChip.modelData.rating, 1)
                    font.family: root.bar.fontFamily
                    font.pixelSize: Style.font.body * 0.9
                  }
                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    textFormat: Text.PlainText
                    text: loadChip.modelData.label + ": " + root.loadWord(loadChip.modelData) + "  ✕"
                    color: root.fg
                    font.family: root.bar.fontFamily
                    font.pixelSize: Style.font.body * 0.9
                  }
                }
                MouseArea {
                  id: loadMouse
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.removeActive(loadChip.modelData.key)
                }
              }
            }
          }
          Text {
            width: loadBox.width
            height: Style.space(18)
            verticalAlignment: Text.AlignVCenter
            leftPadding: Style.space(10)
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: root.gpuText
            opacity: 0.8
            color: root.fg
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body * 0.85
          }
        }

        Rectangle { visible: root.resShown; width: body.width; height: 1; color: root.fgA(0.2) }

        Text {
          id: detailText
          width: body.width
          height: Style.space(24)
          verticalAlignment: Text.AlignVCenter
          leftPadding: Style.space(10)
          elide: Text.ElideRight
          textFormat: Text.PlainText
          text: {
            if (root.themeFlash !== "") return root.themeFlash
            var cc = root.focusKind === "theme" ? root.activeSec.curCat : null
            if (cc && cc.job !== undefined) return root.jobTip(cc.job)
            var it = root.activeSec.selected
            if (it) return root.kindTitle(root.focusKind) + " · " + (root.activeSec.lockMark(it.id) !== "" ? root.builtinGlyph + " Built in, " + (root.devSwitch ? "edit and save yours with F" : "locked (Duplicate to change)") + " · " : "") + it.label + (it.desc ? ": " + it.desc : (it.hint && it.id.charAt(0) !== "@" ? ": " + it.hint : ""))
            return "Move to an item for details"
          }
          color: root.fg
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.body
        }

      }
    }
  }
}
