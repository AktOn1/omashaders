import QtQuick
import Quickshell
import Quickshell.Wayland

// One click-through overlay window per monitor drawing mouse-effects/NAME.frag.qsb around the cursor.
Scope {
  id: fx

  property string effect: ""
  property var offScreens: [] // names of the monitors that get no effect (they show a fullscreen window)
  function shownScreens(off) {
    var out = []
    for (var i = 0; i < Quickshell.screens.length; i++)
      if (off.indexOf(Quickshell.screens[i].name) < 0) out.push(Quickshell.screens[i])
    return out
  }
  // file:// url of the folder with AI-made effects; names starting "ai-" load from genDir/mouse/
  property string genDir: ""
  function shaderUrl(n) {
    if (n.indexOf("ai-") === 0) return fx.genDir !== "" ? fx.genDir + "/mouse/" + n + ".frag.qsb" : ""
    return Qt.resolvedUrl("mouse-effects/" + n + ".frag.qsb")
  }
  property bool motion: false
  property point mouse: Qt.point(-10000, -10000)
  property int fps: 30
  property real strength: 1.0
  property real size: 1.0 // effect scale around the pointer: 1 = as designed
  property real speed: 1.0 // animation speed: 0 = frozen, 1 = as designed
  property real audio: 0.0 // sound level 0-1: overall, bass, mids, treble (all 0 unless an audio-* effect runs)
  property real bass: 0.0
  property real mid: 0.0
  property real treble: 0.0
  property real lastTick: 0

  property real time: 0
  // Pointer history for trail effects: 16 samples, one every histStep seconds (about one second back). A sample keeps its
  // position as it ages; histSeq numbers the newest one (a stable id for hashing) and histPhase is how far (0-1) we are
  // into the interval since it was taken, so shaders can age particles continuously instead of hopping once per sample.
  readonly property real histStep: 0.066
  property var hist: []
  property int histSeq: 0
  property real histPhase: 0
  property real lastSample: 0
  readonly property real startMs: Date.now()

  function pt(i) { return fx.hist[i] || fx.mouse }
  onEffectChanged: { hist = []; histPhase = 0 }

  Timer {
    interval: Math.round(1000 / fx.fps)
    repeat: true
    running: fx.effect !== "" && fx.motion
    onTriggered: {
      var now = (Date.now() - fx.startMs) / 1000
      fx.time += Math.min(Math.max(now - fx.lastTick, 0), 0.25) * fx.speed
      fx.lastTick = now
      var wall = Date.now() / 1000
      var since = wall - fx.lastSample
      if (since >= fx.histStep) {
        fx.lastSample = since < fx.histStep * 2 ? fx.lastSample + fx.histStep : wall
        var h = fx.hist.slice(0, 15)
        h.unshift(Qt.point(fx.mouse.x, fx.mouse.y)) // a copy: a point stored as is stays tied to fx.mouse and follows it
        fx.hist = h
        fx.histSeq = (fx.histSeq + 1) % 4096
        since = wall - fx.lastSample
      }
      fx.histPhase = Math.min(since / fx.histStep, 1)
    }
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
      WlrLayershell.layer: WlrLayer.Overlay
      WlrLayershell.namespace: "omashaders-mouse"

      ShaderEffect {
        anchors.fill: parent
        opacity: fx.strength
        transform: Scale {
          origin.x: fx.mouse.x - win.screen.x
          origin.y: fx.mouse.y - win.screen.y
          xScale: fx.size
          yScale: fx.size
        }
        property real time: fx.time
        property real audio: fx.audio
        property real bass: fx.bass
        property real mid: fx.mid
        property real treble: fx.treble
        property vector2d mouse: Qt.vector2d(fx.mouse.x - win.screen.x, fx.mouse.y - win.screen.y)
        property vector2d res: Qt.vector2d(width, height)
        property vector4d h0: Qt.vector4d(fx.pt(0).x - win.screen.x, fx.pt(0).y - win.screen.y, fx.pt(1).x - win.screen.x, fx.pt(1).y - win.screen.y)
        property vector4d h1: Qt.vector4d(fx.pt(2).x - win.screen.x, fx.pt(2).y - win.screen.y, fx.pt(3).x - win.screen.x, fx.pt(3).y - win.screen.y)
        property vector4d h2: Qt.vector4d(fx.pt(4).x - win.screen.x, fx.pt(4).y - win.screen.y, fx.pt(5).x - win.screen.x, fx.pt(5).y - win.screen.y)
        property vector4d h3: Qt.vector4d(fx.pt(6).x - win.screen.x, fx.pt(6).y - win.screen.y, fx.pt(7).x - win.screen.x, fx.pt(7).y - win.screen.y)
        property vector4d h4: Qt.vector4d(fx.pt(8).x - win.screen.x, fx.pt(8).y - win.screen.y, fx.pt(9).x - win.screen.x, fx.pt(9).y - win.screen.y)
        property vector4d h5: Qt.vector4d(fx.pt(10).x - win.screen.x, fx.pt(10).y - win.screen.y, fx.pt(11).x - win.screen.x, fx.pt(11).y - win.screen.y)
        property vector4d h6: Qt.vector4d(fx.pt(12).x - win.screen.x, fx.pt(12).y - win.screen.y, fx.pt(13).x - win.screen.x, fx.pt(13).y - win.screen.y)
        property vector4d h7: Qt.vector4d(fx.pt(14).x - win.screen.x, fx.pt(14).y - win.screen.y, fx.pt(15).x - win.screen.x, fx.pt(15).y - win.screen.y)
        property vector4d hs: Qt.vector4d(fx.histSeq, fx.histPhase, fx.histStep, 0)
        fragmentShader: fx.effect !== "" ? fx.shaderUrl(fx.effect) : ""
      }
    }
  }
}
