pragma ComponentBehavior: Bound
import QtQuick
import Quickshell
import Quickshell.Wayland

// One click-through layer-shell window per monitor, between the wallpaper and the windows,
// drawing a fragment shader from effects/NAME.frag.qsb over (or instead of) the wallpaper.
Scope {
  id: fx

  property string effect: ""
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

  property real time: 0
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
    onTriggered: { fx.time = (Date.now() - fx.startMs) / 1000; if (fx.effect === "smoke" || fx.effect2 === "smoke") fx.sampleTrail(fx.time) }
  }

  component FxLayer: ShaderEffect {
    required property var scr
    required property var image
    property string name: ""
    property variant source
    anchors.fill: parent
    property variant src: source
    property real time: fx.time
    property vector2d mouse: Qt.vector2d(fx.mouse.x - scr.x, fx.mouse.y - scr.y)
    property vector2d res: Qt.vector2d(width, height)
    property vector2d imgSize: image.implicitWidth > 0 ? Qt.vector2d(image.implicitWidth, image.implicitHeight) : Qt.vector2d(width, height)
    property vector4d tr0: fx.trailVec(0, 1, scr.x, scr.y)
    property vector4d tr1: fx.trailVec(2, 3, scr.x, scr.y)
    property vector4d tr2: fx.trailVec(4, 5, scr.x, scr.y)
    property vector4d tr3: fx.trailVec(6, 7, scr.x, scr.y)
    property color cBg: fx.cBg
    property color cBlue: fx.cBlue
    property color cMagenta: fx.cMagenta
    property color cPink: fx.cPink
    property color cCream: fx.cCream
    property color cTarget: fx.targetColor
    property real react: fx.react
    property real range: fx.range
    fragmentShader: name !== "" ? Qt.resolvedUrl("wallpaper-effects/" + name + ".frag.qsb") : ""
  }

  Variants {
    model: fx.effect !== "" ? Quickshell.screens : []

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

        FxLayer { id: first; scr: win.screen; image: img; name: fx.effect; source: img }
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
          source: fx.mixMode === "stack" ? firstOut : img
          visible: fx.effect2 !== ""
          opacity: fx.mixAmount
        }
      }
    }
  }
}
