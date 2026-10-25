pragma ComponentBehavior: Bound
import QtQuick
import Quickshell
import Quickshell.Wayland

// One click-through layer-shell window per monitor, between the wallpaper and the windows,
// drawing a fragment shader from effects/NAME.frag.qsb over (or instead of) the wallpaper.
Scope {
  id: fx

  property string effect: ""
  // report(kind, name, why, driver): set by the plugin; called when the renderer refuses a shader, so the effect is switched off
  // instead of the graphics driver retrying it on every frame (which fills the shell log and memory)
  property var report: null
  property var offScreens: [] // names of the monitors that get no effect (they show a fullscreen window)
  function shownScreens(off) {
    var out = []
    for (var i = 0; i < Quickshell.screens.length; i++)
      if (off.indexOf(Quickshell.screens[i].name) < 0) out.push(Quickshell.screens[i])
    return out
  }
  // file:// url of the folder with AI-made effects; names starting "ai-" load from genDir/wall/
  property string genDir: ""
  function shaderUrl(n) {
    if (n.indexOf("ai-") === 0) return fx.genDir !== "" ? fx.genDir + "/wall/" + n + ".frag.qsb" : ""
    return Qt.resolvedUrl("wallpaper-effects/" + n + ".frag.qsb")
  }
  // effects that draw sprites from wallpaper-effects/NAME.png (sampler `sprites`, binding 2, RGBA atlas)
  readonly property var spriteEffects: ["pumpkin-night"]
  // AI-made effects with painted sprites: the id ends in -sp (or -sp-2 ...) and genDir/wall/NAME.png is the atlas (a checked 1024x512 PNG made by bin/aisprites.py)
  function spriteUrl(n) {
    if (n.indexOf("ai-") === 0) return (fx.genDir !== "" && /-sp(-[0-9]+)?$/.test(n)) ? fx.genDir + "/wall/" + n + ".png" : ""
    return fx.spriteEffects.indexOf(n) >= 0 ? Qt.resolvedUrl("wallpaper-effects/" + n + ".png") : ""
  }
  // optional second effect: "stack" runs it on the first one's result, "blend" runs both on the wallpaper; mixAmount is its share (0..1)
  property string effect2: ""
  property string mixMode: "stack"
  property real mixAmount: 1.0
  property string wallpaper: ""
  property point mouse: Qt.point(0, 0)
  property color cBg: "#050318"
  property color cBlue: "#7a8cff"
  property color cMagenta: "#da6fef"
  property color cPink: "#f56c90"
  property color cCream: "#FAF0BF"
  property int fps: 30
  property real strength: 1.0
  property real react: 1.0 // how much the effect follows the pointer: 0 = not at all, 1 = as designed, 2 = exaggerated
  property color targetColor: "#e8a33d" // colour the colour-reactor effect looks for
  property real range: 0.5 // how far from targetColor still counts (0..1)

  property real speed: 1.0 // animation speed: 0 = frozen, 1 = as designed, 3 = three times faster
  property real zoom: 1.0 // how big the effect is drawn: 1 = as designed, 2 = twice as large, 0.5 = half the size

  // sound level (0-1): overall, bass, mids, treble; all 0 unless an audio-* effect is running (bin/audio-level)
  property real audio: 0
  property real bass: 0
  property real mid: 0
  property real treble: 0

  property real time: 0 // effect clock: runs at `speed` times real time
  property real clock: 0 // real time in seconds
  property real lastTick: 0
  readonly property real startMs: Date.now()

  // pointer path for effects that drag things along: live position plus 7 samples, newest first
  property var trail: [Qt.point(-10000, -10000), Qt.point(-10000, -10000), Qt.point(-10000, -10000), Qt.point(-10000, -10000),
                       Qt.point(-10000, -10000), Qt.point(-10000, -10000), Qt.point(-10000, -10000), Qt.point(-10000, -10000)]
  property real lastSample: 0
  function sampleTrail(now) {
    var t = fx.trail.slice(0)
    t[0] = fx.mouse
    if (fx.mouse.x < -5000) { for (var k = 1; k < 8; k++) t[k] = fx.mouse; fx.trail = t; return }
    if (t[1].x < -5000) for (var j = 1; j < 8; j++) t[j] = fx.mouse
    if (now - fx.lastSample >= 0.1) {
      fx.lastSample = now
      for (var i = 7; i > 1; i--) t[i] = t[i - 1]
      t[1] = fx.mouse
    }
    fx.trail = t
  }
  function trailVec(a, b, sx, sy) {
    var p = fx.trail[a], q = fx.trail[b]
    return Qt.vector4d(p.x - sx, p.y - sy, q.x - sx, q.y - sy)
  }

  Timer {
    interval: Math.round(1000 / fx.fps)
    repeat: true
    running: fx.effect !== ""
    onTriggered: {
      var now = (Date.now() - fx.startMs) / 1000
      var dt = Math.min(Math.max(now - fx.lastTick, 0), 0.25)
      fx.lastTick = now
      fx.clock = now
      fx.time += dt * fx.speed
      if (fx.effect === "smoke" || fx.effect2 === "smoke") fx.sampleTrail(now)
    }
  }

  component FxLayer: ShaderEffect {
    required property var scr
    required property var image
    property string name: ""
    property bool dead: false // the renderer refused this shader: stop feeding it to the GPU
    onNameChanged: dead = false
    onStatusChanged: if (status === ShaderEffect.Error && !dead) {
      dead = true
      if (fx.report) fx.report(name === fx.effect ? "wall" : "wall2", name, "the graphics driver rejected the shader", true)
    }
    property variant source
    property real zoom: 1.0
    anchors.fill: parent
    property variant src: source
    property variant sprites: spriteImg
    Image { id: spriteImg; visible: false; source: fx.spriteUrl(name); mipmap: true; smooth: true; asynchronous: false }
    property real time: fx.time
    // the vertex shader scales the picture about its centre, so the pointer is moved the same way
    function zx(v) { return ((v / width - 0.5) / zoom + 0.5) * width }
    function zy(v) { return ((v / height - 0.5) / zoom + 0.5) * height }
    property vector2d mouse: Qt.vector2d(zx(fx.mouse.x - scr.x), zy(fx.mouse.y - scr.y))
    property vector2d res: Qt.vector2d(width, height)
    property vector2d imgSize: image.implicitWidth > 0 ? Qt.vector2d(image.implicitWidth, image.implicitHeight) : Qt.vector2d(width, height)
    function zv(v) { return Qt.vector4d(zx(v.x), zy(v.y), zx(v.z), zy(v.w)) }
    property vector4d tr0: zv(fx.trailVec(0, 1, scr.x, scr.y))
    property vector4d tr1: zv(fx.trailVec(2, 3, scr.x, scr.y))
    property vector4d tr2: zv(fx.trailVec(4, 5, scr.x, scr.y))
    property vector4d tr3: zv(fx.trailVec(6, 7, scr.x, scr.y))
    property color cBg: fx.cBg
    property color cBlue: fx.cBlue
    property color cMagenta: fx.cMagenta
    property color cPink: fx.cPink
    property color cCream: fx.cCream
    property color cTarget: fx.targetColor
    property real react: fx.react
    property real range: fx.range
    property real audio: fx.audio
    property real bass: fx.bass
    property real mid: fx.mid
    property real treble: fx.treble
    vertexShader: Qt.resolvedUrl("wallpaper-effects/zoom.vert.qsb")
    fragmentShader: (name !== "" && !dead) ? fx.shaderUrl(name) : ""
  }

  Variants {
    model: fx.effect !== "" ? fx.shownScreens(fx.offScreens) : []

    PanelWindow {
      id: win
      required property var modelData
      screen: modelData
      color: "transparent"
      exclusionMode: ExclusionMode.Ignore
      anchors { top: true; bottom: true; left: true; right: true }
      mask: Region {}
      WlrLayershell.layer: WlrLayer.Bottom
      WlrLayershell.namespace: "wallpaper-fx"

      Image {
        id: img
        visible: false
        source: fx.wallpaper !== "" ? "file://" + fx.wallpaper : ""
        asynchronous: true
        cache: false
      }

      Item {
        anchors.fill: parent
        opacity: fx.strength
        layer.enabled: fx.effect2 !== ""

        FxLayer { id: first; scr: win.screen; image: img; name: fx.effect; source: img; zoom: fx.zoom }
        ShaderEffectSource {
          id: firstOut
          visible: false
          live: fx.effect2 !== "" && fx.mixMode === "stack"
          sourceItem: fx.effect2 !== "" ? first : null
        }
        FxLayer {
          scr: win.screen
          image: img
          name: fx.effect2
          zoom: fx.mixMode === "stack" ? 1 : fx.zoom // a stacked effect reads the zoomed result of the first one
          source: fx.mixMode === "stack" ? firstOut : img
          visible: fx.effect2 !== ""
          opacity: fx.mixAmount
        }
      }
    }
  }
}
