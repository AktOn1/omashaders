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

  property real time: 0
  readonly property real startMs: Date.now()

  Timer {
    interval: Math.round(1000 / fx.fps)
    repeat: true
    running: fx.effect !== ""
    onTriggered: fx.time = (Date.now() - fx.startMs) / 1000
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
        property variant src: img
        property real time: fx.time
        property vector2d mouse: Qt.vector2d(fx.mouse.x - win.screen.x, fx.mouse.y - win.screen.y)
        property vector2d res: Qt.vector2d(width, height)
        property vector2d imgSize: img.implicitWidth > 0 ? Qt.vector2d(img.implicitWidth, img.implicitHeight) : Qt.vector2d(width, height)
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
