import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

// Thin host for the real plugin (Core.qml). Omarchy loads this file once at shell start, so the code lives in
// Core.qml and this host swaps in a fresh copy whenever Core.qml or a sibling QML file changes on disk (or on
// `omarchy-shell io.github.akton1.omashaders-host reload`). Every file is compiled first; if any of them has an
// error the swap is refused and the running version stays. Only edits to this host need a shell restart.
BarWidget {
  id: root
  moduleName: "io.github.akton1.omashaders"

  readonly property var files: ["Core.qml", "WallpaperFx.qml", "MouseFx.qml", "BendMarker.qml"]
  property int reloads: 0
  property string reloadError: ""
  property var core: null
  property var pending: null
  property var pendingComps: []
  property string pendingVer: ""
  property real keepW: 0
  property real keepH: 0

  implicitWidth: core ? core.implicitWidth : (reloadError !== "" ? badge.implicitWidth : keepW)
  implicitHeight: core ? core.implicitHeight : (reloadError !== "" ? badge.implicitHeight : keepH)

  // the bar drives the menu through these; they follow whichever Core is running
  readonly property bool opened: core ? core.opened : false
  function open() { if (core) core.open() }
  function close() { if (core) core.close() }
  function toggle() { if (core) core.toggle() }
  function closeForPopoutSwitch() { if (core) core.closeForPopoutSwitch() }

  // old Core goes first, the new one is created a moment later, so the IPC target and helper processes of
  // the old one are gone before the new ones register
  Timer {
    id: swapTimer
    interval: 150
    onTriggered: {
      var c = root.pending
      root.pending = null
      if (!c) return
      root.core = c.createObject(root, { host: root, ver: root.pendingVer })
      root.reloads++
    }
  }

  function firstLine(text) { return String(text).split("\n").filter(function(l) { return l.trim() !== "" })[0] || "" }

  function reload() {
    var ver = Date.now() + "." + (reloads + 1)
    pendingVer = ver
    var comps = files.map(function(f) { return Qt.createComponent(Qt.resolvedUrl(f) + "?v=" + ver) })
    pendingComps = comps
    function check() {
      if (root.pendingVer !== ver) return
      var errors = []
      for (var i = 0; i < comps.length; i++) {
        if (comps[i].status === Component.Loading) return
        if (comps[i].status !== Component.Ready) errors.push(root.files[i] + ": " + comps[i].errorString())
      }
      root.pendingComps = []
      if (errors.length > 0) {
        root.reloadError = errors.join("\n")
        console.warn("OmaShaders: not reloading, a QML file has errors:\n" + root.reloadError)
        Quickshell.execDetached(["notify-send", "-a", "OmaShaders", "Reload refused, the running version stays", root.firstLine(root.reloadError)])
        return
      }
      root.reloadError = ""
      root.pending = comps[0]
      root.keepW = root.implicitWidth
      root.keepH = root.implicitHeight
      if (root.core) { root.core.destroy(); root.core = null }
      swapTimer.restart()
    }
    comps.forEach(function(c) { if (c.status === Component.Loading) c.statusChanged.connect(check) })
    check()
  }

  Timer { id: debounce; interval: 400; onTriggered: root.reload() }

  Repeater {
    model: root.files
    delegate: FileView {
      required property string modelData
      path: decodeURIComponent(Qt.resolvedUrl(modelData).toString().replace(/^file:\/\//, ""))
      watchChanges: true
      printErrors: false
      onFileChanged: debounce.restart()
    }
  }

  Text {
    id: badge
    visible: root.reloadError !== ""
    anchors.right: parent.right
    anchors.top: parent.top
    text: "!"
    color: "#ff5555"
    font.bold: true
    font.pixelSize: 12
  }

  IpcHandler {
    target: "io.github.akton1.omashaders-host"
    function reload(): void { root.broadcast("reload") }
    function status(): string { return "reloads=" + root.reloads + " running=" + (root.core ? "yes" : "no") + " error=" + (root.reloadError === "" ? "none" : root.firstLine(root.reloadError)) }
  }

  Component.onCompleted: reload()
}
