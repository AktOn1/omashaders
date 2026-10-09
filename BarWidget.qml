import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Hyprland
import qs.Commons
import qs.Ui

// Bar icon for the screen-shader script: left click = list of effects to pick from, right click = off,
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

  property bool popupOpen: false
  property var entries: []
  function close() { popupOpen = false }

  IpcHandler {
    target: "io.github.akton1.screen-shaders"
    function toggle(): void { root.popupOpen = !root.popupOpen }
    function open(): void { root.popupOpen = true }
    function close(): void { root.popupOpen = false }
    function set(name: string): void { root.pick(name === "off" ? "" : name) }
  }

  function pick(name) {
    Quickshell.execDetached([root.script, name === "" ? "off" : "set", name])
    root.popupOpen = false
  }

  Process {
    id: lister
    command: [root.script, "listall"]
    stdout: StdioCollector {
      onStreamFinished: {
        var out = []
        String(text).split("\n").forEach(function(line) {
          var p = line.trim().split(" ")
          if (p[0] && (root.includeAnimated || p[1] !== "animated")) out.push({ name: p[0], animated: p[1] === "animated" })
        })
        root.entries = out
      }
    }
  }
  onPopupOpenChanged: if (popupOpen) lister.running = true

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
                 + "\nclick: pick from list · right-click: off · scroll: step"
    onPressed: function(b) {
      if (b === Qt.RightButton) root.run("off")
      else root.popupOpen = !root.popupOpen
    }
    onWheelMoved: function(delta) { root.run(delta > 0 ? "prev" : "next") }
  }

  PopupCard {
    id: popup
    anchorItem: root
    bar: root.bar
    owner: root
    open: root.popupOpen
    contentWidth: popup.fittedContentWidth(Style.space(220))
    contentHeight: popup.fittedContentHeight(list.implicitHeight)

    Column {
      id: list
      width: parent.width
      spacing: Style.space(2)

      Repeater {
        model: [{ name: "", animated: false }].concat(root.entries)

        Rectangle {
          required property var modelData
          readonly property bool isCurrent: modelData.name === root.current
          width: list.width
          height: Style.space(30)
          radius: Style.space(6)
          color: rowMouse.containsMouse ? Qt.rgba(root.bar.barForeground.r, root.bar.barForeground.g, root.bar.barForeground.b, 0.14)
                 : isCurrent ? Qt.rgba(root.bar.barForeground.r, root.bar.barForeground.g, root.bar.barForeground.b, 0.08) : "transparent"

          Text {
            anchors.left: parent.left
            anchors.leftMargin: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            textFormat: Text.PlainText
            text: (modelData.name === "" ? "off" : modelData.name) + (modelData.animated ? "  (heavy)" : "")
            color: root.bar.barForeground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
          }
          Text {
            anchors.right: parent.right
            anchors.rightMargin: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            visible: parent.isCurrent
            text: "󰄬"
            color: root.bar.barForeground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
          }
          MouseArea {
            id: rowMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.pick(modelData.name)
          }
        }
      }
    }
  }
}
