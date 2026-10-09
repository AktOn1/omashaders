import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Hyprland
import qs.Ui

// Bar icon for the screen-shader script: left click = next effect, right click = off,
// scroll = previous / next. Hyprland forgets the shader on a config reload, so it is re-applied.
BarWidget {
  id: root
  moduleName: "io.github.akton1.screen-shaders"

  readonly property string script: Qt.resolvedUrl("bin/screen-shader").toString().replace(/^file:\/\//, "")
  readonly property string stateFile: (Quickshell.env("XDG_STATE_HOME") || (Quickshell.env("HOME") + "/.local/state"))
                                      + "/omarchy/io.github.akton1.screen-shaders/current"
  readonly property bool includeAnimated: setting("includeAnimated", false) === true
  property string current: ""
  readonly property bool shaderOn: current !== ""

  function run(verb) {
    var cmd = [root.script, verb]
    if (root.includeAnimated && (verb === "next" || verb === "prev")) cmd.push("-a")
    Quickshell.execDetached(cmd)
  }

  FileView {
    path: root.stateFile
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.current = String(text() || "").trim()
    onLoadFailed: root.current = ""
  }

  Connections {
    target: Hyprland
    function onRawEvent(event) {
      if (event.name === "configreloaded" && root.shaderOn) reapplyTimer.restart()
    }
  }
  Timer {
    id: reapplyTimer
    interval: 400
    onTriggered: root.run("reapply")
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "󰍹"
    active: root.shaderOn
    tooltipText: (root.shaderOn ? "Screen shader: " + root.current : "Screen shader: off")
                 + "\nclick: next · right-click: off · scroll: step"
    onPressed: function(b) {
      if (b === Qt.RightButton) root.run("off")
      else root.run("next")
    }
    onWheelMoved: function(delta) { root.run(delta > 0 ? "prev" : "next") }
  }
}
