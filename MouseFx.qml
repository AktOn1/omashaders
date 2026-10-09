import QtQuick
import Quickshell
import Quickshell.Wayland

// One click-through overlay window per monitor drawing mouse-effects/NAME.frag.qsb around the cursor.
Scope {
  id: fx

  property string effect: ""
  property bool motion: false
  property point mouse: Qt.point(-10000, -10000)
  property int fps: 30

  property real time: 0
  property var hist: []
  property int tick: 0
  readonly property real startMs: Date.now()

  function pt(i) { return fx.hist[i] || fx.mouse }
  onEffectChanged: hist = []

  Timer {
    interval: Math.round(1000 / fx.fps)
    repeat: true
    running: fx.effect !== "" && fx.motion
    onTriggered: {
      fx.time = (Date.now() - fx.startMs) / 1000
      fx.tick++
      if (fx.tick % 2 === 0) {
        var h = fx.hist.slice(0, 7)
        h.unshift(fx.mouse)
        fx.hist = h
      }
    }
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
      WlrLayershell.layer: WlrLayer.Overlay
      WlrLayershell.namespace: "omashaders-mouse"

      ShaderEffect {
        anchors.fill: parent
        property real time: fx.time
        property vector2d mouse: Qt.vector2d(fx.mouse.x - win.screen.x, fx.mouse.y - win.screen.y)
        property vector2d res: Qt.vector2d(width, height)
        property vector4d h0: Qt.vector4d(fx.pt(0).x - win.screen.x, fx.pt(0).y - win.screen.y, fx.pt(1).x - win.screen.x, fx.pt(1).y - win.screen.y)
        property vector4d h1: Qt.vector4d(fx.pt(2).x - win.screen.x, fx.pt(2).y - win.screen.y, fx.pt(3).x - win.screen.x, fx.pt(3).y - win.screen.y)
        property vector4d h2: Qt.vector4d(fx.pt(4).x - win.screen.x, fx.pt(4).y - win.screen.y, fx.pt(5).x - win.screen.x, fx.pt(5).y - win.screen.y)
        property vector4d h3: Qt.vector4d(fx.pt(6).x - win.screen.x, fx.pt(6).y - win.screen.y, fx.pt(7).x - win.screen.x, fx.pt(7).y - win.screen.y)
        fragmentShader: fx.effect !== "" ? Qt.resolvedUrl("mouse-effects/" + fx.effect + ".frag.qsb") : ""
      }
    }
  }
}
