import QtQuick
import Quickshell
import Quickshell.Wayland

// One click-through layer-shell window per monitor, between the wallpaper and the windows,
// drawing a fragment shader from effects/NAME.frag.qsb over (or instead of) the wallpaper.
Scope {
  id: fx

  property string effect: ""
  property string wallpaper: ""
  property point mouse: Qt.point(0, 0)
  property color cBg: "#050318"
  property color cBlue: "#7a8cff"
  property color cMagenta: "#da6fef"
  property color cPink: "#f56c90"
  property color cCream: "#FAF0BF"
  property int fps: 30
  property real strength: 1.0

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
    onTriggered: { fx.time = (Date.now() - fx.startMs) / 1000; if (fx.effect === "smoke") fx.sampleTrail(fx.time) }
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

      ShaderEffect {
        anchors.fill: parent
        opacity: fx.strength
        property variant src: img
        property real time: fx.time
        property vector2d mouse: Qt.vector2d(fx.mouse.x - win.screen.x, fx.mouse.y - win.screen.y)
        property vector2d res: Qt.vector2d(width, height)
        property vector2d imgSize: img.implicitWidth > 0 ? Qt.vector2d(img.implicitWidth, img.implicitHeight) : Qt.vector2d(width, height)
        property vector4d tr0: fx.trailVec(0, 1, win.screen.x, win.screen.y)
        property vector4d tr1: fx.trailVec(2, 3, win.screen.x, win.screen.y)
        property vector4d tr2: fx.trailVec(4, 5, win.screen.x, win.screen.y)
        property vector4d tr3: fx.trailVec(6, 7, win.screen.x, win.screen.y)
        property color cBg: fx.cBg
        property color cBlue: fx.cBlue
        property color cMagenta: fx.cMagenta
        property color cPink: fx.cPink
        property color cCream: fx.cCream
        fragmentShader: fx.effect !== "" ? Qt.resolvedUrl("wallpaper-effects/" + fx.effect + ".frag.qsb") : ""
      }
    }
  }
}
